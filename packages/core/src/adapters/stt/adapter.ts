import type { TranscriptionResult, AudioFormat } from '../../types/index.js'
import { EventEmitter } from 'eventemitter3'

export interface STTEvents {
  transcript: (result: TranscriptionResult) => void
  error: (error: Error) => void
  end: () => void
}

export abstract class STTAdapter extends EventEmitter<STTEvents> {
  abstract readonly name: string
  
  /**
   * Start streaming transcription
   */
  abstract start(format?: AudioFormat): Promise<void>
  
  /**
   * Send audio chunk for transcription
   */
  abstract send(audio: Buffer): void
  
  /**
   * Stop transcription
   */
  abstract stop(): Promise<void>
  
  /**
   * Check if currently transcribing
   */
  abstract isActive(): boolean
}
