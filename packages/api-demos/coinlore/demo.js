const API_TICKERS = 'https://api.coinlore.net/api/tickers/?start=0&limit=50';
const API_GLOBAL = 'https://api.coinlore.net/api/global/';
const REFRESH = 30000;

let coins = [], expandedId = null, filter = '';

const $ = s => document.querySelector(s);
const fmt = (n, d=2) => Number(n).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
const fmtBig = n => {
  const v = Number(n);
  if(v >= 1e12) return '$'+fmt(v/1e12)+'T';
  if(v >= 1e9) return '$'+fmt(v/1e9)+'B';
  if(v >= 1e6) return '$'+fmt(v/1e6)+'M';
  return '$'+fmt(v);
};

async function fetchGlobal(){
  try{
    const r = await fetch(API_GLOBAL);
    const d = (await r.json())[0];
    $('#g-mcap').textContent = fmtBig(d.total_mcap);
    $('#g-vol').textContent = fmtBig(d.total_volume);
    $('#g-btc').textContent = fmt(d.d,1)+'%';
    $('#g-coins').textContent = Number(d.coins_count).toLocaleString();
  }catch(e){console.error('global fetch failed',e)}
}

async function fetchCoins(){
  try{
    const r = await fetch(API_TICKERS);
    const d = await r.json();
    coins = d.data || [];
    render();
  }catch(e){console.error('tickers fetch failed',e)}
}

function render(){
  const q = filter.toLowerCase();
  const filtered = coins.filter(c => !q || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  const tbody = $('#coin-body');
  let html = '';
  for(const c of filtered){
    const ch = Number(c.percent_change_24h);
    const cls = ch >= 0 ? 'green' : 'red';
    const exp = expandedId === c.id;
    html += `<tr class="${exp?'expanded-row':''}" data-id="${c.id}">
      <td>${c.rank}</td><td><strong>${c.name}</strong></td><td>${c.symbol}</td>
      <td>$${fmt(c.price_usd)}</td><td class="${cls}">${ch>=0?'+':''}${fmt(ch)}%</td>
      <td>${fmtBig(c.market_cap_usd)}</td></tr>`;
    if(exp){
      html += `<tr><td colspan="6"><div class="detail-panel"><div class="grid">
        <div class="item"><span>1h: </span><span class="${Number(c.percent_change_1h)>=0?'green':'red'}">${c.percent_change_1h}%</span></div>
        <div class="item"><span>7d: </span><span class="${Number(c.percent_change_7d)>=0?'green':'red'}">${c.percent_change_7d}%</span></div>
        <div class="item"><span>Volume 24h: </span>${fmtBig(c.volume24)}</div>
        <div class="item"><span>Supply: </span>${Number(c.csupply).toLocaleString()} ${c.symbol}</div>
        <div class="item"><span>Total Supply: </span>${c.tsupply ? Number(c.tsupply).toLocaleString() : 'N/A'}</div>
        <div class="item"><span>Max Supply: </span>${c.msupply ? Number(c.msupply).toLocaleString() : '∞'}</div>
      </div></div></td></tr>`;
    }
  }
  tbody.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  fetchGlobal(); fetchCoins();
  setInterval(()=>{fetchGlobal();fetchCoins()}, REFRESH);

  $('#search').addEventListener('input', e => { filter = e.target.value; render(); });
  $('#coin-body').addEventListener('click', e => {
    const row = e.target.closest('tr[data-id]');
    if(!row) return;
    expandedId = expandedId === row.dataset.id ? null : row.dataset.id;
    render();
  });
});
