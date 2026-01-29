import type { VoiceKitConfig, VoiceKitKeys } from './schema.js'

export interface ValidationError {
  field: string
  message: string
}

export function validateConfig(config: VoiceKitConfig, keys: VoiceKitKeys): ValidationError[] {
  const errors: ValidationError[] = []

  // STT validation
  if (!config.stt?.provider) {
    errors.push({ field: 'stt.provider', message: 'STT provider is required' })
  }
  if (!config.stt?.language) {
    errors.push({ field: 'stt.language', message: 'STT language is required' })
  }
  if (config.stt?.provider === 'deepgram' && !keys.deepgram) {
    errors.push({ field: 'keys.deepgram', message: 'Deepgram API key is required for deepgram STT' })
  }
  if (config.stt?.provider === 'google' && !keys.google) {
    errors.push({ field: 'keys.google', message: 'Google API key is required for google STT' })
  }
  if (config.stt?.provider === 'azure' && !keys.azure) {
    errors.push({ field: 'keys.azure', message: 'Azure API key is required for azure STT' })
  }

  // LLM validation
  if (!config.llm?.provider) {
    errors.push({ field: 'llm.provider', message: 'LLM provider is required' })
  }
  if (config.llm?.provider === 'claude' && !keys.anthropic) {
    errors.push({ field: 'keys.anthropic', message: 'Anthropic API key is required for Claude LLM' })
  }
  if (config.llm?.provider === 'gpt' && !keys.openai) {
    errors.push({ field: 'keys.openai', message: 'OpenAI API key is required for GPT LLM' })
  }
  if (config.llm?.provider === 'clawdbot' && (!keys.clawdbotGatewayUrl || !keys.clawdbotToken)) {
    errors.push({ field: 'keys.clawdbot', message: 'Clawdbot gateway URL and token are required for Clawdbot LLM' })
  }

  // TTS validation
  if (config.tts?.enabled) {
    if (!config.tts.provider) {
      errors.push({ field: 'tts.provider', message: 'TTS provider is required when TTS is enabled' })
    }
    if (config.tts.provider === 'elevenlabs' && !keys.elevenlabs) {
      errors.push({ field: 'keys.elevenlabs', message: 'ElevenLabs API key is required for ElevenLabs TTS' })
    }
    if (config.tts.provider === 'openai-tts' && !keys.openai) {
      errors.push({ field: 'keys.openai', message: 'OpenAI API key is required for OpenAI TTS' })
    }
  }

  return errors
}
