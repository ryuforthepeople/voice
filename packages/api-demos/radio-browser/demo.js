const API = 'https://de1.api.radio-browser.info/json';
const audio = new Audio();
let currentStation = null;
let isPlaying = false;

// Elements
const stationsGrid = document.getElementById('stations');
const searchInput = document.getElementById('search');
const countrySelect = document.getElementById('country');
const nowPlaying = document.getElementById('now-playing');
const npTitle = document.getElementById('np-title');
const npDetail = document.getElementById('np-detail');
const npEq = document.getElementById('np-eq');
const playPauseBtn = document.getElementById('np-play-pause');
const volumeSlider = document.getElementById('volume');

// State
let activeGenre = '';
let searchTimeout = null;

// Init
async function init() {
  volumeSlider.value = 0.7;
  audio.volume = 0.7;
  await loadCountries();
  loadStations();
  setupGenrePills();
}

// Countries
async function loadCountries() {
  try {
    const res = await fetch(`${API}/countries?order=stationcount&reverse=true&limit=80`);
    const countries = await res.json();
    countrySelect.innerHTML = '<option value="">All Countries</option>';
    countries.filter(c => c.stationcount > 50).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = `${c.name} (${c.stationcount})`;
      if (c.name === 'The Netherlands') opt.selected = true;
      countrySelect.appendChild(opt);
    });
  } catch (e) {
    console.error('Failed to load countries', e);
  }
}

// Genre pills
function setupGenrePills() {
  document.querySelectorAll('.genre-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
      if (activeGenre === pill.dataset.tag) {
        activeGenre = '';
      } else {
        pill.classList.add('active');
        activeGenre = pill.dataset.tag;
      }
      loadStations();
    });
  });
}

// Load stations
async function loadStations() {
  stationsGrid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading stations...</p></div>';
  
  try {
    let url;
    const search = searchInput.value.trim();
    const country = countrySelect.value;
    
    if (search) {
      url = `${API}/stations/search?name=${encodeURIComponent(search)}&limit=50&order=votes&reverse=true`;
      if (country) url += `&country=${encodeURIComponent(country)}`;
      if (activeGenre) url += `&tag=${encodeURIComponent(activeGenre)}`;
    } else if (activeGenre && country) {
      url = `${API}/stations/search?tag=${encodeURIComponent(activeGenre)}&country=${encodeURIComponent(country)}&limit=50&order=votes&reverse=true`;
    } else if (activeGenre) {
      url = `${API}/stations/bytag/${encodeURIComponent(activeGenre)}?limit=50&order=votes&reverse=true`;
    } else if (country) {
      url = `${API}/stations/bycountry/${encodeURIComponent(country)}?limit=50&order=votes&reverse=true`;
    } else {
      url = `${API}/stations/topvote?limit=50`;
    }
    
    const res = await fetch(url);
    const stations = await res.json();
    renderStations(stations);
  } catch (e) {
    stationsGrid.innerHTML = '<div class="empty"><div class="icon">📡</div><p>Failed to load stations. Try again.</p></div>';
  }
}

