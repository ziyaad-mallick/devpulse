const API = 'https://api.github.com';
const PROXIES = [
  u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u)
];
function fmt(n){ n=n||0; return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':String(n); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function dateKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function level(n){ return n===0?0:n<=2?1:n<=5?2:n<=10?3:4; }
function langColor(lang){ const m={JavaScript:'#f1e05a',TypeScript:'#3178c6',Python:'#3572A5',Java:'#b07219','C++':'#f34b7d',C:'#aaaaaa',Go:'#00ADD8',Rust:'#ce422b',Ruby:'#cc342d',PHP:'#777bb4','C#':'#239120',Kotlin:'#7f52ff',Swift:'#fa7343',HTML:'#e34c26',CSS:'#563d7c',Dart:'#00B4AB',Shell:'#89e051'}; return m[lang]||'#6a6a66'; }
async function fetchCalendar(username){
  const target=`https://github.com/users/${username}/contributions`;
  for(const proxy of PROXIES){ try{ const r=await fetch(proxy(target)); if(!r.ok) continue; const parsed=parseCalendar(await r.text()); if(parsed.cells.length) return parsed; }catch(_){} }
  return null;
}
function parseCalendar(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const counts={};
  doc.querySelectorAll('tool-tip').forEach(t=>{ const m=t.textContent.trim().match(/^([\d,]+|No)/); counts[t.getAttribute('for')]=m?(m[1]==='No'?0:+m[1].replace(/,/g,'')):0; });
  const cells=[];
  doc.querySelectorAll('td.ContributionCalendar-day').forEach(td=>{ const date=td.getAttribute('data-date'); if(!date) return; const p=td.id.split('-'); cells.push({date,level:+(td.getAttribute('data-level')||0),count:counts[td.id]??0,week:+p[4],day:+p[3]}); });
  let total=cells.reduce((a,c)=>a+c.count,0);
  const h2=doc.querySelector('h2'); const tm=h2&&h2.textContent.replace(/,/g,'').match(/(\d+)\s+contribution/i); if(tm) total=+tm[1];
  return {cells,total};
}

async function pool(items, n, worker) {
  const results = [];
  let idx = 0;
  const active = [];
  for(let i = 0; i < n && i < items.length; i++){
    const p = worker(items[idx++]).then(r => {results[idx - 1] = r; if(idx < items.length) return pool_next();});
    active.push(p);
  }
  async function pool_next(){
    if(idx >= items.length) return;
    const i = idx++;
    return worker(items[i]).then(r => {results[i] = r; if(idx < items.length) return pool_next();});
  }
  await Promise.all(active);
  return results;
}

let candidates = [];
let sortKey = null;
let sortAsc = true;
let hasRateLimit = false;

function parseUsernames() {
  const textarea = document.getElementById('usernamesInput');
  let names = textarea.value.split(/[\n,]/);

  names = names.map(n => {
    n = n.trim();
    if(n.startsWith('@')) n = n.slice(1);
    const m = n.match(/github\.com\/([^\/\?#]+)/i);
    if(m) n = m[1];
    return n.toLowerCase();
  }).filter(n => n.length > 0);

  return [...new Set(names)];
}

async function parseCSVFile(file) {
  const text = await file.text();
  let names = text.split(/[\n,]/);

  const headerTokens = names[0].toLowerCase().split(/[,\s]+/);
  const hasUserHeader = headerTokens.some(t => ['user', 'username', 'login'].includes(t));

  if(hasUserHeader) names = names.slice(1);

  names = names.map(n => {
    n = n.trim();
    if(n.startsWith('@')) n = n.slice(1);
    const m = n.match(/github\.com\/([^\/\?#]+)/i);
    if(m) n = m[1];
    return n.toLowerCase();
  }).filter(n => n.length > 0);

  return names;
}

async function fetchUserData(login, token) {
  const headers = token ? {Authorization: `token ${token}`} : {};

  try {
    const userRes = await fetch(`${API}/users/${login}`, {headers});
    if(userRes.status === 404) return {login, error: 'not found'};
    if(userRes.status === 403) {
      hasRateLimit = true;
      return {login, error: 'rate limit'};
    }
    if(!userRes.ok) throw new Error(`${userRes.status}`);

    const user = await userRes.json();

    const reposRes = await fetch(`${API}/users/${login}/repos?per_page=100&sort=updated`, {headers});
    if(reposRes.status === 403) {
      hasRateLimit = true;
      return {login, error: 'rate limit'};
    }
    if(!reposRes.ok) throw new Error(`${reposRes.status}`);

    const repos = await reposRes.json();

    const calendar = await fetchCalendar(login);

    const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    const topRepo = repos
      .filter(r => !r.fork)
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))[0] || null;

    const langMap = {};
    repos.forEach(r => {
      if(r.language) langMap[r.language] = (langMap[r.language] || 0) + 1;
    });
    const topLangs = Object.entries(langMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => ({lang, color: langColor(lang)}));

    return {
      login,
      name: user.name,
      avatar_url: user.avatar_url,
      html_url: user.html_url,
      followers: user.followers,
      public_repos: user.public_repos,
      totalStars,
      topRepo: topRepo ? {name: topRepo.name, html_url: topRepo.html_url, stars: topRepo.stargazers_count, language: topRepo.language} : null,
      topLangs,
      contributions: calendar,
      error: null
    };
  } catch(e) {
    return {login, error: 'failed'};
  }
}

function renderTable() {
  const resultsDiv = document.getElementById('batchResults');
  const html = `<table class="cmp-table">
    <thead>
      <tr>
        <th>#</th>
        <th class="sortable" data-key="name">Candidate <span class="sort-ind"></span></th>
        <th class="sortable" data-key="followers">Followers <span class="sort-ind"></span></th>
        <th class="sortable" data-key="repos">Repos <span class="sort-ind"></span></th>
        <th class="sortable" data-key="stars">Stars <span class="sort-ind"></span></th>
        <th class="sortable" data-key="contributions">Activity <span class="sort-ind"></span></th>
        <th>Top Repo</th>
        <th class="sortable" data-key="language">Languages <span class="sort-ind"></span></th>
      </tr>
    </thead>
    <tbody id="cmp-tbody"></tbody>
  </table>`;
  resultsDiv.innerHTML = html;
  renderRows();
}

function renderRows() {
  const sorted = [...candidates];

  if(sortKey) {
    sorted.sort((a, b) => {
      let av, bv;

      if(sortKey === 'name') {
        av = (a.name || a.login || '').toLowerCase();
        bv = (b.name || b.login || '').toLowerCase();
        const cmp = av.localeCompare(bv);
        return sortAsc ? cmp : -cmp;
      } else if(sortKey === 'language') {
        av = a.topLangs?.[0]?.lang || '';
        bv = b.topLangs?.[0]?.lang || '';
        if(!av) av = '￿';
        if(!bv) bv = '￿';
        const cmp = av.localeCompare(bv);
        return sortAsc ? cmp : -cmp;
      } else {
        const numKey = {followers: 'followers', repos: 'public_repos', stars: 'totalStars', contributions: c => c.contributions?.total || 0}[sortKey];
        av = (typeof numKey === 'function' ? numKey(a) : a[numKey]) || -1;
        bv = (typeof numKey === 'function' ? numKey(b) : b[numKey]) || -1;
        if(a.error) av = -1;
        if(b.error) bv = -1;
        return sortAsc ? av - bv : bv - av;
      }
    });
  } else {
    sorted.sort((a, b) => a._idx - b._idx);
  }

  const tbody = document.getElementById('cmp-tbody');
  tbody.innerHTML = sorted.map((c, i) => renderRow(c, i + 1)).join('');

  const ths = document.querySelectorAll('th.sortable');
  ths.forEach(th => {
    th.classList.remove('active');
    th.querySelector('.sort-ind').textContent = '';
  });

  if(sortKey) {
    const activeHeadth = document.querySelector(`th[data-key="${sortKey}"]`);
    if(activeHeadth) {
      activeHeadth.classList.add('active');
      activeHeadth.querySelector('.sort-ind').textContent = sortAsc ? '▲' : '▼';
    }
  }
}

function renderRow(c, position) {
  const nameDisplay = c.name || c.login || '?';
  const loginDisplay = c.login || '?';

  if(c.followers === undefined && !c.error) {
    return `<tr class="cmp-row">
      <td class="cmp-idx">${position}</td>
      <td>
        <div class="cmp-cand">
          <span class="cmp-id"><span class="cmp-name">${esc(loginDisplay)}</span><span class="cmp-login">loading…</span></span>
        </div>
      </td>
      <td colspan="6"><span class="cmp-muted">…</span></td>
    </tr>`;
  }

  if(c.error) {
    return `<tr class="cmp-row">
      <td class="cmp-idx">${position}</td>
      <td>
        <div class="cmp-cand">
          <span class="cmp-id"><span class="cmp-name">${esc(nameDisplay)}</span><span class="cmp-login">@${esc(loginDisplay)}</span></span>
        </div>
      </td>
      <td colspan="6"><span class="cmp-err">${esc(c.error)}</span></td>
    </tr>`;
  }

  const sparkHtml = c.contributions ? renderSpark(c.contributions.cells, c.contributions.total) : '<span class="cmp-muted">—</span>';

  const topRepoHtml = c.topRepo
    ? `<a class="cmp-toprepo" href="${esc(c.topRepo.html_url)}" target="_blank" rel="noopener"><span class="dot" style="background:${langColor(c.topRepo.language)}"></span>${esc(c.topRepo.name)} <span class="cmp-muted">★${fmt(c.topRepo.stars)}</span></a>`
    : '—';

  const langsHtml = c.topLangs.length
    ? c.topLangs.map(({lang, color}) => `<span class="cmp-lang"><span class="dot" style="background:${color}"></span>${esc(lang)}</span>`).join('')
    : '—';

  return `<tr class="cmp-row">
    <td class="cmp-idx">${position}</td>
    <td>
      <a class="cmp-cand" href="${esc(c.html_url)}" target="_blank" rel="noopener">
        <img class="cmp-avatar" src="${esc(c.avatar_url)}" alt="">
        <span class="cmp-id"><span class="cmp-name">${esc(nameDisplay)}</span><span class="cmp-login">@${esc(loginDisplay)}</span></span>
      </a>
    </td>
    <td class="cmp-num">${fmt(c.followers)}</td>
    <td class="cmp-num">${fmt(c.public_repos)}</td>
    <td class="cmp-num">${fmt(c.totalStars)}</td>
    <td><div class="cmp-spark" title="${c.contributions?.total || 0} contributions in the last year">${sparkHtml}</div></td>
    <td>${topRepoHtml}</td>
    <td><div class="cmp-langs">${langsHtml}</div></td>
  </tr>`;
}

function renderSpark(cells, total) {
  const weeks = {};
  cells.forEach(c => {
    if(c.week === undefined || c.day === undefined) return;
    if(!weeks[c.week]) weeks[c.week] = [];
    weeks[c.week][c.day] = c;
  });

  // last 30 week-columns
  const weekKeys = Object.keys(weeks).map(Number).sort((a, b) => a - b).slice(-30);

  return weekKeys.map(w => {
    const week = weeks[w] || [];
    const days = Array.from({length: 7}, (_, day) => {
      const cell = week[day];
      if(!cell) return '<span class="cmp-cell cmp-empty"></span>';
      return `<span class="cmp-cell" data-l="${level(cell.count)}"></span>`;
    }).join('');
    return `<div class="cmp-week">${days}</div>`;
  }).join('');
}

async function runBatch() {
  hasRateLimit = false;
  candidates = [];
  sortKey = null;
  sortAsc = true;

  const progressDiv = document.getElementById('progress');
  const resultsDiv = document.getElementById('batchResults');

  // clear any banner from a previous run
  document.querySelectorAll('.cmp-banner').forEach(b => b.remove());

  let usernames = parseUsernames();

  const fileInput = document.getElementById('csvInput');
  if(fileInput && fileInput.files.length > 0) {
    const csvNames = await parseCSVFile(fileInput.files[0]);
    usernames = [...new Set([...usernames, ...csvNames])];
  }

  if(usernames.length === 0) {
    progressDiv.textContent = 'Add at least one username.';
    resultsDiv.innerHTML = '';
    return;
  }

  progressDiv.textContent = `loaded 0 / ${usernames.length}`;

  candidates = usernames.map((login, idx) => ({login, _idx: idx}));
  renderTable();

  const token = document.getElementById('tokenInput').value.trim();

  let done = 0;
  await pool(usernames, 4, async (login) => {
    const data = await fetchUserData(login, token);
    const idx = candidates.findIndex(c => c.login === login);
    if(idx >= 0) {
      candidates[idx] = {...candidates[idx], ...data};
    }
    done++;
    progressDiv.textContent = `loaded ${done} / ${usernames.length}`;
    renderRows();
  });

  progressDiv.textContent = `${usernames.length} candidates`;

  if(hasRateLimit) {
    const banner = document.createElement('div');
    banner.className = 'cmp-banner';
    banner.textContent = "GitHub's unauthenticated API allows 60 requests/hour. Add an optional token above to raise it to 5,000/hr.";
    resultsDiv.parentNode.insertBefore(banner, resultsDiv);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const runBtn = document.getElementById('runBatch');
  const textarea = document.getElementById('usernamesInput');

  runBtn.addEventListener('click', runBatch);
  textarea.addEventListener('keydown', (e) => {
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runBatch();
    }
  });

  document.getElementById('batchResults').addEventListener('click', (e) => {
    if(e.target.closest('th.sortable')) {
      const th = e.target.closest('th.sortable');
      const key = th.dataset.key;
      if(sortKey === key) {
        sortAsc = !sortAsc;
      } else {
        sortKey = key;
        sortAsc = true;
      }
      renderRows();
    }
  });
});
