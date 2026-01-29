// --- Voice interface (extracted from demo) ---
let ws = null
let mediaStream = null
let audioContext = null
let processor = null
let isActive = false
let currentAssistantMessage = null

// DOM refs (set by initVoice)
let voiceBtn, micIcon, stopIcon, stateDot, stateText, messagesEl
let connectionStatus, errorToast, volumeRing, micInfo, configBar

function initVoice() {
  voiceBtn = document.getElementById('voiceBtn')
  micIcon = document.getElementById('micIcon')
  stopIcon = document.getElementById('stopIcon')
  stateDot = document.getElementById('stateDot')
  stateText = document.getElementById('stateText')
  messagesEl = document.getElementById('messages')
  connectionStatus = document.getElementById('connectionStatus')
  errorToast = document.getElementById('errorToast')
  volumeRing = document.getElementById('volumeRing')
  micInfo = document.getElementById('micInfo')
  configBar = document.getElementById('configBar')

  // Show active config
  try {
    const cfg = JSON.parse(localStorage.getItem('voicekit_config') || '{}')
    const stt = cfg.stt?.provider || '?'
    const llm = cfg.llm?.provider || '?'
    const tts = cfg.tts?.provider || '?'
    if (configBar) configBar.textContent = `${stt} → ${llm} → ${tts}`
  } catch {}

  voiceBtn.addEventListener('click', () => {
    if (isActive) stopVoice()
    else startVoice()
  })

  connectWS()
}

// Volume feedback
let volumeSmooth = 0
function updateVolumeFeedback(volume) {
  volumeSmooth = volumeSmooth * 0.7 + volume * 0.3
  const scale = 1 + (volumeSmooth * 0.15)
  const opacity = 0.3 + (volumeSmooth * 0.5)
  volumeRing.style.transform = `translate(-50%, -50%) scale(${scale})`
  volumeRing.style.borderColor = `rgba(76, 175, 80, ${opacity})`
  if (volumeSmooth > 0.05) volumeRing.classList.add('active')
  else volumeRing.classList.remove('active')
}

