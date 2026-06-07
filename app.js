const API = 'https://api.github.com';
const ACCENT = '#c9f23f';
let langChart = null;

// GitHub's full contribution calendar isn't in the public REST API (only the
// last ~90 days of /events are). We scrape the real public calendar HTML through
// a CORS proxy, with fallbacks. If all fail we degrade to the /events graph.
const PROXIES = [
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u)
];

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
        const [uRes, rRes] = await Promise.all([
            fetch(`${API}/users/${username}`),
            fetch(`${API}/users/${username}/repos?per_page=100&sort=updated`)
        ]);

        if (uRes.status === 404) throw new Error('not found');
        if (uRes.status === 403) throw new Error('rate limit');
        if (!uRes.ok) throw new Error('api error');

        const user  = await uRes.json();
        const repos = await rRes.json().then(d => Array.isArray(d) ? d : []);

        // Real contribution calendar (best effort). Falls back to /events.
        let calendar = await fetchCalendar(username);
        if (!calendar) {
            const events = await fetch(`${API}/users/${username}/events?per_page=100`)
                .then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []);
            calendar = calendarFromEvents(events);
        }

        render(user, repos, calendar);
    } catch (err) {
        showError(err.message);
    }
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(user, repos, calendar) {
    if (langChart) { langChart.destroy(); langChart = null; }

    const { current, longest } = streaksFromCells(calendar.cells);

    const dash = el('div', 'dashboard');
    dash.append(
        profilePanel(user, current, longest),
        heatmapPanel(calendar),
        languagesPanel(repos),
        reposPanel(repos),
        statsPanel(user, repos)
    );
    document.getElementById('dashArea').replaceChildren(dash);

    drawChart(repos);
}

// ── Contribution calendar (real, via proxy) ───────────────────────────────────

async function fetchCalendar(username) {
    const target = `https://github.com/users/${username}/contributions`;
    for (const proxy of PROXIES) {
        try {
            const r = await fetch(proxy(target));
            if (!r.ok) continue;
            const parsed = parseCalendar(await r.text());
            if (parsed.cells.length) return parsed;
        } catch (_) { /* try next proxy */ }
    }
    return null;
}

function parseCalendar(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // day-count lives in the tooltip linked by id ("10 contributions on June 8th.")
    const counts = {};
    doc.querySelectorAll('tool-tip').forEach(t => {
        const m = t.textContent.trim().match(/^([\d,]+|No)/);
        counts[t.getAttribute('for')] = m ? (m[1] === 'No' ? 0 : +m[1].replace(/,/g, '')) : 0;
    });

    const cells = [];
    doc.querySelectorAll('td.ContributionCalendar-day').forEach(td => {
        const date = td.getAttribute('data-date');
        if (!date) return;
        const p = td.id.split('-'); // contribution-day-component-{weekday}-{week}
        cells.push({
            date,
            level: +(td.getAttribute('data-level') || 0),
            count: counts[td.id] ?? 0,
            week: +p[4], day: +p[3]
        });
    });

    let total = cells.reduce((a, c) => a + c.count, 0);
    const h2 = doc.querySelector('h2');
    const tm = h2 && h2.textContent.replace(/,/g, '').match(/(\d+)\s+contribution/i);
    if (tm) total = +tm[1];

    return { cells, total, partial: false };
}

// fallback: synthesize cells from the last ~90 days of public push events
function calendarFromEvents(events) {
    const map = {};
    events.forEach(e => {
        if (e.type === 'PushEvent') {
            const k = dateKey(new Date(e.created_at));
            map[k] = (map[k] || 0) + (e.payload?.commits?.length || 1);
        }
    });
    const cells = [];
    const today = new Date();
    const start = new Date(today); start.setDate(start.getDate() - 363);
    // align start to Sunday so weekday rows match
    start.setDate(start.getDate() - start.getDay());
    for (let i = 0, d = new Date(start); d <= today; d.setDate(d.getDate() + 1), i++) {
        const k = dateKey(d);
        const c = map[k] || 0;
        cells.push({ date: k, level: level(c), count: c, week: Math.floor(i / 7), day: d.getDay() });
    }
    return { cells, total: Object.values(map).reduce((a, b) => a + b, 0), partial: true };
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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COL_W = 14; // cell 11 + gap 3

function heatmapPanel(cal) {
    const p = panel('panel-heatmap');

    // group cells into week columns
    const byWeek = {};
    let maxWeek = 0;
    cal.cells.forEach(c => { (byWeek[c.week] ||= {})[c.day] = c; if (c.week > maxWeek) maxWeek = c.week; });

    // build grid columns + month labels
    const cols = [];
    const monthLabels = [];
    let lastMonth = -1;
    for (let w = 0; w <= maxWeek; w++) {
        const week = byWeek[w] || {};
        const slots = [];
        let repDate = null;
        for (let d = 0; d < 7; d++) {
            const c = week[d];
            if (c) {
                if (!repDate) repDate = c.date;
                slots.push(`<div class="cell" data-l="${c.level}" title="${c.count} on ${c.date}"></div>`);
            } else {
                slots.push(`<div class="cell empty"></div>`);
            }
        }
        cols.push(`<div class="heatmap-week">${slots.join('')}</div>`);

        if (repDate) {
            const mo = +repDate.slice(5, 7) - 1;
            if (mo !== lastMonth) {
                lastMonth = mo;
                monthLabels.push(`<span style="left:${w * COL_W}px">${MONTHS[mo]}</span>`);
            }
        }
    }

    const sub = cal.partial
        ? 'in the last 90 days · public push events only'
        : 'contributions in the last year';

    p.innerHTML = `
        <div class="panel-h">
            <span class="panel-title">Contribution Activity</span>
            <span class="legend">less
                <span class="legend-cells">
                    <span class="cell"></span><span class="cell" data-l="1"></span><span class="cell" data-l="2"></span><span class="cell" data-l="3"></span><span class="cell" data-l="4"></span>
                </span>more</span>
        </div>
        <div class="heatmap-headline">
            <span class="heatmap-big">${fmt(cal.total)}</span>
            <span class="heatmap-sub">${sub}</span>
        </div>
        <div class="heatmap-body">
            <div class="cal">
                <div class="cal-weekdays"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
                <div class="cal-main">
                    <div class="cal-months">${monthLabels.join('')}</div>
                    <div class="cal-grid">${cols.join('')}</div>
                </div>
            </div>
        </div>`;
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

function streaksFromCells(cells) {
    const sorted = [...cells].sort((a, b) => a.date < b.date ? -1 : 1);
    let longest = 0, run = 0;
    for (const c of sorted) {
        if (c.count > 0) { run++; if (run > longest) longest = run; }
        else run = 0;
    }
    // current: count back from the latest day; ignore today if it's still empty
    let i = sorted.length - 1, current = 0;
    if (i >= 0 && sorted[i].count === 0) i--;
    for (; i >= 0; i--) { if (sorted[i].count > 0) current++; else break; }
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
