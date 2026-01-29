// --- State ---
let currentStep = 0;
const state = {
  stt: { provider: 'deepgram', language: 'multi', model: 'nova-2' },
  llm: { provider: 'claude', model: 'claude-sonnet-4-20250514', language: 'nl-NL', systemPrompt: '' },
  tts: { enabled: true, provider: 'edge', voice: 'nl-NL-MaartenNeural', speed: 1.0 },
};
const keys = {};

// LLM models per provider
const LLM_MODELS = {
  claude: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  ],
  gpt: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  ],
  ollama: [
    { id: 'llama3', name: 'Llama 3' },
    { id: 'mistral', name: 'Mistral' },
  ],
};

// Verify key provider mapping
const VERIFY_MAP = {
  deepgram: 'deepgram',
  claude: 'anthropic',
  gpt: 'openai',
  elevenlabs: 'elevenlabs',
  'openai-tts': 'openai',
};

// Cost estimates per minute (USD)
const COSTS = {
  stt: { deepgram: 0.0043, google: 0.006, azure: 0.006, whisper: 0 },
  llm: { claude: 0.01, gpt: 0.01, gemini: 0.005, ollama: 0 },
  tts: { edge: 0, elevenlabs: 0.003, 'openai-tts': 0.002 },
};

// --- Load saved config ---
try {
  const saved = JSON.parse(localStorage.getItem('voicekit_config') || '{}');
  const savedKeys = JSON.parse(localStorage.getItem('voicekit_keys') || '{}');
  if (saved.stt) Object.assign(state.stt, saved.stt);
  if (saved.llm) Object.assign(state.llm, saved.llm);
  if (saved.tts) Object.assign(state.tts, saved.tts);
  Object.assign(keys, savedKeys);
} catch {}

// --- Navigation ---
function goStep(n) {
  currentStep = n;
  document.querySelectorAll('.wizard-panel').forEach((p, i) => {
    p.classList.toggle('active', i === n);
  });
  document.querySelectorAll('.step-item').forEach((s, i) => {
    s.classList.toggle('active', i === n);
    s.classList.toggle('done', i < n);
  });
  if (n === 1) updateLLMModels();
  if (n === 2) { updateTTSVisibility(); loadVoices(); }
  if (n === 3) updateSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Card selection ---
function setupCards(containerId, stateKey, subKey) {
  const container = document.getElementById(containerId);
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    container.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state[stateKey][subKey] = card.dataset.provider;

    if (stateKey === 'llm') updateLLMModels();
    if (stateKey === 'tts') { updateTTSKeyField(); loadVoices(); }
  });
  // Restore selection
  const sel = container.querySelector(`[data-provider="${state[stateKey][subKey]}"]`);
  if (sel) {
    container.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    sel.classList.add('selected');
  }
}

setupCards('stt-cards', 'stt', 'provider');
setupCards('llm-cards', 'llm', 'provider');
setupCards('tts-cards', 'tts', 'provider');

// --- LLM model dropdown ---
function updateLLMModels() {
  const sel = document.getElementById('llm-model');
  const models = LLM_MODELS[state.llm.provider] || [];
  sel.innerHTML = models.map(m => `<option value="${m.id}" ${m.id === state.llm.model ? 'selected' : ''}>${m.name}</option>`).join('');
  if (models.length && !models.find(m => m.id === state.llm.model)) {
    state.llm.model = models[0].id;
  }
  sel.onchange = () => { state.llm.model = sel.value; };

  // Show/hide key field for local providers
  const needsKey = state.llm.provider !== 'ollama';
  document.getElementById('llm-key-field').style.display = needsKey ? '' : 'none';
}
updateLLMModels();

// --- TTS toggle ---
function toggleTTS() {
  state.tts.enabled = !state.tts.enabled;
  document.getElementById('tts-toggle').classList.toggle('on', state.tts.enabled);
  document.getElementById('tts-section').style.display = state.tts.enabled ? '' : 'none';
}

function updateTTSVisibility() {
  document.getElementById('tts-toggle').classList.toggle('on', state.tts.enabled);
  document.getElementById('tts-section').style.display = state.tts.enabled ? '' : 'none';
  updateTTSKeyField();
}