function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${location.host}/ws`)

  connectionStatus.textContent = 'Connecting...'
  connectionStatus.className = 'connection-status connecting'

  ws.onopen = () => {
    connectionStatus.textContent = 'Connected'
    connectionStatus.className = 'connection-status connected'
  }

  ws.onclose = () => {
    connectionStatus.textContent = 'Disconnected'
    connectionStatus.className = 'connection-status disconnected'
    setTimeout(connectWS, 3000)
  }

  ws.onerror = () => showError('Connection error')

  ws.onmessage = async (event) => {
    if (event.data instanceof Blob) {
      const buffer = await event.data.arrayBuffer()
      queueAudio(buffer)
      return
    }
    handleMessage(JSON.parse(event.data))
  }
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'ready': break
    case 'state': updateState(msg.state); break
    case 'transcript': handleTranscript(msg.text, msg.isFinal, msg.role); break
    case 'error': showError(msg.message); break
  }
}

function updateState(state) {
  stateDot.className = `state-dot ${state}`
  const names = { idle: 'Idle', listening: 'Listening...', processing: 'Thinking...', speaking: 'Speaking...', interrupted: 'Interrupted' }
  stateText.textContent = names[state] || state

  if (state === 'processing' && userBubble) {
    userBubble.classList.remove('pending')
    userBubble = null
    userFinalText = ''
    userInterimText = ''
  }
}

let userBubble = null
let userFinalText = ''
let userInterimText = ''

function handleTranscript(text, isFinal, role) {
  if (role === 'user') {
    if (!text || !text.trim()) return
    if (!userBubble) {
      userBubble = createMessage('user')
      currentAssistantMessage = null
      userFinalText = ''
      userInterimText = ''
    }
    if (isFinal) {
      userFinalText = (userFinalText + ' ' + text).trim()
      userInterimText = ''
    } else {
      userInterimText = text.trim()
    }
    userBubble.querySelector('.message-content').textContent = (userFinalText + ' ' + userInterimText).trim()
  } else {
    if (!currentAssistantMessage) currentAssistantMessage = createMessage('assistant')
    if (text) currentAssistantMessage.querySelector('.message-content').textContent += text
    if (isFinal) {
      currentAssistantMessage.classList.remove('pending')
      currentAssistantMessage = null
    }
  }
  const last = messagesEl.lastElementChild
  if (last) last.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

function createMessage(role) {
  const msg = document.createElement('div')
  msg.className = `message ${role} pending`
  msg.innerHTML = `<div class="message-role">${role === 'user' ? 'You' : 'Assistant'}</div><div class="message-content"></div>`
  messagesEl.appendChild(msg)
  return msg
}

// Audio playback queue
let audioQueue = []
let currentAudio = null
let isPlayingQueue = false

function queueAudio(buffer) {
  const blob = new Blob([buffer], { type: 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  audioQueue.push(url)
  playNext()
}

function playNext() {
  if (isPlayingQueue || audioQueue.length === 0) return
  isPlayingQueue = true
  const url = audioQueue.shift()
  currentAudio = new Audio(url)
  currentAudio.playbackRate = 1.1
  currentAudio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; isPlayingQueue = false; playNext() }
  currentAudio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; isPlayingQueue = false; playNext() }
  currentAudio.play().catch(() => { isPlayingQueue = false; playNext() })
}

function stopAudio() {
  if (currentAudio) { currentAudio.pause(); URL.revokeObjectURL(currentAudio.src); currentAudio = null }
  audioQueue.forEach(url => URL.revokeObjectURL(url))
  audioQueue = []
  isPlayingQueue = false
}

function resample(inputData, sourceSampleRate, targetSampleRate) {
  if (sourceSampleRate === targetSampleRate) return inputData
  const ratio = sourceSampleRate / targetSampleRate
  const outputLength = Math.round(inputData.length / ratio)
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio
    const floor = Math.floor(srcIndex)
    const ceil = Math.min(floor + 1, inputData.length - 1)
    const t = srcIndex - floor
    output[i] = inputData[floor] * (1 - t) + inputData[ceil] * t
  }
  return output
}

async function startVoice() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    const audioTrack = mediaStream.getAudioTracks()[0]
    if (audioTrack && micInfo) {
      micInfo.textContent = `🎤 ${audioTrack.label || 'Microphone'}`
      micInfo.style.color = '#4CAF50'
    }

    audioContext = new AudioContext()
    const nativeSampleRate = audioContext.sampleRate
    const source = audioContext.createMediaStreamSource(mediaStream)
    processor = audioContext.createScriptProcessor(4096, 1, 1)

    processor.onaudioprocess = (e) => {
      if (!isActive || ws.readyState !== WebSocket.OPEN) return
      const inputData = e.inputBuffer.getChannelData(0)
      let sum = 0
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i]
      updateVolumeFeedback(Math.min(1, Math.sqrt(sum / inputData.length) * 5))

      const resampled = resample(inputData, nativeSampleRate, 16000)
      const pcm = new Int16Array(resampled.length)
      for (let i = 0; i < resampled.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, resampled[i] * 32768))
      ws.send(pcm.buffer)
    }

    source.connect(processor)
    processor.connect(audioContext.destination)

    // Send start with config+keys from localStorage
    const config = JSON.parse(localStorage.getItem('voicekit_config') || '{}')
    const keys = JSON.parse(localStorage.getItem('voicekit_keys') || '{}')
    ws.send(JSON.stringify({ type: 'start', config, keys }))
    isActive = true

    voiceBtn.classList.add('active')
    micIcon.style.display = 'none'
    stopIcon.style.display = 'block'
  } catch (err) {
    console.error('Start error:', err)
    showError('Could not start microphone')
  }
}

function stopVoice() {
  if (processor) { processor.disconnect(); processor = null }
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null }
  volumeSmooth = 0
  if (volumeRing) {
    volumeRing.style.transform = 'translate(-50%, -50%) scale(1)'
    volumeRing.style.borderColor = 'rgba(76, 175, 80, 0)'
    volumeRing.classList.remove('active')
  }
  if (micInfo) { micInfo.textContent = '🎤 No microphone selected'; micInfo.style.color = '#666' }
  stopAudio()
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }))
  isActive = false
  audioQueue = []
  currentAssistantMessage = null
  if (voiceBtn) { voiceBtn.classList.remove('active') }
  if (micIcon) { micIcon.style.display = 'block' }
  if (stopIcon) { stopIcon.style.display = 'none' }
  if (typeof updateState === 'function') updateState('idle')
}

function showError(message) {
  if (!errorToast) return
  errorToast.textContent = message
  errorToast.style.display = 'block'
  setTimeout(() => { errorToast.style.display = 'none' }, 3000)
}

function destroyVoice() {
  stopVoice()
  if (ws) { ws.onclose = null; ws.close(); ws = null }
}
