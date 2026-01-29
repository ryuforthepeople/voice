#!/usr/bin/env node
import { init } from './commands/init.js'

const command = process.argv[2] || 'init'

switch (command) {
  case 'init':
    await init()
    break
  default:
    console.log(`Unknown command: ${command}`)
    console.log('Available commands: init')
    process.exit(1)
}
