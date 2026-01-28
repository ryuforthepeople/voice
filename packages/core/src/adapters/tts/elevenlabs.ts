import { TTSAdapter } from './adapter.js'

export interface ElevenLabsTTSConfig {
  apiKey: string
  voiceId?: string        // Default: 'pNInz6obpgDQGcFmaJgB' (Adam)
  modelId?: string        // Default: 'eleven_multilingual_v2'
  stability?: number      // 0-1, default 0.5
  similarityBoost?: number // 0-1, default 0.75
}

// Popular voice IDs
export const ELEVENLABS_VOICES = {
  // Multilingual
  ADAM: 'pNInz6obpgDQGcFmaJgB',       // Deep male
  RACHEL: '21m00Tcm4TlvDq8ikWAM',      // Calm female
  DOMI: 'AZnzlk1XvdvUeBnXmlld',        // Strong female
  BELLA: 'EXAVITQu4vr4xnSDxMaL',       // Soft female
  ANTONI: 'ErXwobaYiN019PkySvjV',      // Well-rounded male
  ELLI: 'MF3mGyEYCl7XYWbV9V6O',        // Young female
  JOSH: 'TxGEqnHWrfWFTfGW9XjX',        // Deep male
  ARNOLD: 'VR6AewLTigWG4xSOukaG',      // Crisp male
  SAM: 'yoZ06aMxZJJ28mfd3POQ',         // Young male
}

export class ElevenLabsTTS extends TTSAdapter {
  readonly name = 'elevenlabs'
  
  private config: ElevenLabsTTSConfig
  private abortController: AbortController | null = null
  
  constructor(config: ElevenLabsTTSConfig) {
    super()
    this.config = config
  }
  
  async synthesize(text: string): Promise<void> {
    if (!text.trim()) return
    
    const voiceId = this.config.voiceId || ELEVENLABS_VOICES.ADAM
    const modelId = this.config.modelId || 'eleven_multilingual_v2'
    
    this.abortController = new AbortController()
    
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.config.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: this.config.stability ?? 0.5,
              similarity_boost: this.config.similarityBoost ?? 0.75,
            },
          }),
          signal: this.abortController.signal,
        }
      )
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`ElevenLabs API error: ${response.status} ${error}`)
      }
      
      if (!response.body) {
        throw new Error('No response body')
      }
      
      // Accumulate all chunks into one complete MP3 buffer
      // (client expects complete MP3 segments for playback)
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }
      
      // Emit as one complete MP3
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      
      this.emit('audio', Buffer.from(combined))
      this.emit('end')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('[ElevenLabs] Synthesis aborted')
        return
      }
      this.emit('error', err instanceof Error ? err : new Error(String(err)))
    } finally {
      this.abortController = null
    }
  }
  
  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
  
  isActive(): boolean {
    return this.abortController !== null
  }
  
  getVoices(): string[] {
    return Object.keys(ELEVENLABS_VOICES)
  }
}
