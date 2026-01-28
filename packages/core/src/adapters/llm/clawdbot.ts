import { LLMAdapter } from './adapter.js'
import type { LLMMessage } from './adapter.js'
import WebSocket from 'ws'

export interface ClawdbotLLMConfig {
  gatewayUrl: string      // ws://localhost:18789 or wss://...
  token: string           // Gateway auth token
  sessionKey?: string     // Optional: specific session
}

export class ClawdbotLLM extends LLMAdapter {
  readonly name = 'clawdbot'
  
  private config: ClawdbotLLMConfig
  private ws: WebSocket | null = null
  private active = false
  private currentResolve: ((text: string) => void) | null = null
  private currentReject: ((error: Error) => void) | null = null
  private fullResponse = ''
  private messageId = 0
  private pendingRequests = new Map<string, { resolve: (data: unknown) => void; reject: (err: Error) => void }>()
  
  constructor(config: ClawdbotLLMConfig) {
    super()
    this.config = config
  }
  
  private connected = false
  private connectResolve: (() => void) | null = null
  private connectReject: ((err: Error) => void) | null = null
  
  private async ensureConnection(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connected) {
      return
    }
    
    return new Promise((resolve, reject) => {
      this.connectResolve = resolve
      this.connectReject = reject
      this.connected = false
      
      const url = new URL(this.config.gatewayUrl)
      
      this.ws = new WebSocket(url.toString())
      
      const timeout = setTimeout(() => {
        reject(new Error('Gateway connection timeout'))
      }, 15000)
      
      this.ws.on('open', () => {
        console.log('[Clawdbot] WebSocket opened, waiting for challenge...')
        // Don't resolve yet - wait for handshake to complete
      })
      
      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString())
          this.handleProtocolMessage(msg, timeout, resolve, reject)
        } catch (err) {
          console.error('[Clawdbot] Failed to parse message:', err)
        }
      })
      
      this.ws.on('error', (err: Error) => {
        clearTimeout(timeout)
        console.error('[Clawdbot] WebSocket error:', err)
        reject(err)
      })
      
      this.ws.on('close', () => {
        console.log('[Clawdbot] Gateway disconnected')
        this.ws = null
        this.connected = false
      })
    })
  }
  
  private handleProtocolMessage(
    msg: Record<string, unknown>,
    timeout: ReturnType<typeof setTimeout>,
    resolve: () => void,
    reject: (err: Error) => void
  ): void {
    // Handle connect.challenge - need to respond with connect request
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      console.log('[Clawdbot] Received challenge, sending connect...')
      const payload = msg.payload as Record<string, unknown>
      
      // Send connect request - use "webchat" as client ID and mode (allowed by Gateway)
      this.ws!.send(JSON.stringify({
        type: 'req',
        id: 'connect-1',
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'webchat',
            version: '0.1.0',
            platform: 'node',
            mode: 'webchat',
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write'],
          caps: [],
          commands: [],
          permissions: {},
          auth: { token: this.config.token },
          locale: 'nl-NL',
          userAgent: 'voicekit/0.1.0',
        },
      }))
      return
    }
    
    // Handle connect response
    if (msg.type === 'res' && msg.id === 'connect-1') {
      clearTimeout(timeout)
      if (msg.ok) {
        console.log('[Clawdbot] Connected successfully!')
        this.connected = true
        resolve()
      } else {
        const error = msg.error as Record<string, unknown>
        reject(new Error(`Connect failed: ${error?.message || JSON.stringify(error)}`))
      }
      return
    }
    
    // Other messages go to the regular handler
    this.handleMessage(msg)
  }
  
  private handleMessage(msg: Record<string, unknown>): void {
    console.log('[Clawdbot] Received:', JSON.stringify(msg).slice(0, 200))
    
    // Handle response (ack for chat.send)
    if (typeof msg.id === 'string' && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!
      this.pendingRequests.delete(msg.id)
      
      if (msg.error) {
        pending.reject(new Error(String((msg.error as Record<string, unknown>).message || msg.error)))
      } else {
        // chat.send acks with { runId, status: "started" } - don't resolve yet
        const result = msg.result as Record<string, unknown>
        if (result?.status === 'started' || result?.status === 'in_flight') {
          console.log('[Clawdbot] Run started:', result.runId)
          // Don't resolve - wait for chat events
          return
        }
        pending.resolve(msg.result)
      }
      return
    }
    
    // Handle chat events (streaming response)
    // Format: { type: "event", event: "chat", payload: { state: "delta"|"final", message: { content: [{ type: "text", text: "..." }] } } }
    if (msg.type === 'event' && msg.event === 'chat') {
      const payload = msg.payload as Record<string, unknown>
      const state = payload.state as string
      const message = payload.message as Record<string, unknown>
      
      // Extract text from message.content[0].text
      let text = ''
      if (message?.content && Array.isArray(message.content)) {
        const textBlock = (message.content as Array<Record<string, unknown>>).find(c => c.type === 'text')
        if (textBlock) {
          text = textBlock.text as string || ''
        }
      }
      
      // Streaming delta
      if (state === 'delta' && text) {
        // Calculate the new delta (text contains full response so far)
        const delta = text.slice(this.fullResponse.length)
        if (delta) {
          this.fullResponse = text
          this.emit('token', delta)
        }
      }
      
      // Response complete
      if (state === 'final') {
        const finalText = text || this.fullResponse
        
        this.active = false
        this.emit('complete', finalText)
        
        if (this.currentResolve) {
          this.currentResolve(finalText)
          this.currentResolve = null
          this.currentReject = null
        }
      }
    }
    
  }
  
  private async sendRpc(method: string, params: Record<string, unknown>): Promise<unknown> {
    await this.ensureConnection()
    
    const id = `msg-${++this.messageId}`  // Must be string
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`RPC timeout: ${method}`))
      }, 60000)
      
      this.pendingRequests.set(id, {
        resolve: (data) => {
          clearTimeout(timeout)
          resolve(data)
        },
        reject: (err) => {
          clearTimeout(timeout)
          reject(err)
        },
      })
      
      // Gateway uses type: "req" format, not JSON-RPC
      this.ws!.send(JSON.stringify({
        type: 'req',
        id,
        method,
        params,
      }))
    })
  }
  
  async generate(
    messages: LLMMessage[],
    _systemPrompt?: string  // Ignored - Clawdbot has its own system prompt
  ): Promise<string> {
    await this.ensureConnection()
    
    this.active = true
    this.fullResponse = ''
    
    // Get the latest user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    if (!lastUserMessage) {
      throw new Error('No user message to send')
    }
    
    return new Promise((resolve, reject) => {
      this.currentResolve = resolve
      this.currentReject = reject
      
      // Send via chat.send - Clawdbot handles the rest
      // Params: sessionKey, message, idempotencyKey
      console.log('[Clawdbot] Sending:', lastUserMessage.content.slice(0, 50))
      this.sendRpc('chat.send', {
        sessionKey: this.config.sessionKey || 'agent:main',
        message: lastUserMessage.content,
        idempotencyKey: `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }).then(() => {
        console.log('[Clawdbot] Send acknowledged, waiting for response...')
      }).catch((err) => {
        this.active = false
        reject(err)
      })
    })
  }
  
  stop(): void {
    this.active = false
    // Could send a cancel request if Clawdbot supports it
  }
  
  isActive(): boolean {
    return this.active
  }
  
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
