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
  private pendingRequests = new Map<number, { resolve: (data: unknown) => void; reject: (err: Error) => void }>()
  
  constructor(config: ClawdbotLLMConfig) {
    super()
    this.config = config
  }
  
  private async ensureConnection(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return
    }
    
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.gatewayUrl)
      url.searchParams.set('token', this.config.token)
      
      this.ws = new WebSocket(url.toString())
      
      const timeout = setTimeout(() => {
        reject(new Error('Gateway connection timeout'))
      }, 10000)
      
      this.ws.on('open', () => {
        clearTimeout(timeout)
        console.log('[Clawdbot] Gateway connected')
        resolve()
      })
      
      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString())
          this.handleMessage(msg)
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
      })
    })
  }
  
  private handleMessage(msg: Record<string, unknown>): void {
    // Handle JSON-RPC response
    if (typeof msg.id === 'number' && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!
      this.pendingRequests.delete(msg.id)
      
      if (msg.error) {
        pending.reject(new Error(String((msg.error as Record<string, unknown>).message || msg.error)))
      } else {
        pending.resolve(msg.result)
      }
      return
    }
    
    // Handle streaming response chunks
    if (msg.method === 'chat.chunk') {
      const params = msg.params as Record<string, unknown>
      const chunk = params.text as string
      if (chunk) {
        this.fullResponse += chunk
        this.emit('token', chunk)
      }
    }
    
    // Handle complete response
    if (msg.method === 'chat.complete' || msg.method === 'chat.response') {
      const params = msg.params as Record<string, unknown>
      const text = (params.text as string) || this.fullResponse
      
      this.active = false
      this.emit('complete', text)
      
      if (this.currentResolve) {
        this.currentResolve(text)
        this.currentResolve = null
        this.currentReject = null
      }
    }
    
    // Handle error
    if (msg.method === 'chat.error') {
      const params = msg.params as Record<string, unknown>
      const error = new Error(params.message as string || 'Unknown error')
      
      this.active = false
      this.emit('error', error)
      
      if (this.currentReject) {
        this.currentReject(error)
        this.currentResolve = null
        this.currentReject = null
      }
    }
  }
  
  private async sendRpc(method: string, params: Record<string, unknown>): Promise<unknown> {
    await this.ensureConnection()
    
    const id = ++this.messageId
    
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
      
      this.ws!.send(JSON.stringify({
        jsonrpc: '2.0',
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
      this.sendRpc('chat.send', {
        text: lastUserMessage.content,
        sessionKey: this.config.sessionKey,
        stream: true,  // Request streaming response
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
