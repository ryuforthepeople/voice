import Anthropic from '@anthropic-ai/sdk'
import { LLMAdapter, type LLMMessage } from './adapter.js'

const VOICE_SYSTEM_PROMPT_NL = `Je bent Ryu, een vriendelijke AI assistent die via spraak communiceert.

Belangrijke regels voor voice:
- Houd antwoorden kort en conversationeel (max 2-3 zinnen per beurt)
- Geen markdown, bullets, of formatting
- Geen URLs, code, of technische notaties
- Spreek zoals een mens zou praten in een normaal gesprek
- Gebruik geen speciale tekens of emoji's
- Als je iets niet weet, zeg dat gewoon eerlijk
- Wees natuurlijk en warm, niet robotachtig`

const VOICE_SYSTEM_PROMPT_EN = `You are Ryu, a friendly AI assistant communicating through voice.

Important rules for voice:
- Keep responses short and conversational (max 2-3 sentences per turn)
- No markdown, bullets, or formatting
- No URLs, code, or technical notation
- Speak like a human would in a normal conversation
- Don't use special characters or emojis
- If you don't know something, just say so honestly
- Be natural and warm, not robotic`

export interface ClaudeLLMConfig {
  apiKey: string
  model?: string
  maxTokens?: number
  language?: 'nl-NL' | 'en-US'
}

export class ClaudeLLM extends LLMAdapter {
  readonly name = 'claude'
  
  private client: Anthropic
  private config: ClaudeLLMConfig
  private active = false
  private abortController: AbortController | null = null
  
  constructor(config: ClaudeLLMConfig) {
    super()
    this.config = {
      model: config.model || 'claude-sonnet-4-20250514',
      maxTokens: config.maxTokens || 256, // Keep short for voice
      language: config.language || 'nl-NL',
      ...config,
    }
    this.client = new Anthropic({
      apiKey: config.apiKey,
    })
  }
  
  async generate(
    messages: LLMMessage[],
    systemPrompt?: string
  ): Promise<string> {
    if (this.active) {
      this.stop()
    }
    
    this.active = true
    this.abortController = new AbortController()
    
    // Choose system prompt based on language
    const defaultSystemPrompt = this.config.language === 'en-US' 
      ? VOICE_SYSTEM_PROMPT_EN 
      : VOICE_SYSTEM_PROMPT_NL
    
    const fullSystemPrompt = systemPrompt 
      ? `${defaultSystemPrompt}\n\n${systemPrompt}`
      : defaultSystemPrompt
    
    let fullResponse = ''
    
    try {
      const stream = this.client.messages.stream({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        system: fullSystemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      })
      
      for await (const event of stream) {
        if (!this.active) break
        
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const token = event.delta.text
          fullResponse += token
          this.emit('token', token)
        }
      }
      
      this.emit('complete', fullResponse)
      return fullResponse
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      this.active = false
      this.abortController = null
    }
  }
  
  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.active = false
  }
  
  isActive(): boolean {
    return this.active
  }
}
