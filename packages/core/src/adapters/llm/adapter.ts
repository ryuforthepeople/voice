import { EventEmitter } from 'eventemitter3'
import type { Turn } from '../../types/index.js'

export interface LLMEvents {
  token: (token: string) => void
  complete: (text: string) => void
  error: (error: Error) => void
}

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export abstract class LLMAdapter extends EventEmitter<LLMEvents> {
  abstract readonly name: string
  
  /**
   * Generate a response (streaming)
   */
  abstract generate(
    messages: LLMMessage[],
    systemPrompt?: string
  ): Promise<string>
  
  /**
   * Stop current generation
   */
  abstract stop(): void
  
  /**
   * Check if currently generating
   */
  abstract isActive(): boolean
}
