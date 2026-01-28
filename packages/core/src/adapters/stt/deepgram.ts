import { createClient, LiveTranscriptionEvents, type LiveClient, type DeepgramClient } from '@deepgram/sdk'
import { STTAdapter } from './adapter.js'
import type { AudioFormat } from '../../types/index.js'

export interface DeepgramSTTConfig {
  apiKey: string
  model?: string
  language?: string
  punctuate?: boolean
  interimResults?: boolean
  endpointing?: number | boolean
}

export class DeepgramSTT extends STTAdapter {
  readonly name = 'deepgram'
  
  private client: DeepgramClient
  private connection: LiveClient | null = null
  private config: DeepgramSTTConfig
  private active = false
  
  constructor(config: DeepgramSTTConfig) {
    super()
    this.config = config
    this.client = createClient(config.apiKey)
  }
  
  async start(format?: AudioFormat): Promise<void> {
    if (this.connection) {
      await this.stop()
    }
    
    this.connection = this.client.listen.live({
      model: this.config.model || 'nova-3',
      language: this.config.language || 'multi',
      smart_format: true,
      punctuate: this.config.punctuate ?? true,
      interim_results: this.config.interimResults ?? true,
      utterance_end_ms: 2000,
      endpointing: typeof this.config.endpointing === 'boolean' ? (this.config.endpointing ? 1500 : false) : (this.config.endpointing ?? 1500),
      encoding: format?.encoding === 'linear16' ? 'linear16' : 'linear16',
      sample_rate: format?.sampleRate || 16000,
      channels: format?.channels || 1,
    })
    
    // Wait for connection to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Deepgram connection timeout'))
      }, 10000)
      
      this.connection!.on(LiveTranscriptionEvents.Open, () => {
        this.active = true
        clearTimeout(timeout)
        console.log('[Deepgram] Connection opened')
        resolve()
      })
      
      this.connection!.on(LiveTranscriptionEvents.Error, (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
    
    this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel?.alternatives?.[0]
      if (transcript && transcript.transcript) {
        console.log('[Deepgram] Transcript:', transcript.transcript, data.is_final ? '(final)' : '(interim)')
        this.emit('transcript', {
          text: transcript.transcript,
          isFinal: data.is_final || false,
          confidence: transcript.confidence,
          words: transcript.words?.map((w: { word: string; start: number; end: number; confidence: number }) => ({
            word: w.word,
            start: w.start,
            end: w.end,
            confidence: w.confidence,
          })),
        })
      }
    })
    
    this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      // Emit an end-of-utterance signal
      this.emit('transcript', {
        text: '',
        isFinal: true,
      })
    })
    
    this.connection.on(LiveTranscriptionEvents.Error, (error) => {
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
    })
    
    this.connection.on(LiveTranscriptionEvents.Close, () => {
      this.active = false
      this.emit('end')
    })
  }
  
  send(audio: Buffer): void {
    if (this.connection && this.active) {
      // Convert Buffer to ArrayBuffer for Deepgram
      const arrayBuffer = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength)
      this.connection.send(arrayBuffer as ArrayBuffer)
    } else {
      console.log('[Deepgram] Audio received but connection not ready:', { hasConnection: !!this.connection, active: this.active })
    }
  }
  
  async stop(): Promise<void> {
    if (this.connection) {
      this.connection.requestClose()
      this.connection = null
      this.active = false
    }
  }
  
  isActive(): boolean {
    return this.active
  }
}