// Render
function renderStations(stations) {
  if (!stations.length) {
    stationsGrid.innerHTML = '<div class="empty"><div class="icon">🔇</div><p>No stations found. Try different filters.</p></div>';
    return;
  }
  
  stationsGrid.innerHTML = stations.map(s => {
    const playing = currentStation && currentStation.stationuuid === s.stationuuid;
    const tags = (s.tags || '').split(',').filter(t => t.trim()).slice(0, 4);
    const flag = s.countrycode ? getFlagEmoji(s.countrycode) : '🌍';
    return `
      <div class="station-card${playing ? ' playing' : ''}" data-uuid="${s.stationuuid}" onclick="playStation(this)" 
           data-url="${encodeURIComponent(s.url_resolved || s.url)}" data-name="${esc(s.name)}" 
           data-country="${esc(s.country)}" data-cc="${s.countrycode}" data-tags="${esc(s.tags)}"
           data-bitrate="${s.bitrate}" data-votes="${s.votes}" data-codec="${s.codec}">
        <div class="play-icon">${playing ? '⏸' : '▶'}</div>
        <div class="name">${flag} ${esc(s.name)}${playing ? '<span class="equalizer"><span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span></span>' : ''}</div>
        <div class="meta">
          <span>📍 ${esc(s.country || 'Unknown')}</span>
          ${s.bitrate ? `<span>🎵 ${s.bitrate}kbps</span>` : ''}
          ${s.codec ? `<span>💿 ${s.codec}</span>` : ''}
          <span>👍 ${(s.votes||0).toLocaleString()}</span>
        </div>
        <div class="tags">${tags.map(t => `<span>${esc(t.trim())}</span>`).join('')}</div>
      </div>`;
  }).join('');
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function getFlagEmoji(cc) { return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); }

// Play
function playStation(el) {
  const uuid = el.dataset.uuid;
  const url = decodeURIComponent(el.dataset.url);
  const name = el.dataset.name;
  const country = el.dataset.country;
  const cc = el.dataset.cc;
  const tags = el.dataset.tags;
  
  if (currentStation && currentStation.stationuuid === uuid && isPlaying) {
    audio.pause();
    isPlaying = false;
    updateUI();
    return;
  }
  
  currentStation = { stationuuid: uuid, name, country, countrycode: cc, tags, url_resolved: url };
  audio.src = url;
  audio.play().then(() => {
    isPlaying = true;
    updateUI();
  }).catch(e => {
    console.error('Playback failed', e);
    isPlaying = false;
    updateUI();
  });
}

function updateUI() {
  // Now playing bar
  if (currentStation) {
    nowPlaying.classList.add('visible');
    const flag = currentStation.countrycode ? getFlagEmoji(currentStation.countrycode) : '🌍';
    npTitle.textContent = `${flag} ${currentStation.name}`;
    const topTags = (currentStation.tags || '').split(',').filter(t=>t.trim()).slice(0,3).join(', ');
    npDetail.textContent = [currentStation.country, topTags].filter(Boolean).join(' · ');
    npEq.className = 'equalizer' + (isPlaying ? '' : ' paused');
    playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
  }
  
  // Cards
  document.querySelectorAll('.station-card').forEach(card => {
    const playing = currentStation && card.dataset.uuid === currentStation.stationuuid;
    card.classList.toggle('playing', playing && isPlaying);
    card.querySelector('.play-icon').textContent = (playing && isPlaying) ? '⏸' : '▶';
    // Equalizer on card
    const nameEl = card.querySelector('.name');
    const existingEq = nameEl.querySelector('.equalizer');
    if (playing && isPlaying && !existingEq) {
      nameEl.insertAdjacentHTML('beforeend', '<span class="equalizer"><span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span></span>');
    } else if ((!playing || !isPlaying) && existingEq) {
      existingEq.remove();
    }
  });
}

// Controls
playPauseBtn.addEventListener('click', () => {
  if (!currentStation) return;
  if (isPlaying) { audio.pause(); isPlaying = false; }
  else { audio.play(); isPlaying = true; }
  updateUI();
});

document.getElementById('np-stop').addEventListener('click', () => {
  audio.pause(); audio.src = ''; currentStation = null; isPlaying = false;
  nowPlaying.classList.remove('visible');
  document.querySelectorAll('.station-card.playing').forEach(c => { c.classList.remove('playing'); c.querySelector('.play-icon').textContent = '▶'; const eq = c.querySelector('.equalizer'); if(eq) eq.remove(); });
});

volumeSlider.addEventListener('input', e => { audio.volume = e.target.value; });

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadStations, 400);
});

countrySelect.addEventListener('change', loadStations);

audio.addEventListener('ended', () => { isPlaying = false; updateUI(); });
audio.addEventListener('error', () => { isPlaying = false; updateUI(); });

init();
