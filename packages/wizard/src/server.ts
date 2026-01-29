import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'

const app = new Hono()
app.use('/*', cors())

// --- Proxy verification endpoints ---

app.post('/api/verify/deepgram', async (c) => {
  const { apiKey } = await c.req.json()
  try {
    const res = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${apiKey}` },
    })
    if (res.ok) return c.json({ valid: true })
    return c.json({ valid: false, error: `HTTP ${res.status}` })
  } catch (e: any) {
    return c.json({ valid: false, error: e.message })
  }
})

app.post('/api/verify/anthropic', async (c) => {
  const { apiKey } = await c.req.json()
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    // 200 or 400 (bad request but auth ok) both mean key works
    if (res.ok || res.status === 400) return c.json({ valid: true })
    return c.json({ valid: false, error: `HTTP ${res.status}` })
  } catch (e: any) {
    return c.json({ valid: false, error: e.message })
  }
})

app.post('/api/verify/elevenlabs', async (c) => {
  const { apiKey } = await c.req.json()
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': apiKey },
    })
    if (res.ok) return c.json({ valid: true })
    return c.json({ valid: false, error: `HTTP ${res.status}` })
  } catch (e: any) {
    return c.json({ valid: false, error: e.message })
  }
})

app.post('/api/verify/openai', async (c) => {
  const { apiKey } = await c.req.json()
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (res.ok) return c.json({ valid: true })
    return c.json({ valid: false, error: `HTTP ${res.status}` })
  } catch (e: any) {
    return c.json({ valid: false, error: e.message })
  }
})

// --- Voices endpoint ---

app.get('/api/voices/:provider', async (c) => {
  const provider = c.req.param('provider')
  const apiKey = c.req.header('x-api-key') || ''

  if (provider === 'elevenlabs' && apiKey) {
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey },
      })
      if (res.ok) {
        const data = await res.json()
        return c.json(data)
      }
    } catch {}
  }

  if (provider === 'openai') {
    return c.json({
      voices: [
        { voice_id: 'alloy', name: 'Alloy' },
        { voice_id: 'echo', name: 'Echo' },
        { voice_id: 'fable', name: 'Fable' },
        { voice_id: 'onyx', name: 'Onyx' },
        { voice_id: 'nova', name: 'Nova' },
        { voice_id: 'shimmer', name: 'Shimmer' },
      ],
    })
  }

  if (provider === 'edge') {
    return c.json({
      voices: [
        { voice_id: 'nl-NL-MaartenNeural', name: 'Maarten (NL)', lang: 'nl-NL' },
        { voice_id: 'nl-NL-ColetteNeural', name: 'Colette (NL)', lang: 'nl-NL' },
        { voice_id: 'en-US-GuyNeural', name: 'Guy (EN)', lang: 'en-US' },
        { voice_id: 'en-US-JennyNeural', name: 'Jenny (EN)', lang: 'en-US' },
        { voice_id: 'en-GB-RyanNeural', name: 'Ryan (EN-GB)', lang: 'en-GB' },
        { voice_id: 'en-GB-SoniaNeural', name: 'Sonia (EN-GB)', lang: 'en-GB' },
        { voice_id: 'de-DE-ConradNeural', name: 'Conrad (DE)', lang: 'de-DE' },
        { voice_id: 'fr-FR-HenriNeural', name: 'Henri (FR)', lang: 'fr-FR' },
      ],
    })
  }

  return c.json({ voices: [] })
})

// --- TTS preview proxy ---

app.post('/api/tts/preview', async (c) => {
  const { provider, apiKey, voiceId, text } = await c.req.json()
  const previewText = text || 'Hello, this is a voice preview.'

  try {
    if (provider === 'elevenlabs' && apiKey) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text: previewText, model_id: 'eleven_multilingual_v2' }),
      })
      if (res.ok) {
        const buf = await res.arrayBuffer()
        return new Response(buf, { headers: { 'content-type': 'audio/mpeg' } })
      }
      return c.json({ error: `HTTP ${res.status}` }, 400)
    }

    if (provider === 'openai' && apiKey) {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'tts-1', voice: voiceId, input: previewText }),
      })
      if (res.ok) {
        const buf = await res.arrayBuffer()
        return new Response(buf, { headers: { 'content-type': 'audio/mpeg' } })
      }
      return c.json({ error: `HTTP ${res.status}` }, 400)
    }

    return c.json({ error: 'Preview not available for this provider' }, 400)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Serve static files
app.use('/*', serveStatic({ root: './public' }))

const PORT = parseInt(process.env.PORT || '3457')
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🧙 Voice Setup Wizard running at http://localhost:${info.port}`)
})
