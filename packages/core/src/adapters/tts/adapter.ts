import { EventEmitter } from 'eventemitter3'

export interface TTSEvents {
  audio: (chunk: Buffer) => void
  start: () => void
  end: () => void
  error: (error: Error) => void
}

export abstract class TTSAdapter extends EventEmitter<TTSEvents> {
  abstract readonly name: string
  
  /**
   * Synthesize text to speech
   * Returns a stream of audio chunks
   */
  abstract synthesize(text: string, voice?: string): Promise<void>
  
  /**
   * Stop current synthesis
   */
  abstract stop(): void
  
  /**
   * Check if currently synthesizing
   */
  abstract isActive(): boolean
  
  /**
   * Get available voices
   */
  abstract getVoices(): string[]
}
