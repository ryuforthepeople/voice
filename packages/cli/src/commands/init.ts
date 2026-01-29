import { select, input, confirm, password } from '@inquirer/prompts'
import chalk from 'chalk'
import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'fs'
import type { VoiceKitConfig, VoiceKitKeys } from '@for-the-people/voice-core'

const VOICES: Record<string, { id: string; name: string }[]> = {
  edge: [
    { id: 'nl-NL-MaartenNeural', name: 'Maarten (Dutch male)' },
    { id: 'nl-NL-ColetteNeural', name: 'Colette (Dutch female)' },
    { id: 'en-US-GuyNeural', name: 'Guy (English male)' },
    { id: 'en-US-JennyNeural', name: 'Jenny (English female)' },
  ],
  elevenlabs: [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (calm female)' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (warm female)' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (male)' },
  ],
  'openai-tts': [
    { id: 'alloy', name: 'Alloy' },
    { id: 'echo', name: 'Echo' },
    { id: 'nova', name: 'Nova' },
    { id: 'shimmer', name: 'Shimmer' },
  ],
}

const MODELS: Record<string, { id: string; name: string }[]> = {
  claude: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (recommended)' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (fast)' },
  ],
  gpt: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (cheap)' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  ],
  ollama: [
    { id: 'llama3', name: 'Llama 3' },
  ],
}

const LANGUAGES = [
  { value: 'multi', name: 'Multi-language (auto-detect)' },
  { value: 'nl', name: 'Dutch' },
  { value: 'en', name: 'English' },
  { value: 'de', name: 'German' },
  { value: 'fr', name: 'French' },
  { value: 'es', name: 'Spanish' },
]

const COST_PER_MIN: Record<string, string> = {
  'deepgram': '$0.0043',
  'claude': '$0.015',
  'gpt': '$0.01',
  'edge': 'Free',
  'elevenlabs': '$0.18',
  'openai-tts': '$0.015',
}

