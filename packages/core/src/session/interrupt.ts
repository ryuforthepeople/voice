import type { SessionState } from '../types/index.js'

export interface InterruptConfig {
  enabled: boolean
  // Minimum audio level to trigger interrupt detection
  minAudioLevel?: number
  // Minimum duration of speech to trigger interrupt (ms)
  minDuration?: number
}

export class InterruptHandler {
  private config: InterruptConfig
  private speechStart: number | null = null
  
  constructor(config: Partial<InterruptConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      minAudioLevel: config.minAudioLevel ?? 0.01,
      minDuration: config.minDuration ?? 200,
    }
  }
  
  /**
   * Check if user speech should interrupt AI
   */
  shouldInterrupt(currentState: SessionState, hasSpeech: boolean): boolean {
    if (!this.config.enabled) return false
    
    // Only interrupt when AI is speaking
    if (currentState !== 'speaking') {
      this.speechStart = null
      return false
    }
    
    if (hasSpeech) {
      if (this.speechStart === null) {
        this.speechStart = Date.now()
      }
      
      // Check if speech has been long enough
      const duration = Date.now() - this.speechStart
      return duration >= this.config.minDuration!
    } else {
      // Reset when no speech
      this.speechStart = null
      return false
    }
  }
  
  /**
   * Reset interrupt detection
   */
  reset(): void {
    this.speechStart = null
  }
  
  /**
   * Update config
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }
}
