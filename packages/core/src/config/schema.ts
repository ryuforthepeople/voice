export interface VoiceKitConfig {
  stt: {
    provider: 'deepgram' | 'google' | 'azure' | 'whisper'
    language: string
    model?: string
  }
  llm: {
    provider: 'claude' | 'gpt' | 'gemini' | 'ollama' | 'clawdbot'
    model?: string
    language?: string
    systemPrompt?: string
  }
  tts: {
    enabled: boolean
    provider: 'edge' | 'elevenlabs' | 'openai-tts'
    voice?: string
    speed?: number
  }
}

export interface VoiceKitKeys {
  deepgram?: string
  anthropic?: string
  openai?: string
  elevenlabs?: string
  google?: string
  azure?: string
  clawdbotGatewayUrl?: string
  clawdbotToken?: string
}

export function defineConfig(config: VoiceKitConfig): VoiceKitConfig {
  return config
}