function updateTTSKeyField() {
  const needs = state.tts.provider !== 'edge';
  document.getElementById('tts-key-field').style.display = needs ? '' : 'none';
}

// --- Voices ---
async function loadVoices() {
  const provider = state.tts.provider;
  const list = document.getElementById('voice-list');
  list.innerHTML = '<div style="color:#aaa;font-size:0.85rem">Loading voices...</div>';

  try {
    const headers = {};
    if (provider === 'elevenlabs' && keys.elevenlabs) {
      headers['x-api-key'] = keys.elevenlabs;
    }
    const res = await fetch(`/api/voices/${provider}`, { headers });
    const data = await res.json();
    const voices = data.voices || [];

    list.innerHTML = voices.map(v => {
      const id = v.voice_id;
      const selected = id === state.tts.voice ? 'selected' : '';
      return `<div class="voice-item ${selected}" data-voice="${id}" onclick="selectVoice('${id}')">
        <button class="play-btn" onclick="event.stopPropagation();previewVoice('${id}','${v.name}')">▶</button>
        <span>${v.name}</span>
      </div>`;
    }).join('');

    if (!voices.length) {
      list.innerHTML = '<div style="color:#aaa;font-size:0.85rem">No voices available</div>';
    }
  } catch {
    list.innerHTML = '<div style="color:#f44336;font-size:0.85rem">Failed to load voices</div>';
  }
}

function selectVoice(id) {
  state.tts.voice = id;
  document.querySelectorAll('#voice-list .voice-item').forEach(v => {
    v.classList.toggle('selected', v.dataset.voice === id);
  });
}

async function previewVoice(voiceId, name) {
  const provider = state.tts.provider;
  if (provider === 'edge') {
    // Edge TTS preview not supported via proxy (needs streaming)
    alert('Edge TTS preview not available in browser. It will work in the voice pipeline.');
    return;
  }
  const keyName = provider === 'elevenlabs' ? 'elevenlabs' : 'openai';
  const apiKey = keys[keyName] || document.getElementById('tts-key').value;
  if (!apiKey) { alert('Enter an API key first'); return; }

  try {
    const res = await fetch('/api/tts/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: provider === 'openai-tts' ? 'openai' : provider,
        apiKey,
        voiceId,
        text: `Hello, I am ${name}. This is a voice preview.`,
      }),
    });
    if (!res.ok) throw new Error('Preview failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  } catch (e) {
    alert('Preview failed: ' + e.message);
  }
}

