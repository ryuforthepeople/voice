(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  let activeCategory = null;
  let activeAuth = 'all';
  let activeGrade = 'all';
  let searchTerm = '';
  let sortBy = 'id';

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
        // "A+" means only A+, others mean that grade and above
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
      return `<a class="card" href="${a.url}" target="_blank" rel="noopener">
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
      </a>`;
    }).join('');
  }

  render();
})();
