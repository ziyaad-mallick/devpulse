const API = 'https://api.github.com';
const ACCENT = '#c9f23f';
let langChart = null;

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const user = new URLSearchParams(location.search).get('user');
    if (user) {
        document.getElementById('usernameInput').value = user;
        load(user);
    } else {
        showStart();
    }

    document.getElementById('searchForm').addEventListener('submit', e => {
        e.preventDefault();
        const u = document.getElementById('usernameInput').value.trim();
        if (!u) return;
        history.replaceState({}, '', `?user=${encodeURIComponent(u)}`);
        load(u);
    });
    document.getElementById('exampleUser').addEventListener('click', () => {
        document.getElementById('usernameInput').value = 'torvalds';
        document.getElementById('searchForm').requestSubmit();
    });
});

// ── Load ──────────────────────────────────────────────────────────────────────

async function load(username) {
    showSkeleton();
    try {
        const [uRes, rRes, eRes] = await Promise.all([
            fetch(`${API}/users/${username}`),
            fetch(`${API}/users/${username}/repos?per_page=100&sort=updated`),
            fetch(`${API}/users/${username}/events?per_page=100`)
        ]);

        if (uRes.status === 404) throw new Error('not found');
        if (uRes.status === 403) throw new Error('rate limit');
        if (!uRes.ok) throw new Error('api error');

        const user   = await uRes.json();
        const repos  = await rRes.json().then(d => Array.isArray(d) ? d : []);
        const events = await eRes.json().then(d => Array.isArray(d) ? d : []);

        render(user, repos, events);
    } catch (err) {
        showError(err.message);
    }
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(user, repos, events) {
    if (langChart) { langChart.destroy(); langChart = null; }

    const contrib = buildContrib(events);
    const { current, longest } = streaks(events);
    const totalPushes = Object.values(contrib).reduce((a, b) => a + b, 0);
    const activeDays = Object.keys(contrib).length;

    const dash = el('div', 'dashboard');
    dash.append(
        profilePanel(user, current, longest),
        heatmapPanel(contrib, totalPushes),
        languagesPanel(repos),
        reposPanel(repos),
        statsPanel(user, repos)
    );
    document.getElementById('dashArea').replaceChildren(dash);

    drawChart(repos);
}

// ── Profile panel ─────────────────────────────────────────────────────────────

function profilePanel(u, current, longest) {
    const p = panel('panel-profile');
    p.innerHTML = `
        <div class="profile-top">
            <img class="profile-avatar" src="${u.avatar_url}" alt="">
            <div class="profile-id">
                <div class="profile-name">${esc(u.name || u.login)}</div>
                <div class="profile-login">@${esc(u.login)}</div>
            </div>
        </div>
        ${u.bio ? `<div class="profile-bio">${esc(u.bio)}</div>` : ''}
        <div class="profile-stats">
            ${mini(u.followers, 'Followers')}
            ${mini(u.following, 'Following')}
            ${mini(u.public_repos, 'Repos')}
            ${mini(u.public_gists, 'Gists')}
        </div>
        <a class="profile-link" href="https://github.com/${esc(u.login)}" target="_blank" rel="noopener">
            <span>View on GitHub</span><span class="arrow">→</span>
        </a>
        <div class="streak-strip">
            <div class="streak ${current > 0 ? 'is-live' : ''}">
                <div><span class="streak-val">${current}</span><span class="streak-unit">d</span></div>
                <div class="streak-label">Current</div>
            </div>
            <div class="streak">
                <div><span class="streak-val">${longest}</span><span class="streak-unit">d</span></div>
                <div class="streak-label">Longest</div>
            </div>
        </div>`;
    return p;
}

function mini(val, label) {
    return `<div class="mini"><div class="mini-val">${fmt(val)}</div><div class="mini-label">${label}</div></div>`;
}

// ── Heatmap panel ─────────────────────────────────────────────────────────────

function heatmapPanel(contrib, totalPushes) {
    const p = panel('panel-heatmap');
    const today = new Date();
    const weeks = [];
    for (let w = 51; w >= 0; w--) {
        const days = [];
        for (let d = 0; d < 7; d++) {
            const dt = new Date(today);
            dt.setDate(dt.getDate() - w * 7 + d);
            const k = dateKey(dt);
            const c = contrib[k] || 0;
            days.push(`<div class="cell" data-l="${level(c)}" title="${k} · ${c}"></div>`);
        }
        weeks.push(`<div class="heatmap-week">${days.join('')}</div>`);
    }

    p.innerHTML = `
        <div class="panel-h">
            <span class="panel-title">Push Activity</span>
            <span class="legend">less
                <span class="legend-cells">
                    <span class="cell"></span>
                    <span class="cell" data-l="1"></span>
                    <span class="cell" data-l="2"></span>
                    <span class="cell" data-l="3"></span>
                    <span class="cell" data-l="4"></span>
                </span>more</span>
        </div>
        <div class="heatmap-headline">
            <span class="heatmap-big">${fmt(totalPushes)}</span>
            <span class="heatmap-sub">commits pushed · recent public events</span>
        </div>
        <div class="heatmap-body"><div class="heatmap">${weeks.join('')}</div></div>`;
    return p;
}

// ── Languages panel ───────────────────────────────────────────────────────────

function languagesPanel(repos) {
    const p = panel('panel-languages');
    p.innerHTML = `<div class="panel-h"><span class="panel-title">Languages</span></div>
                   <div class="chart-wrap"><canvas id="langCanvas"></canvas></div>`;
    return p;
}

function drawChart(repos) {
    const langs = {};
    repos.forEach(r => { if (r.language) langs[r.language] = (langs[r.language] || 0) + (r.size || 1); });
    const top = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const wrap = document.querySelector('.panel-languages .chart-wrap');
    if (!wrap) return;
    if (!top.length) { wrap.innerHTML = '<div class="panel-empty">no language data</div>'; return; }

    // accent for #1, designer-muted tones for the rest (no rainbow)
    const palette = [ACCENT, '#8aa0b4', '#d6b27a', '#c98a8a', '#9caf88', '#6a6a66'];

    langChart = new Chart(document.getElementById('langCanvas'), {
        type: 'doughnut',
        data: {
            labels: top.map(([l]) => l),
            datasets: [{
                data: top.map(([, v]) => v),
                backgroundColor: palette.slice(0, top.length),
                borderColor: '#141416',
                borderWidth: 3,
                hoverOffset: 5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '64%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9a9a95',
                        font: { family: "'JetBrains Mono', monospace", size: 11 },
                        boxWidth: 9, boxHeight: 9, padding: 9, usePointStyle: true, pointStyle: 'rectRounded'
                    }
                },
                tooltip: {
                    backgroundColor: '#1c1c1f', borderColor: 'rgba(255,255,255,0.11)', borderWidth: 1,
                    titleColor: '#ededeb', bodyColor: '#9a9a95', padding: 10, displayColors: false,
                    titleFont: { family: "'JetBrains Mono', monospace" }
                }
            }
        }
    });
}