// --- Key verification ---
async function verifyKey(section) {
  let provider, keyInput, statusEl, keyStoreName;

  if (section === 'stt') {
    provider = state.stt.provider;
    keyInput = document.getElementById('stt-key');
    statusEl = document.getElementById('stt-verify');
    keyStoreName = provider;
  } else if (section === 'llm') {
    provider = state.llm.provider;
    keyInput = document.getElementById('llm-key');
    statusEl = document.getElementById('llm-verify');
    keyStoreName = VERIFY_MAP[provider] || provider;
  } else if (section === 'tts') {
    provider = state.tts.provider;
    keyInput = document.getElementById('tts-key');
    statusEl = document.getElementById('tts-verify');
    keyStoreName = provider === 'openai-tts' ? 'openai' : provider;
  }

  const apiKey = keyInput.value.trim();
  if (!apiKey) { statusEl.textContent = 'Please enter a key'; statusEl.className = 'verify-status fail'; return; }

  const endpoint = VERIFY_MAP[provider];
  if (!endpoint) { statusEl.textContent = 'Verification not available for this provider'; statusEl.className = 'verify-status fail'; return; }

  statusEl.textContent = 'Verifying...';
  statusEl.className = 'verify-status loading';

  try {
    const res = await fetch(`/api/verify/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json();
    if (data.valid) {
      statusEl.textContent = '✅ Key is valid!';
      statusEl.className = 'verify-status ok';
      keys[keyStoreName] = apiKey;
    } else {
      statusEl.textContent = '❌ Invalid key: ' + (data.error || 'unknown error');
      statusEl.className = 'verify-status fail';
    }
  } catch (e) {
    statusEl.textContent = '❌ Error: ' + e.message;
    statusEl.className = 'verify-status fail';
  }
}

// --- Restore saved keys into inputs ---
function restoreKeys() {
  if (keys[state.stt.provider]) document.getElementById('stt-key').value = keys[state.stt.provider];
  const llmKeyName = VERIFY_MAP[state.llm.provider] || state.llm.provider;
  if (keys[llmKeyName]) document.getElementById('llm-key').value = keys[llmKeyName];
  const ttsKeyName = state.tts.provider === 'openai-tts' ? 'openai' : state.tts.provider;
  if (keys[ttsKeyName]) document.getElementById('tts-key').value = keys[ttsKeyName];
}
restoreKeys();

// Bind selects
document.getElementById('stt-lang').value = state.stt.language;
document.getElementById('stt-lang').onchange = function() { state.stt.language = this.value; };
document.getElementById('llm-lang').value = state.llm.language;
document.getElementById('llm-lang').onchange = function() { state.llm.language = this.value; };
document.getElementById('llm-prompt').value = state.llm.systemPrompt;
document.getElementById('llm-prompt').oninput = function() { state.llm.systemPrompt = this.value; };
document.getElementById('tts-speed').value = state.tts.speed;
document.getElementById('speed-val').textContent = state.tts.speed;
document.getElementById('tts-speed').oninput = function() {
  state.tts.speed = parseFloat(this.value);
  document.getElementById('speed-val').textContent = this.value;
};

// --- Summary ---
function updateSummary() {
  document.getElementById('sum-stt-provider').textContent = state.stt.provider;
  document.getElementById('sum-stt-lang').textContent = document.getElementById('stt-lang').selectedOptions[0].text;
  document.getElementById('sum-llm-provider').textContent = state.llm.provider;
  document.getElementById('sum-llm-model').textContent = state.llm.model;
  document.getElementById('sum-llm-lang').textContent = document.getElementById('llm-lang').selectedOptions[0].text;
  document.getElementById('sum-tts-enabled').textContent = state.tts.enabled ? 'Yes' : 'No';
  document.getElementById('sum-tts-provider').textContent = state.tts.enabled ? state.tts.provider : '—';
  document.getElementById('sum-tts-voice').textContent = state.tts.enabled ? state.tts.voice : '—';
  document.getElementById('sum-tts-speed').textContent = state.tts.enabled ? state.tts.speed + 'x' : '—';

  // Cost
  const sttCost = COSTS.stt[state.stt.provider] || 0;
  const llmCost = COSTS.llm[state.llm.provider] || 0;
  const ttsCost = state.tts.enabled ? (COSTS.tts[state.tts.provider] || 0) : 0;
  const total = sttCost + llmCost + ttsCost;
  document.getElementById('cost-amount').textContent = total === 0 ? 'Free!' : `~$${total.toFixed(4)}/min`;
}

// --- Save ---
function saveConfig() {
  const config = {
    stt: { provider: state.stt.provider, language: state.stt.language, model: state.stt.provider === 'deepgram' ? 'nova-2' : 'default' },
    llm: { provider: state.llm.provider, model: state.llm.model, language: state.llm.language, systemPrompt: state.llm.systemPrompt },
    tts: { enabled: state.tts.enabled, provider: state.tts.provider, voice: state.tts.voice, speed: state.tts.speed },
  };
  localStorage.setItem('voicekit_config', JSON.stringify(config));
  localStorage.setItem('voicekit_keys', JSON.stringify(keys));
  document.getElementById('save-result').classList.add('show');
  setTimeout(() => document.getElementById('save-result').classList.remove('show'), 5000);
}

// --- Test (basic mic test) ---
let testStream = null;
function toggleTest() {
  const btn = document.getElementById('test-mic');
  const out = document.getElementById('test-output');
  if (testStream) {
    testStream.getTracks().forEach(t => t.stop());
    testStream = null;
    btn.classList.remove('recording');
    out.textContent = 'Test stopped.';
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    testStream = stream;
    btn.classList.add('recording');
    out.textContent = 'Microphone active! Your setup looks good. (Click again to stop)';
  }).catch(err => {
    out.textContent = 'Mic error: ' + err.message;
  });
}
