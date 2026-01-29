import type { VoiceKitConfig, VoiceKitKeys } from './schema.js'
import { validateConfig } from './validate.js'
import { STTAdapter } from '../adapters/stt/adapter.js'
import { DeepgramSTT } from '../adapters/stt/deepgram.js'
import { TTSAdapter } from '../adapters/tts/adapter.js'
import { EdgeTTS } from '../adapters/tts/edge.js'
import { ElevenLabsTTS } from '../adapters/tts/elevenlabs.js'
import { LLMAdapter } from '../adapters/llm/adapter.js'
import { ClaudeLLM } from '../adapters/llm/claude.js'
import { ClawdbotLLM } from '../adapters/llm/clawdbot.js'

export interface VoiceKitAdapters {
  stt: STTAdapter
  llm: LLMAdapter
  tts?: TTSAdapter
}

export function createAdaptersFromConfig(config: VoiceKitConfig, keys: VoiceKitKeys): VoiceKitAdapters {
  const errors = validateConfig(config, keys)
  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.map(e => `  - ${e.field}: ${e.message}`).join('\n')}`)
  }

  // STT
  let stt: STTAdapter
  switch (config.stt.provider) {
    case 'deepgram':
      stt = new DeepgramSTT({
        apiKey: keys.deepgram!,
        model: config.stt.model,
        language: config.stt.language === 'multi' ? undefined : config.stt.language,
      })
      break
    default:
      throw new Error(`STT provider "${config.stt.provider}" is not yet supported. Coming soon!`)
  }

  // LLM
  let llm: LLMAdapter
  switch (config.llm.provider) {
    case 'claude':
      llm = new ClaudeLLM({
        apiKey: keys.anthropic!,
        model: config.llm.model,
        language: config.llm.language as 'nl-NL' | 'en-US' | undefined,
      })
      break
    case 'clawdbot':
      llm = new ClawdbotLLM({
        gatewayUrl: keys.clawdbotGatewayUrl!,
        token: keys.clawdbotToken!,
      })
      break
    default:
      throw new Error(`LLM provider "${config.llm.provider}" is not yet supported. Coming soon!`)
  }

  // TTS
  let tts: TTSAdapter | undefined
  if (config.tts.enabled) {
    switch (config.tts.provider) {
      case 'edge':
        tts = new EdgeTTS({
          voice: config.tts.voice,
          rate: config.tts.speed && config.tts.speed !== 1.0
            ? `${config.tts.speed > 1 ? '+' : ''}${Math.round((config.tts.speed - 1) * 100)}%`
            : undefined,
        })
        break
      case 'elevenlabs':
        tts = new ElevenLabsTTS({
          apiKey: keys.elevenlabs!,
          voiceId: config.tts.voice,
        })
        break
      default:
        throw new Error(`TTS provider "${config.tts.provider}" is not yet supported. Coming soon!`)
    }
  }

  return { stt, llm, tts }
}
