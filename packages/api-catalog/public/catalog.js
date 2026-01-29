(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  let activeCategory = null;
  let activeAuth = 'all';
  let activeGrade = 'all';
  let searchTerm = '';
  let sortBy = 'id';
  let currentApi = null;
  let currentLang = 'js';

  // Show last checked
  if (typeof HEALTH_DATA !== 'undefined' && HEALTH_DATA.lastChecked) {
    const d = new Date(HEALTH_DATA.lastChecked);
    $('#lastChecked').textContent = `Health check: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  }

  const gradeEmoji = { 'A+': '⭐', 'A': '🟢', 'B': '🔵', 'C': '🟡', 'D': '🟠', 'F': '🔴' };
  const gradeOrder = ['A+', 'A', 'B', 'C', 'D', 'F'];

  // Build categories
  const cats = new Map();
  API_CATALOG.forEach(a => {
    if (!cats.has(a.category)) cats.set(a.category, { emoji: a.categoryEmoji, count: 0 });
    cats.get(a.category).count++;
  });

  // Render sidebar
  const sidebar = $('.sidebar');
  const allBtn = document.createElement('button');
  allBtn.className = 'cat-btn active';
  allBtn.innerHTML = `<span class="emoji">📋</span> All <span class="cnt">${API_CATALOG.length}</span>`;
  allBtn.onclick = () => { activeCategory = null; updateActive(); render(); };
  sidebar.appendChild(allBtn);

  cats.forEach((v, k) => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.cat = k;
    btn.innerHTML = `<span class="emoji">${v.emoji}</span> ${k} <span class="cnt">${v.count}</span>`;
    btn.onclick = () => { activeCategory = k; updateActive(); render(); };
    sidebar.appendChild(btn);
  });

  function updateActive() {
    $$('.cat-btn').forEach(b => b.classList.toggle('active', activeCategory ? b.dataset.cat === activeCategory : !b.dataset.cat));
  }

  // Auth filters
  $$('.auth-btn').forEach(b => {
    b.onclick = () => {
      activeAuth = b.dataset.auth;
      $$('.auth-btn').forEach(x => x.classList.toggle('active', x.dataset.auth === activeAuth));
      render();
    };
  });

  // Grade filters
  $$('.grade-btn').forEach(b => {
    b.onclick = () => {
      activeGrade = b.dataset.grade;
      $$('.grade-btn').forEach(x => x.classList.toggle('active', x.dataset.grade === activeGrade));
      render();
    };
  });

  // Sort
  $('#sortBy').onchange = e => { sortBy = e.target.value; render(); };

  // Search
  $('#search').oninput = e => { searchTerm = e.target.value.toLowerCase(); render(); };

  function render() {
    const grid = $('.grid');
    const q = searchTerm;
    let filtered = API_CATALOG.filter(a => {
      if (activeCategory && a.category !== activeCategory) return false;
      if (activeAuth !== 'all') {
        if (activeAuth === 'none' && a.auth !== 'None') return false;
        if (activeAuth === 'apikey' && a.auth !== 'apiKey') return false;
        if (activeAuth === 'oauth' && a.auth !== 'OAuth') return false;
      }
      if (activeGrade !== 'all') {
        const g = a.grade || 'F';
        const idx = gradeOrder.indexOf(activeGrade);
        if (idx >= 0 && gradeOrder.indexOf(g) < idx) return false;
        if (activeGrade === 'A+' && g !== 'A+') return false;
        if (activeGrade !== 'A+' && gradeOrder.indexOf(g) > idx) return false;
      }
      if (q && !a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
      return true;
    });

    // Sort
    if (sortBy === 'score-desc') filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    else if (sortBy === 'score-asc') filtered.sort((a, b) => (a.score || 0) - (b.score || 0));
    else if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));

    $('#count').textContent = `Showing ${filtered.length} of ${API_CATALOG.length} APIs`;

    if (!filtered.length) {
      grid.innerHTML = '<div class="no-results">No APIs match your filters</div>';
      return;
    }

    grid.innerHTML = filtered.map(a => {
      const authClass = a.auth === 'None' ? 'badge-none' : a.auth === 'OAuth' ? 'badge-oauth' : 'badge-apikey';
      const authLabel = a.auth === 'None' ? 'No Auth' : a.auth === 'apiKey' ? 'API Key' : 'OAuth';
      const grade = a.grade || 'F';
      const emoji = gradeEmoji[grade] || '🔴';
      const gradeClass = 'grade-' + grade.replace('+', 'plus');
      return `<div class="card" data-id="${a.id}">
        <div class="card-top">
          <div class="card-name">${a.name}</div>
          <span class="grade-badge ${gradeClass}" title="Score: ${a.score || 0}/100">${emoji} ${grade}</span>
        </div>
        <div class="card-desc">${a.description}</div>
        <div class="card-meta">
          <span class="badge ${authClass}">${authLabel}</span>
          <span class="cat-tag">${a.categoryEmoji} ${a.category}</span>
          <span class="score-tag">${a.score || 0}/100</span>
        </div>
      </div>`;
    }).join('');

    // Attach click handlers
    $$('.card[data-id]').forEach(card => {
      card.onclick = (e) => {
        e.preventDefault();
        const id = parseInt(card.dataset.id);
        openDetail(id);
      };
    });
  }

  // ── Detail Panel ──
  function openDetail(id) {
    const api = API_CATALOG.find(a => a.id === id);
    if (!api) return;
    currentApi = api;
    currentLang = 'js';
    window.location.hash = `api/${id}`;

    const grade = api.grade || 'F';
    const emoji = gradeEmoji[grade] || '🔴';
    const gradeClass = 'grade-' + grade.replace('+', 'plus');

    $('#detailName').textContent = `${api.categoryEmoji} ${api.name}`;
    const gb = $('#detailGrade');
    gb.className = `grade-badge ${gradeClass}`;
    gb.textContent = `${emoji} ${grade}`;

    $('#detailCategory').textContent = `${api.categoryEmoji} ${api.category}`;

    const authEl = $('#detailAuth');
    const authLabel = api.auth === 'None' ? 'No Auth' : api.auth === 'apiKey' ? 'API Key' : 'OAuth';
    const authClass = api.auth === 'None' ? 'badge-none' : api.auth === 'OAuth' ? 'badge-oauth' : 'badge-apikey';
    authEl.className = `badge ${authClass}`;
    authEl.textContent = authLabel;

    const httpsEl = $('#detailHttps');
    httpsEl.textContent = api.https ? 'HTTPS' : 'HTTP';
    httpsEl.className = `detail-https ${api.https ? 'yes' : 'no'}`;

    $('#detailDesc').textContent = api.description;
    $('#detailDocs').href = api.url;

    // Code
    updateCodeBlock();

    // Code tabs
    $$('.code-tab').forEach(t => {
      t.onclick = () => {
        currentLang = t.dataset.lang;
        $$('.code-tab').forEach(x => x.classList.toggle('active', x === t));
        updateCodeBlock();
      };
      t.classList.toggle('active', t.dataset.lang === 'js');
    });

    // Copy button
    $('.copy-btn').onclick = () => {
      navigator.clipboard.writeText($('#codeBlock').textContent).then(() => {
        const btn = $('.copy-btn');
        btn.textContent = '✅';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '📋'; btn.classList.remove('copied'); }, 1500);
      });
    };

    // Playground
    const tryBtn = $('#tryBtn');
    const result = $('#playgroundResult');
    if (api.exampleEndpoint) {
      tryBtn.style.display = '';
      tryBtn.disabled = false;
      result.innerHTML = '<div class="playground-placeholder">Click "Try it" to send a request</div>';
      tryBtn.onclick = () => runPlayground(api);
    } else {
      tryBtn.style.display = 'none';
      result.innerHTML = '<div class="playground-placeholder">Example endpoint not configured yet. Use the code examples above.</div>';
    }

    // Info grid
    const healthEntry = typeof HEALTH_DATA !== 'undefined' ? (HEALTH_DATA.results || []).find(h => h.id === api.id) : null;
    const lastChecked = typeof HEALTH_DATA !== 'undefined' && HEALTH_DATA.lastChecked
      ? new Date(HEALTH_DATA.lastChecked).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
    const responseTime = healthEntry && healthEntry.responseMs ? `${healthEntry.responseMs}ms` : '—';

    $('#infoGrid').innerHTML = [
      ['Auth', authLabel],
      ['HTTPS', api.https ? '✅ Yes' : '❌ No'],
      ['Score', `${api.score || 0}/100`],
      ['Last Checked', lastChecked],
      ['Rate Limits', 'Check official docs'],
      ['Response Time', responseTime],
    ].map(([l, v]) => `<div class="info-item"><div class="info-label">${l}</div><div class="info-value">${v}</div></div>`).join('');

    // Show panel
    $('#detailOverlay').classList.add('active');
    $('#detailPanel').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    $('#detailOverlay').classList.remove('active');
    $('#detailPanel').classList.remove('active');
    document.body.style.overflow = '';
    if (window.location.hash.startsWith('#api/')) history.pushState(null, '', window.location.pathname + window.location.search);
    currentApi = null;
  }

  $('#detailClose').onclick = closeDetail;
  $('#detailOverlay').onclick = closeDetail;
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

  function getEndpointUrl(api) {
    return api.exampleEndpoint || api.url;
  }

  function generateCode(api, lang) {
    const url = getEndpointUrl(api);
    const hasHeaders = api.exampleHeaders && Object.keys(api.exampleHeaders).length > 0;
    const needsAuth = api.auth === 'apiKey';
    const needsOAuth = api.auth === 'OAuth';

    if (lang === 'js') {
      let lines = [`// JavaScript (fetch)`];
      if (hasHeaders || needsAuth || needsOAuth) {
        let headers = {};
        if (hasHeaders) Object.assign(headers, api.exampleHeaders);
        if (needsAuth) headers['X-Api-Key'] = 'YOUR_API_KEY';
        if (needsOAuth) headers['Authorization'] = 'Bearer YOUR_TOKEN';
        lines.push(`const res = await fetch('${url}', {`);
        lines.push(`  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ')}`);
        lines.push(`});`);
      } else {
        lines.push(`const res = await fetch('${url}');`);
      }
      lines.push(`const data = await res.json();`);
      lines.push(`console.log(data);`);
      return lines.join('\n');
    }

    if (lang === 'curl') {
      let parts = [`# cURL`, `curl`];
      if (hasHeaders) {
        for (const [k, v] of Object.entries(api.exampleHeaders)) parts.push(`  -H '${k}: ${v}'`);
      }
      if (needsAuth) parts.push(`  -H 'X-Api-Key: YOUR_API_KEY'`);
      if (needsOAuth) parts.push(`  -H 'Authorization: Bearer YOUR_TOKEN'`);
      parts.push(`  '${url}'`);
      return parts.join(' \\\n');
    }

    if (lang === 'python') {
      let lines = [`# Python`, `import requests`, ``];
      if (hasHeaders || needsAuth || needsOAuth) {
        let headers = {};
        if (hasHeaders) Object.assign(headers, api.exampleHeaders);
        if (needsAuth) headers['X-Api-Key'] = 'YOUR_API_KEY';
        if (needsOAuth) headers['Authorization'] = 'Bearer YOUR_TOKEN';
        lines.push(`headers = ${JSON.stringify(headers)}`);
        lines.push(`r = requests.get('${url}', headers=headers)`);
      } else {
        lines.push(`r = requests.get('${url}')`);
      }
      lines.push(`print(r.json())`);
      return lines.join('\n');
    }
    return '';
  }

  function updateCodeBlock() {
    if (!currentApi) return;
    $('#codeBlock').textContent = generateCode(currentApi, currentLang);
  }

  async function runPlayground(api) {
    const btn = $('#tryBtn');
    const result = $('#playgroundResult');
    btn.disabled = true;
    btn.textContent = '⏳ Loading…';
    result.innerHTML = '<div class="playground-spinner">Fetching…</div>';

    try {
      const opts = {};
      if (api.exampleHeaders) opts.headers = { ...api.exampleHeaders };
      const res = await fetch(api.exampleEndpoint, opts);
      const text = await res.text();
      let display;
      try {
        display = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        display = text;
      }
      // Truncate long responses
      if (display.length > 5000) display = display.slice(0, 5000) + '\n\n… (truncated)';
      result.innerHTML = `<pre>${escapeHtml(display)}</pre>`;
    } catch (err) {
      result.innerHTML = `<div class="playground-error">❌ ${escapeHtml(err.message)}<br><br>This API may not support browser requests (CORS). Use the code examples above.</div>`;
    }
    btn.disabled = false;
    btn.textContent = '▶ Try it';
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Handle hash on load
  function checkHash() {
    const m = window.location.hash.match(/^#api\/(\d+)$/);
    if (m) openDetail(parseInt(m[1]));
  }
  window.addEventListener('hashchange', checkHash);

  // Popstate for back button
  window.addEventListener('popstate', () => {
    if (!window.location.hash.startsWith('#api/')) closeDetail();
    else checkHash();
  });

  render();
  checkHash();
})();