async function verifyKey(provider: string, key: string): Promise<boolean> {
  try {
    let res: Response
    switch (provider) {
      case 'deepgram':
        res = await fetch('https://api.deepgram.com/v1/projects', {
          headers: { 'Authorization': `Token ${key}` },
        })
        return res.ok
      case 'anthropic':
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        })
        // 200 or 400 (bad request) both mean key is valid
        return res.status !== 401 && res.status !== 403
      case 'elevenlabs':
        res = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': key },
        })
        return res.ok
      case 'openai':
        res = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` },
        })
        return res.ok
      default:
        return true
    }
  } catch {
    return false
  }
}

function keyProviderFor(type: string, provider: string): string {
  if (type === 'stt') return provider // deepgram
  if (type === 'llm') {
    if (provider === 'claude') return 'anthropic'
    if (provider === 'gpt') return 'openai'
    return provider
  }
  if (type === 'tts') {
    if (provider === 'openai-tts') return 'openai'
    return provider
  }
  return provider
}

export async function init() {
  console.log(chalk.bold.cyan('\n🎙️  VoiceKit Setup Wizard\n'))
  console.log(chalk.dim('Configure your voice pipeline step by step.\n'))

  const keys: VoiceKitKeys = {}

  // ── Step 1: STT ──
  console.log(chalk.bold.yellow('Step 1: Speech-to-Text (STT)\n'))

  const sttProvider = await select({
    message: 'Select STT provider',
    choices: [
      { value: 'deepgram', name: 'Deepgram (recommended)' },
      { value: 'google', name: 'Google Speech (coming soon)', disabled: true },
      { value: 'azure', name: 'Azure Speech (coming soon)', disabled: true },
      { value: 'whisper', name: 'Whisper (coming soon)', disabled: true },
    ],
  }) as VoiceKitConfig['stt']['provider']

  const sttKey = await password({
    message: 'Enter your Deepgram API key',
    mask: '*',
  })

  process.stdout.write(chalk.dim('  Verifying key... '))
  const sttValid = await verifyKey('deepgram', sttKey)
  if (sttValid) {
    console.log(chalk.green('✓ Valid'))
    keys.deepgram = sttKey
  } else {
    console.log(chalk.red('✗ Invalid'))
    const proceed = await confirm({ message: 'Key verification failed. Continue anyway?', default: false })
    if (!proceed) process.exit(1)
    keys.deepgram = sttKey
  }

  const sttLanguage = await select({
    message: 'Select language',
    choices: LANGUAGES.map(l => ({ value: l.value, name: l.name })),
  })

  const sttModel = await input({
    message: 'STT model',
    default: 'nova-2',
  })

  // ── Step 2: LLM ──
  console.log(chalk.bold.yellow('\nStep 2: Language Model (LLM)\n'))

  const llmProvider = await select({
    message: 'Select LLM provider',
    choices: [
      { value: 'claude', name: 'Claude (Anthropic) — recommended' },
      { value: 'gpt', name: 'GPT (OpenAI) — coming soon', disabled: true },
      { value: 'gemini', name: 'Gemini (Google) — coming soon', disabled: true },
      { value: 'ollama', name: 'Ollama (local) — coming soon', disabled: true },
      { value: 'clawdbot', name: 'Clawdbot (gateway)' },
    ],
  }) as VoiceKitConfig['llm']['provider']

  if (llmProvider === 'claude') {
    const llmKey = await password({
      message: 'Enter your Anthropic API key',
      mask: '*',
    })
    process.stdout.write(chalk.dim('  Verifying key... '))
    const llmValid = await verifyKey('anthropic', llmKey)
    if (llmValid) {
      console.log(chalk.green('✓ Valid'))
    } else {
      console.log(chalk.red('✗ Invalid'))
      const proceed = await confirm({ message: 'Key verification failed. Continue anyway?', default: false })
      if (!proceed) process.exit(1)
    }
    keys.anthropic = llmKey
  } else if (llmProvider === 'clawdbot') {
    keys.clawdbotGatewayUrl = await input({ message: 'Clawdbot gateway URL', default: 'ws://localhost:18789' })
    keys.clawdbotToken = await password({ message: 'Clawdbot gateway token', mask: '*' })
  }

  const models = MODELS[llmProvider] || [{ id: 'default', name: 'Default' }]
  const llmModel = await select({
    message: 'Select model',
    choices: models.map(m => ({ value: m.id, name: m.name })),
  })

  const llmLanguage = await select({
    message: 'Response language',
    choices: [
      { value: 'nl-NL', name: 'Dutch' },
      { value: 'en-US', name: 'English' },
    ],
  })

  const systemPrompt = await input({
    message: 'System prompt (optional, press Enter to skip)',
    default: '',
  })

  // ── Step 3: TTS ──
  console.log(chalk.bold.yellow('\nStep 3: Text-to-Speech (TTS)\n'))

  const ttsEnabled = await confirm({ message: 'Enable voice output?', default: true })

  let ttsProvider: VoiceKitConfig['tts']['provider'] = 'edge'
  let ttsVoice: string | undefined
  let ttsSpeed = 1.0

  if (ttsEnabled) {
    ttsProvider = await select({
      message: 'Select TTS provider',
      choices: [
        { value: 'edge', name: 'Edge TTS (free, Microsoft)' },
        { value: 'elevenlabs', name: 'ElevenLabs (premium voices)' },
        { value: 'openai-tts', name: 'OpenAI TTS (coming soon)', disabled: true },
      ],
    }) as VoiceKitConfig['tts']['provider']

    if (ttsProvider === 'elevenlabs') {
      const ttsKey = await password({ message: 'Enter your ElevenLabs API key', mask: '*' })
      process.stdout.write(chalk.dim('  Verifying key... '))
      const ttsValid = await verifyKey('elevenlabs', ttsKey)
      if (ttsValid) {
        console.log(chalk.green('✓ Valid'))
      } else {
        console.log(chalk.red('✗ Invalid'))
        const proceed = await confirm({ message: 'Key verification failed. Continue anyway?', default: false })
        if (!proceed) process.exit(1)
      }
      keys.elevenlabs = ttsKey
    }

    const voices = VOICES[ttsProvider] || []
    if (voices.length > 0) {
      ttsVoice = await select({
        message: 'Select voice',
        choices: voices.map(v => ({ value: v.id, name: v.name })),
      })
    }

    ttsSpeed = parseFloat(await input({ message: 'Speech speed (1.0 = normal)', default: '1.0' }))
  }

  // ── Step 4: Summary + Save ──
  console.log(chalk.bold.yellow('\n── Configuration Summary ──\n'))

  const config: VoiceKitConfig = {
    stt: { provider: sttProvider, language: sttLanguage, model: sttModel },
    llm: { provider: llmProvider, model: llmModel, language: llmLanguage, systemPrompt: systemPrompt || undefined },
    tts: { enabled: ttsEnabled, provider: ttsProvider, voice: ttsVoice, speed: ttsSpeed },
  }

  console.log(chalk.cyan('  STT:'), `${config.stt.provider} / ${config.stt.model} / ${config.stt.language}`)
  console.log(chalk.cyan('  LLM:'), `${config.llm.provider} / ${config.llm.model} / ${config.llm.language}`)
  console.log(chalk.cyan('  TTS:'), config.tts.enabled ? `${config.tts.provider} / ${config.tts.voice} / ${config.tts.speed}x` : 'Disabled')

  // Cost estimate
  const sttCost = COST_PER_MIN[config.stt.provider] || '?'
  const llmCost = COST_PER_MIN[config.llm.provider] || '?'
  const ttsCost = config.tts.enabled ? (COST_PER_MIN[config.tts.provider] || '?') : '$0'
  console.log(chalk.dim(`\n  Estimated cost/min: STT ${sttCost} + LLM ${llmCost} + TTS ${ttsCost}`))

  const shouldSave = await confirm({ message: '\nSave configuration?', default: true })
  if (!shouldSave) {
    console.log(chalk.dim('Cancelled.'))
    return
  }

  // Write config file (no secrets)
  writeFileSync('voicekit.config.json', JSON.stringify(config, null, 2) + '\n')
  console.log(chalk.green('  ✓ Wrote voicekit.config.json'))

  // Write .env
  const envLines: string[] = []
  if (keys.deepgram) envLines.push(`DEEPGRAM_API_KEY=${keys.deepgram}`)
  if (keys.anthropic) envLines.push(`ANTHROPIC_API_KEY=${keys.anthropic}`)
  if (keys.openai) envLines.push(`OPENAI_API_KEY=${keys.openai}`)
  if (keys.elevenlabs) envLines.push(`ELEVENLABS_API_KEY=${keys.elevenlabs}`)
  if (keys.google) envLines.push(`GOOGLE_API_KEY=${keys.google}`)
  if (keys.azure) envLines.push(`AZURE_API_KEY=${keys.azure}`)
  if (keys.clawdbotGatewayUrl) envLines.push(`CLAWDBOT_GATEWAY_URL=${keys.clawdbotGatewayUrl}`)
  if (keys.clawdbotToken) envLines.push(`CLAWDBOT_TOKEN=${keys.clawdbotToken}`)

  if (envLines.length > 0) {
    const envContent = envLines.join('\n') + '\n'
    if (existsSync('.env')) {
      appendFileSync('.env', '\n# VoiceKit\n' + envContent)
    } else {
      writeFileSync('.env', '# VoiceKit\n' + envContent)
    }
    console.log(chalk.green('  ✓ Wrote .env'))
  }

  // Ensure .gitignore has .env
  const gitignorePath = '.gitignore'
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8')
    if (!content.includes('.env')) {
      appendFileSync(gitignorePath, '\n.env\n')
      console.log(chalk.green('  ✓ Added .env to .gitignore'))
    }
  } else {
    writeFileSync(gitignorePath, '.env\n')
    console.log(chalk.green('  ✓ Created .gitignore with .env'))
  }

  console.log(chalk.bold.green('\n✨ VoiceKit configured! Run your app to start.\n'))
}
