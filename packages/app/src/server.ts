import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { createNodeWebSocket } from '@hono/node-ws'
import type { WSContext } from 'hono/ws'
import {
  VoiceSession,
  DeepgramSTT,
  EdgeTTS,
  ElevenLabsTTS,
  ClaudeLLM,
  ClawdbotLLM,
  type ServerMessage,
  type LLMAdapter,
  type TTSAdapter,
  type STTAdapter,
} from '@for-the-people/voice-core'

const app = new Hono()
app.use('/*', cors())

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

const sessions = new Map<string, VoiceSession>()

app.get('/health', (c) => c.json({ status: 'ok' }))

// --- Types for client config ---
interface ClientConfig {
  stt: { provider: string; language?: string; model?: string }
  llm: { provider: string; model?: string; language?: string; systemPrompt?: string }
  tts: { enabled: boolean; provider: string; voice?: string; speed?: number }
}

interface ClientKeys {
  deepgram?: string
  anthropic?: string
  openai?: string
  elevenlabs?: string
  clawdbotGatewayUrl?: string
  clawdbotToken?: string
}

interface StartMessage {
  type: 'start'
  config: ClientConfig
  keys: ClientKeys
}

// --- Adapter factories ---
function createSTT(config: ClientConfig['stt'], keys: ClientKeys): STTAdapter {
  if (config.provider !== 'deepgram') {
    throw new Error(`STT provider "${config.provider}" is not yet supported. Use Deepgram.`)
  }
  if (!keys.deepgram) throw new Error('Missing Deepgram API key')
  return new DeepgramSTT({
    apiKey: keys.deepgram,
    language: config.language || 'multi',
    interimResults: true,
  })
}

function createLLM(config: ClientConfig['llm'], keys: ClientKeys): LLMAdapter {
  switch (config.provider) {
    case 'clawdbot':
      if (!keys.clawdbotGatewayUrl || !keys.clawdbotToken) {
        throw new Error('Missing Clawdbot gateway URL or token')
      }
      return new ClawdbotLLM({
        gatewayUrl: keys.clawdbotGatewayUrl,
        token: keys.clawdbotToken,
      })
    case 'claude':
      if (!keys.anthropic) throw new Error('Missing Anthropic API key')
      return new ClaudeLLM({
        apiKey: keys.anthropic,
        model: config.model,
        language: config.language || 'nl-NL',
        systemPrompt: config.systemPrompt,
      })
    default:
      throw new Error(`LLM provider "${config.provider}" is not yet supported. Use Clawdbot or Claude.`)
  }
}

function createTTS(config: ClientConfig['tts'], keys: ClientKeys): TTSAdapter {
  switch (config.provider) {
    case 'edge':
      return new EdgeTTS({
        voice: config.voice || 'nl-NL-MaartenNeural',
      })
    case 'elevenlabs':
      if (!keys.elevenlabs) throw new Error('Missing ElevenLabs API key')
      return new ElevenLabsTTS({
        apiKey: keys.elevenlabs,
        voiceId: config.voice || '21m00Tcm4TlvDq8ikWAM',
      })
    default:
      throw new Error(`TTS provider "${config.provider}" is not yet supported. Use Edge TTS or ElevenLabs.`)
  }
}

// --- WebSocket endpoint ---
app.get(
  '/ws',
  upgradeWebSocket(() => {
    let session: VoiceSession | null = null
    const sessionId = crypto.randomUUID()

    return {
      onOpen(_event, ws) {
        console.log(`[${sessionId}] Connected`)
        sendMessage(ws, { type: 'ready' })
      },

      async onMessage(event, ws) {
        try {
          // Binary audio data
          if (event.data instanceof ArrayBuffer || Buffer.isBuffer(event.data)) {
            if (session) {
              const buffer = Buffer.isBuffer(event.data) ? event.data : Buffer.from(event.data)
              session.sendAudio(buffer)
            }
            return
          }

          const message = JSON.parse(String(event.data))

          switch (message.type) {
            case 'start': {
              if (session) {
                await session.stop()
                sessions.delete(sessionId)
              }

              const { config, keys } = message as StartMessage
              if (!config) throw new Error('Missing config in start message')
              if (!keys) throw new Error('Missing keys in start message')

              console.log(`[${sessionId}] Creating session: STT=${config.stt.provider} LLM=${config.llm.provider} TTS=${config.tts.provider}`)

              const stt = createSTT(config.stt, keys)
              const llm = createLLM(config.llm, keys)
              const tts = createTTS(config.tts, keys)

              session = new VoiceSession({ stt, tts, llm, config: { language: config.llm.language || 'nl-NL', interruptEnabled: true } })

              session.on('state', (state) => sendMessage(ws, { type: 'state', state }))
              session.on('transcript', (text, isFinal, role) => sendMessage(ws, { type: 'transcript', text, isFinal, role }))
              session.on('audio', (chunk) => ws.send(new Uint8Array(chunk)))
              session.on('error', (error) => {
                console.error(`[${sessionId}] Error:`, error)
                sendMessage(ws, { type: 'error', message: error.message })
              })
              session.on('end', () => console.log(`[${sessionId}] Session ended`))

              sessions.set(sessionId, session)
              await session.start()
              console.log(`[${sessionId}] Session started`)
              break
            }

            case 'stop':
              if (session) {
                await session.stop()
                sessions.delete(sessionId)
                session = null
              }
              break

            case 'audio':
              if (session && message.data) {
                session.sendAudio(Buffer.from(message.data, 'base64'))
              }
              break

            case 'interrupt':
              if (session) session.stop()
              break
          }
        } catch (error) {
          console.error(`[${sessionId}] Error:`, error)
          sendMessage(ws, { type: 'error', message: error instanceof Error ? error.message : 'Unknown error' })
        }
      },

      async onClose() {
        console.log(`[${sessionId}] Disconnected`)
        if (session) {
          await session.stop()
          sessions.delete(sessionId)
        }
      },

      onError(event) {
        console.error(`[${sessionId}] WS error:`, event)
      },
    }
  })
)

// Serve static files
app.use('/*', serveStatic({ root: './public' }))

function sendMessage(ws: WSContext, message: ServerMessage) {
  ws.send(JSON.stringify(message))
}

const PORT = parseInt(process.env.PORT || '3456')
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🎤 VoiceKit app running at http://localhost:${info.port}`)
})
injectWebSocket(server)