// ── Repos panel ───────────────────────────────────────────────────────────────

function reposPanel(repos) {
    const p = panel('panel-repos');
    p.innerHTML = `<div class="panel-h"><span class="panel-title">Top Repositories</span></div>`;
    const list = el('div', 'repos');

    const top = repos.filter(r => !r.fork)
        .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        .slice(0, 6);

    if (!top.length) { list.innerHTML = '<div class="panel-empty">no public repositories</div>'; }
    top.forEach(r => {
        const a = el('a', 'repo');
        a.href = r.html_url; a.target = '_blank'; a.rel = 'noopener';
        a.innerHTML = `
            <span class="dot" style="background:${langColor(r.language)}"></span>
            <span class="repo-name">${esc(r.name)}</span>
            <span class="repo-desc">${esc(r.description || '')}</span>
            <span class="repo-stars"><span class="star">★</span> ${fmt(r.stargazers_count || 0)}</span>`;
        list.appendChild(a);
    });
    p.appendChild(list);
    return p;
}

// ── Key stats panel ───────────────────────────────────────────────────────────

function statsPanel(user, repos) {
    const p = panel('panel-stats');
    const totalStars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const totalForks = repos.reduce((s, r) => s + (r.forks_count || 0), 0);
    const ageYears = ((Date.now() - new Date(user.created_at)) / (365.25 * 864e5));
    const ageStr = ageYears >= 1 ? ageYears.toFixed(1) : Math.round(ageYears * 12);
    const ageUnit = ageYears >= 1 ? 'yr' : 'mo';

    p.innerHTML = `
        <div class="panel-h"><span class="panel-title">Signals</span></div>
        <div class="stat-grid">
            <div class="stat-cell accent"><div class="v">${fmt(totalStars)}</div><div class="k">Total Stars</div></div>
            <div class="stat-cell"><div class="v">${fmt(totalForks)}</div><div class="k">Total Forks</div></div>
            <div class="stat-cell"><div class="v">${ageStr}<span class="u">${ageUnit}</span></div><div class="k">On GitHub</div></div>
            <div class="stat-cell"><div class="v">${fmt(user.public_repos)}</div><div class="k">Public Repos</div></div>
        </div>`;
    return p;
}

