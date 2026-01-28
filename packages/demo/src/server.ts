import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from root .env
config({ path: resolve(import.meta.dirname, '../../../.env') })

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
  type ClientMessage,
  type ServerMessage,
  type SessionState,
  type LLMAdapter,
  type TTSAdapter,
} from '@for-the-people/voice-core'

// Environment variables
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const CLAWDBOT_GATEWAY_URL = process.env.CLAWDBOT_GATEWAY_URL
const CLAWDBOT_TOKEN = process.env.CLAWDBOT_TOKEN
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// Mode: 'clawdbot' or 'standalone'
const MODE = CLAWDBOT_GATEWAY_URL && CLAWDBOT_TOKEN ? 'clawdbot' : 'standalone'

if (!DEEPGRAM_API_KEY) {
  console.error('Missing DEEPGRAM_API_KEY environment variable')
  process.exit(1)
}

if (MODE === 'standalone' && !ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY environment variable (required for standalone mode)')
  console.error('Or set CLAWDBOT_GATEWAY_URL and CLAWDBOT_TOKEN for Clawdbot mode')
  process.exit(1)
}

console.log(`Mode: ${MODE}`)
if (MODE === 'clawdbot') {
  console.log(`Gateway: ${CLAWDBOT_GATEWAY_URL}`)
}

const app = new Hono()

// Enable CORS
app.use('/*', cors())

// WebSocket setup
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

// Track active sessions
const sessions = new Map<string, VoiceSession>()

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// WebSocket endpoint for voice
app.get(
  '/ws',
  upgradeWebSocket(() => {
    let session: VoiceSession | null = null
    let sessionId = crypto.randomUUID()
    
    return {
      onOpen(event, ws) {
        console.log(`[${sessionId}] WebSocket connected`)
        sendMessage(ws, { type: 'ready' })
      },
      
      async onMessage(event, ws) {
        try {
          // Handle binary audio data
          if (event.data instanceof ArrayBuffer || Buffer.isBuffer(event.data)) {
            if (session) {
              const buffer = Buffer.isBuffer(event.data) 
                ? event.data 
                : Buffer.from(event.data)
              session.sendAudio(buffer)
            }
            return
          }
          
          // Handle text messages
          const message: ClientMessage = JSON.parse(String(event.data))
          
          switch (message.type) {
            case 'start':
              if (session) {
                await session.stop()
              }
              
              // Create adapters
              const stt = new DeepgramSTT({
                apiKey: DEEPGRAM_API_KEY!,
                language: 'multi', // Auto-detect
                interimResults: true,
              })
              
              // Create TTS adapter - prefer ElevenLabs if available
              let tts: TTSAdapter
              if (ELEVENLABS_API_KEY) {
                tts = new ElevenLabsTTS({
                  apiKey: ELEVENLABS_API_KEY,
                  voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel - calm female
                })
                console.log(`[${sessionId}] Using ElevenLabs TTS`)
              } else {
                tts = new EdgeTTS({
                  voice: 'nl-NL-MaartenNeural',
                })
                console.log(`[${sessionId}] Using Edge TTS`)
              }
              
              // Create LLM adapter based on mode
              let llm: LLMAdapter
              if (MODE === 'clawdbot') {
                llm = new ClawdbotLLM({
                  gatewayUrl: CLAWDBOT_GATEWAY_URL!,
                  token: CLAWDBOT_TOKEN!,
                })
                console.log(`[${sessionId}] Using Clawdbot mode`)
              } else {
                llm = new ClaudeLLM({
                  apiKey: ANTHROPIC_API_KEY!,
                  language: 'nl-NL',
                })
                console.log(`[${sessionId}] Using standalone Claude mode`)
              }
              
              // Create session
              session = new VoiceSession({
                stt,
                tts,
                llm,
                config: {
                  language: 'nl-NL',
                  interruptEnabled: true,
                },
              })
              
              // Wire up events
              session.on('state', (state) => {
                sendMessage(ws, { type: 'state', state })
              })
              
              session.on('transcript', (text, isFinal, role) => {
                sendMessage(ws, { type: 'transcript', text, isFinal, role })
              })
              
              session.on('audio', (chunk) => {
                // Send audio as binary - convert Buffer to Uint8Array
                ws.send(new Uint8Array(chunk))
              })
              
              session.on('error', (error) => {
                console.error(`[${sessionId}] Error:`, error)
                sendMessage(ws, { type: 'error', message: error.message })
              })
              
              session.on('end', () => {
                console.log(`[${sessionId}] Session ended`)
              })
              
              // Store and start
              sessions.set(sessionId, session)
              await session.start()
              
              console.log(`[${sessionId}] Session started`)
              break
              
            case 'stop':
              if (session) {
                await session.stop()
                sessions.delete(sessionId)
                session = null
              }
              break
              
            case 'audio':
              // Base64 encoded audio from JSON message
              if (session && message.data) {
                const buffer = Buffer.from(message.data, 'base64')
                session.sendAudio(buffer)
              }
              break
              
            case 'interrupt':
              // Manual interrupt trigger
              if (session) {
                session.stop()
              }
              break
          }
        } catch (error) {
          console.error(`[${sessionId}] Message error:`, error)
          sendMessage(ws, { 
            type: 'error', 
            message: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
      },
      
      async onClose(event, ws) {
        console.log(`[${sessionId}] WebSocket closed`)
        if (session) {
          await session.stop()
          sessions.delete(sessionId)
        }
      },
      
      onError(event, ws) {
        console.error(`[${sessionId}] WebSocket error:`, event)
      },
    }
  })
)

// Serve static files
app.use('/*', serveStatic({ root: './public' }))

// Helper to send typed messages
function sendMessage(ws: WSContext, message: ServerMessage) {
  ws.send(JSON.stringify(message))
}

// Start server
const PORT = parseInt(process.env.PORT || '3456')

const server = serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`🎤 Voice server running at http://localhost:${info.port}`)
  console.log(`   WebSocket endpoint: ws://localhost:${info.port}/ws`)
})

injectWebSocket(server)
