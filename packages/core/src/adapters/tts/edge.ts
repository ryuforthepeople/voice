import { TTSAdapter } from './adapter.js'
import { tts as edgeTTS, type options as EdgeTTSOptions } from 'edge-tts'

// Edge TTS voices
const VOICES = {
  'nl-NL': {
    male: 'nl-NL-MaartenNeural',
    female: 'nl-NL-ColetteNeural',
  },
  'en-US': {
    male: 'en-US-GuyNeural', 
    female: 'en-US-JennyNeural',
  },
} as const

export interface EdgeTTSConfig {
  voice?: string
  rate?: string  // e.g., '+10%', '-10%'
  volume?: string // e.g., '+10%', '-10%'
  pitch?: string  // e.g., '+10Hz', '-10Hz'
}

export class EdgeTTS extends TTSAdapter {
  readonly name = 'edge-tts'
  
  private config: EdgeTTSConfig
  private active = false
  private aborted = false
  
  constructor(config: EdgeTTSConfig = {}) {
    super()
    this.config = {
      voice: config.voice || VOICES['nl-NL'].male,
      rate: config.rate || '+0%',
      volume: config.volume || '+0%',
      pitch: config.pitch || '+0Hz',
    }
  }
  
  async synthesize(text: string, voice?: string): Promise<void> {
    if (this.active) {
      this.stop()
    }
    
    this.active = true
    this.aborted = false
    
    const selectedVoice = voice || this.config.voice!
    
    try {
      this.emit('start')
      
      const options: EdgeTTSOptions = {
        voice: selectedVoice,
        rate: this.config.rate,
        volume: this.config.volume,
        pitch: this.config.pitch,
      }
      
      // Get the full audio buffer
      const audioBuffer = await edgeTTS(text, options)
      
      if (this.aborted) {
        return
      }
      
      // Emit audio in chunks for streaming
      const chunkSize = 4096
      for (let i = 0; i < audioBuffer.length && !this.aborted; i += chunkSize) {
        const chunk = audioBuffer.subarray(i, Math.min(i + chunkSize, audioBuffer.length))
        this.emit('audio', Buffer.from(chunk))
      }
      
      this.active = false
      this.emit('end')
    } catch (error) {
      this.active = false
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }
  
  stop(): void {
    this.aborted = true
    this.active = false
  }
  
  isActive(): boolean {
    return this.active
  }
  
  getVoices(): string[] {
    return [
      VOICES['nl-NL'].male,
      VOICES['nl-NL'].female,
      VOICES['en-US'].male,
      VOICES['en-US'].female,
    ]
  }
  
  static getVoiceForLanguage(language: 'nl-NL' | 'en-US', gender: 'male' | 'female' = 'male'): string {
    return VOICES[language][gender]
  }
}
