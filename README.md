# Voice Interface MVP

Real-time voice conversations with AI using streaming STT, LLM, and TTS.

## Features

- 🎤 **Streaming STT** - Deepgram Nova-3 for real-time transcription
- 🤖 **AI Chat** - Claude for intelligent responses optimized for voice
- 🔊 **TTS** - Edge TTS for natural speech synthesis
- ⚡ **Low Latency** - Streaming everything for fast responses
- 🛑 **Interrupts** - User can interrupt AI mid-speech

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│  Voice Gateway  │────▶│   AI Services   │
│                 │◀────│     (Hono)      │◀────│                 │
│  - Microphone   │     │  - WebSocket    │     │  - Deepgram STT │
│  - Audio Player │     │  - Session Mgr  │     │  - Claude LLM   │
│  - Transcript   │     │  - Interrupt    │     │  - Edge TTS     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Deepgram API key
- Anthropic API key

### Install

```bash
cd voice
pnpm install
pnpm build
```

### Configure

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Add your API keys to `.env`:
```bash
# Get a Deepgram key at https://console.deepgram.com/
DEEPGRAM_API_KEY=your-deepgram-api-key

# Get an Anthropic key at https://console.anthropic.com/
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### Run

```bash
cd packages/demo
pnpm dev
```

Open http://localhost:3456 in your browser.

## Packages

### @for-the-people/voice-core

Core library with adapters and session management.

```typescript
import {
  VoiceSession,
  DeepgramSTT,
  EdgeTTS,
  ClaudeLLM,
} from '@for-the-people/voice-core'

// Create adapters
const stt = new DeepgramSTT({ apiKey: '...' })
const tts = new EdgeTTS({ voice: 'nl-NL-MaartenNeural' })
const llm = new ClaudeLLM({ apiKey: '...' })

// Create session
const session = new VoiceSession({ stt, tts, llm })

// Events
session.on('state', (state) => console.log('State:', state))
session.on('transcript', (text, isFinal, role) => console.log(role, text))
session.on('audio', (chunk) => playAudio(chunk))

// Start and send audio
await session.start()
session.sendAudio(audioBuffer)
```

### @for-the-people/voice-demo

Demo application with Hono WebSocket server and web client.

## WebSocket Protocol

### Client → Server

```typescript
// Start voice session
{ type: 'start' }

// Stop session
{ type: 'stop' }

// Audio data (also sent as raw binary)
{ type: 'audio', data: '<base64>' }
```

### Server → Client

```typescript
// Session state change
{ type: 'state', state: 'listening' | 'processing' | 'speaking' | 'idle' }

// Transcription (both user and assistant)
{ type: 'transcript', text: '...', isFinal: boolean, role: 'user' | 'assistant' }

// Audio chunk (sent as binary)
<ArrayBuffer>

// Error
{ type: 'error', message: '...' }
```

## Session States

```
idle ─────▶ listening ─────▶ processing ─────▶ speaking
  ▲              │                │                │
  │              │                │                │
  └──────────────┴────────────────┴────────────────┘
                        │
                        ▼
                  interrupted
```

## Cost Estimate

Per 10 minutes of conversation:

| Component | Cost |
|-----------|------|
| Deepgram STT | ~$0.04 |
| Claude LLM | ~$0.06 |
| Edge TTS | Free |
| **Total** | **~$0.10** |

## License

MIT
