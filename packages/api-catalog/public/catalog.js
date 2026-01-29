(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  let activeCategory = null;
  let activeAuth = 'all';
  let searchTerm = '';

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

  // Search
  $('#search').oninput = e => { searchTerm = e.target.value.toLowerCase(); render(); };

  function render() {
    const grid = $('.grid');
    const q = searchTerm;
    const filtered = API_CATALOG.filter(a => {
      if (activeCategory && a.category !== activeCategory) return false;
      if (activeAuth !== 'all') {
        if (activeAuth === 'none' && a.auth !== 'None') return false;
        if (activeAuth === 'apikey' && a.auth !== 'apiKey') return false;
        if (activeAuth === 'oauth' && a.auth !== 'OAuth') return false;
      }
      if (q && !a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
      return true;
    });

    $('#count').textContent = `Showing ${filtered.length} of ${API_CATALOG.length} APIs`;

    if (!filtered.length) {
      grid.innerHTML = '<div class="no-results">No APIs match your filters</div>';
      return;
    }

    grid.innerHTML = filtered.map(a => {
      const authClass = a.auth === 'None' ? 'badge-none' : a.auth === 'OAuth' ? 'badge-oauth' : 'badge-apikey';
      const authLabel = a.auth === 'None' ? 'No Auth' : a.auth === 'apiKey' ? 'API Key' : 'OAuth';
      return `<a class="card" href="${a.url}" target="_blank" rel="noopener">
        <div class="card-name">${a.name}</div>
        <div class="card-desc">${a.description}</div>
        <div class="card-meta">
          <span class="badge ${authClass}">${authLabel}</span>
          <span class="cat-tag">${a.categoryEmoji} ${a.category}</span>
        </div>
      </a>`;
    }).join('');
  }

  render();
})();
