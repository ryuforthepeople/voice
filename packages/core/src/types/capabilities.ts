/**
 * Provider capabilities
 */

export interface STTCapabilities {
  name: string
  streaming: boolean
  languages: string[]
  diarization: boolean
  punctuation: boolean
  wordTimestamps: boolean
}

export interface TTSCapabilities {
  name: string
  streaming: boolean
  voices: string[]
  languages: string[]
  ssml: boolean
  emotions: boolean
}

export interface LLMCapabilities {
  name: string
  streaming: boolean
  maxTokens: number
  functionCalling: boolean
  vision: boolean
}

// Provider info
export const PROVIDERS = {
  stt: {
    deepgram: {
      name: 'Deepgram Nova-3',
      streaming: true,
      languages: ['nl', 'en', 'de', 'fr', 'es'],
      diarization: true,
      punctuation: true,
      wordTimestamps: true,
    } satisfies STTCapabilities,
  },
  tts: {
    edge: {
      name: 'Edge TTS',
      streaming: true,
      voices: ['nl-NL-MaartenNeural', 'nl-NL-ColetteNeural', 'en-US-GuyNeural', 'en-US-JennyNeural'],
      languages: ['nl-NL', 'en-US'],
      ssml: true,
      emotions: false,
    } satisfies TTSCapabilities,
  },
  llm: {
    claude: {
      name: 'Claude',
      streaming: true,
      maxTokens: 8192,
      functionCalling: true,
      vision: true,
    } satisfies LLMCapabilities,
  },
} as const
