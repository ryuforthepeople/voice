import { EventEmitter } from 'eventemitter3'
import type { SessionState, Turn, VoiceSessionConfig, SessionEvents } from '../types/index.js'
import type { STTAdapter } from '../adapters/stt/adapter.js'
import type { TTSAdapter } from '../adapters/tts/adapter.js'
import type { LLMAdapter, LLMMessage } from '../adapters/llm/adapter.js'
import { StateMachine } from './state.js'
import { InterruptHandler } from './interrupt.js'

export interface VoiceSessionOptions {
  stt: STTAdapter
  tts: TTSAdapter
  llm: LLMAdapter
  config?: VoiceSessionConfig
}

export class VoiceSession extends EventEmitter<SessionEvents> {
  private stt: STTAdapter
  private tts: TTSAdapter
  private llm: LLMAdapter
  private stateMachine: StateMachine
  private interruptHandler: InterruptHandler
  private config: VoiceSessionConfig
  
  // Conversation history
  private turns: Turn[] = []
  private currentUserText = ''
  private currentAssistantText = ''
  
  // Pending TTS text accumulator for streaming
  private pendingTTSText = ''
  private ttsTimeout: ReturnType<typeof setTimeout> | null = null
  
  constructor(options: VoiceSessionOptions) {
    super()
    
    this.stt = options.stt
    this.tts = options.tts
    this.llm = options.llm
    this.config = options.config || {}
    
    this.stateMachine = new StateMachine()
    this.interruptHandler = new InterruptHandler({
      enabled: this.config.interruptEnabled ?? true,
    })
    
    this.setupAdapters()
    this.setupStateMachine()
  }
  
  private setupAdapters(): void {
    // STT events
    this.stt.on('transcript', (result) => {
      if (result.text) {
        this.currentUserText = result.isFinal 
          ? this.currentUserText + ' ' + result.text 
          : this.currentUserText.split(' ').slice(0, -1).join(' ') + ' ' + result.text
        
        this.currentUserText = this.currentUserText.trim()
        this.emit('transcript', result.text, result.isFinal, 'user')
      }
      
      // Check for interrupt
      if (this.interruptHandler.shouldInterrupt(this.stateMachine.current, !!result.text)) {
        this.handleInterrupt()
      }
      
      // If final transcript and we're listening, process it
      if (result.isFinal && this.currentUserText && this.stateMachine.current === 'listening') {
        this.processUserInput()
      }
    })
    
    this.stt.on('error', (error) => {
      this.emit('error', error)
    })
    
    // TTS events
    this.tts.on('audio', (chunk) => {
      this.emit('audio', chunk)
    })
    
    this.tts.on('end', () => {
      // TTS finished, go back to listening
      if (this.stateMachine.current === 'speaking') {
        this.stateMachine.transition('listening')
      }
    })
    
    this.tts.on('error', (error) => {
      this.emit('error', error)
    })
    
    // LLM events
    this.llm.on('token', (token) => {
      this.currentAssistantText += token
      this.emit('transcript', token, false, 'assistant')
      
      // Accumulate for TTS and trigger on sentence boundaries
      this.pendingTTSText += token
      this.scheduleTTS()
    })
    
    this.llm.on('complete', (text) => {
      // Final transcript
      this.emit('transcript', '', true, 'assistant')
      
      // Add to conversation history
      this.turns.push({
        role: 'assistant',
        content: text,
        timestamp: Date.now(),
      })
      
      // Flush any remaining TTS
      this.flushTTS()
    })
    
    this.llm.on('error', (error) => {
      this.emit('error', error)
    })
  }
  
  private setupStateMachine(): void {
    this.stateMachine.subscribe((state) => {
      this.emit('state', state)
    })
  }
  
  private scheduleTTS(): void {
    // Debounce TTS to accumulate some text before speaking
    if (this.ttsTimeout) {
      clearTimeout(this.ttsTimeout)
    }
    
    // Check for sentence boundaries
    const sentenceEnd = /[.!?]\s*$/
    if (sentenceEnd.test(this.pendingTTSText) || this.pendingTTSText.length > 100) {
      this.flushTTS()
    } else {
      this.ttsTimeout = setTimeout(() => this.flushTTS(), 300)
    }
  }
  
  private flushTTS(): void {
    if (this.ttsTimeout) {
      clearTimeout(this.ttsTimeout)
      this.ttsTimeout = null
    }
    
    const text = this.pendingTTSText.trim()
    this.pendingTTSText = ''
    
    if (text && this.stateMachine.current !== 'idle') {
      this.stateMachine.transition('speaking')
      this.tts.synthesize(text).catch(err => {
        this.emit('error', err)
      })
    }
  }
  
  private handleInterrupt(): void {
    console.log('User interrupted AI')
    
    // Stop TTS
    this.tts.stop()
    
    // Stop LLM generation
    this.llm.stop()
    
    // Clear pending TTS
    this.pendingTTSText = ''
    if (this.ttsTimeout) {
      clearTimeout(this.ttsTimeout)
      this.ttsTimeout = null
    }
    
    // Transition to interrupted then listening
    this.stateMachine.transition('interrupted')
    this.interruptHandler.reset()
    this.stateMachine.transition('listening')
  }
  
  private async processUserInput(): Promise<void> {
    const userText = this.currentUserText.trim()
    if (!userText) return
    
    // Add to conversation history
    this.turns.push({
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    })
    
    // Reset for next turn
    this.currentUserText = ''
    this.currentAssistantText = ''
    
    // Transition to processing
    this.stateMachine.transition('processing')
    
    // Build messages for LLM
    const messages: LLMMessage[] = this.turns.map(t => ({
      role: t.role,
      content: t.content,
    }))
    
    try {
      await this.llm.generate(messages, this.config.systemPrompt)
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      this.stateMachine.force('listening')
    }
  }
  
  /**
   * Start the voice session
   */
  async start(): Promise<void> {
    await this.stt.start({
      sampleRate: 16000,
      channels: 1,
      encoding: 'linear16',
    })
    
    this.stateMachine.transition('listening')
  }
  
  /**
   * Send audio to the session
   */
  sendAudio(audio: Buffer): void {
    if (this.stateMachine.current !== 'idle') {
      this.stt.send(audio)
    }
  }
  
  /**
   * Stop the voice session
   */
  async stop(): Promise<void> {
    this.tts.stop()
    this.llm.stop()
    await this.stt.stop()
    
    if (this.ttsTimeout) {
      clearTimeout(this.ttsTimeout)
      this.ttsTimeout = null
    }
    
    this.stateMachine.reset()
    this.emit('end')
  }
  
  /**
   * Get current state
   */
  get state(): SessionState {
    return this.stateMachine.current
  }
  
  /**
   * Get conversation history
   */
  get history(): Turn[] {
    return [...this.turns]
  }
  
  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.turns = []
  }
}
