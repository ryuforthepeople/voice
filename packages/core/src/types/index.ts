/**
 * Voice Interface Types
 */

// Session states
export type SessionState = 
  | 'idle'        // Waiting to start
  | 'listening'   // User speaking, STT active
  | 'processing'  // Claude thinking
  | 'speaking'    // TTS playing audio
  | 'interrupted' // User interrupted AI

// Conversation turn
export interface Turn {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// Voice session config
export interface VoiceSessionConfig {
  // Language
  language?: 'nl-NL' | 'en-US'
  
  // Behavior
  interruptEnabled?: boolean  // Default: true
  silenceTimeout?: number     // Ms silence = end of utterance
  
  // Context for LLM
  systemPrompt?: string
}

// Client → Server messages
export type ClientMessage = 
  | { type: 'start' }
  | { type: 'audio'; data: string } // base64 encoded
  | { type: 'stop' }
  | { type: 'interrupt' }

// Server → Client messages
export type ServerMessage =
  | { type: 'state'; state: SessionState }
  | { type: 'transcript'; text: string; isFinal: boolean; role: 'user' | 'assistant' }
  | { type: 'audio'; data: string } // base64 encoded
  | { type: 'error'; message: string }
  | { type: 'ready' }

// Audio format
export interface AudioFormat {
  sampleRate: number
  channels: number
  encoding: 'linear16' | 'mulaw' | 'mp3'
}

// STT result
export interface TranscriptionResult {
  text: string
  isFinal: boolean
  confidence?: number
  words?: Array<{
    word: string
    start: number
    end: number
    confidence: number
  }>
}

// Events emitted by session
export interface SessionEvents {
  state: (state: SessionState) => void
  transcript: (text: string, isFinal: boolean, role: 'user' | 'assistant') => void
  audio: (chunk: Buffer) => void
  error: (error: Error) => void
  end: () => void
}