// ── States ────────────────────────────────────────────────────────────────────

function showStart() {
    document.getElementById('dashArea').innerHTML = `
        <div class="center-state">
            <span class="cs-mark"></span>
            <div class="cs-title">read a developer at a glance</div>
            <div class="cs-text">Enter a GitHub username to see their push rhythm, language mix, top work, and credibility signals — all on one screen.</div>
        </div>`;
}

function showSkeleton() {
    document.getElementById('dashArea').innerHTML = `
        <div class="dashboard">
            <div class="skel s-profile"></div>
            <div class="skel s-heat"></div>
            <div class="skel s-lang"></div>
            <div class="skel s-repo"></div>
            <div class="skel s-stat"></div>
        </div>`;
}

function showError(msg) {
    const text = msg.includes('not found') ? "No GitHub user by that name. Check the spelling and try again."
        : msg.includes('rate limit') ? "GitHub's API rate limit is hit (60 requests/hr unauthenticated). Give it a minute."
        : "Something went wrong reaching GitHub. Try again.";
    document.getElementById('dashArea').innerHTML = `
        <div class="center-state">
            <div class="cs-title">—</div>
            <div class="cs-text err">${text}</div>
            <button class="cs-btn" onclick="document.getElementById('usernameInput').focus()">Try another</button>
        </div>`;
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function buildContrib(events) {
    const map = {};
    events.forEach(e => {
        if (e.type === 'PushEvent') {
            const k = dateKey(new Date(e.created_at));
            map[k] = (map[k] || 0) + (e.payload?.commits?.length || 1);
        }
    });
    return map;
}

function streaks(events) {
    const days = new Set();
    events.forEach(e => {
        if (e.type === 'PushEvent') {
            const d = new Date(e.created_at); d.setHours(0, 0, 0, 0);
            days.add(d.getTime());
        }
    });
    if (!days.size) return { current: 0, longest: 0 };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let current = 0, c = new Date(today);
    while (days.has(c.getTime())) { current++; c.setDate(c.getDate() - 1); }

    const sorted = [...days].sort((a, b) => a - b);
    let longest = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] === 864e5) longest = Math.max(longest, ++run);
        else run = 1;
    }
    return { current, longest };
}

function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function level(n) { return n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 10 ? 3 : 4; }
function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n ?? 0); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function langColor(lang) {
    const m = { JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
        'C++': '#f34b7d', C: '#aaaaaa', Go: '#00ADD8', Rust: '#ce422b', Ruby: '#cc342d', PHP: '#777bb4',
        'C#': '#239120', Kotlin: '#7f52ff', Swift: '#fa7343', HTML: '#e34c26', CSS: '#563d7c', Dart: '#00B4AB', Shell: '#89e051' };
    return m[lang] || '#6a6a66';
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function panel(cls) { return el('div', `panel ${cls}`); }
