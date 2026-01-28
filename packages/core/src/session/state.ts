import type { SessionState } from '../types/index.js'

/**
 * Valid state transitions
 */
const TRANSITIONS: Record<SessionState, SessionState[]> = {
  idle: ['listening'],
  listening: ['processing', 'idle'],
  processing: ['speaking', 'listening', 'idle'], // Can go to listening on interrupt
  speaking: ['listening', 'idle', 'interrupted'],
  interrupted: ['listening', 'idle'],
}

export class StateMachine {
  private state: SessionState = 'idle'
  private listeners: Set<(state: SessionState, prev: SessionState) => void> = new Set()
  
  get current(): SessionState {
    return this.state
  }
  
  /**
   * Transition to a new state
   * @returns true if transition was valid, false otherwise
   */
  transition(newState: SessionState): boolean {
    const validTransitions = TRANSITIONS[this.state]
    
    if (!validTransitions.includes(newState)) {
      console.warn(`Invalid state transition: ${this.state} -> ${newState}`)
      return false
    }
    
    const prev = this.state
    this.state = newState
    
    for (const listener of this.listeners) {
      listener(newState, prev)
    }
    
    return true
  }
  
  /**
   * Force a state (bypass transition validation)
   * Use sparingly for error recovery
   */
  force(newState: SessionState): void {
    const prev = this.state
    this.state = newState
    
    for (const listener of this.listeners) {
      listener(newState, prev)
    }
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: SessionState, prev: SessionState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  
  /**
   * Reset to idle state
   */
  reset(): void {
    this.force('idle')
  }
}
