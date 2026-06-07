const API = 'https://api.github.com';
let langChart = null;

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const user = params.get('user');
    if (user) {
        document.getElementById('usernameInput').value = user;
        load(user);
    } else {
        showEmpty();
    }

    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('usernameInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSearch();
    });
    document.getElementById('exampleUser').addEventListener('click', () => {
        document.getElementById('usernameInput').value = 'torvalds';
        handleSearch();
    });
});

function handleSearch() {
    const user = document.getElementById('usernameInput').value.trim();
    if (!user) return;
    history.replaceState({}, '', `?user=${encodeURIComponent(user)}`);
    load(user);
}

// ── Load & render ─────────────────────────────────────────────────────────────

async function load(username) {
    showSkeleton();
    try {
        const [uRes, rRes, eRes] = await Promise.all([
            fetch(`${API}/users/${username}`),
            fetch(`${API}/users/${username}/repos?per_page=100&sort=updated`),
            fetch(`${API}/users/${username}/events?per_page=100`)
        ]);

        if (!uRes.ok) throw new Error(uRes.status === 404 ? 'not found' : 'api error');

        const user   = await uRes.json();
        const repos  = await rRes.json().then(d => Array.isArray(d) ? d : []);
        const events = await eRes.json().then(d => Array.isArray(d) ? d : []);

        renderDashboard(user, repos, events);
    } catch (err) {
        showError(err.message);
    }
}

// ── Dashboard shell ───────────────────────────────────────────────────────────

function renderDashboard(user, repos, events) {
    if (langChart) { langChart.destroy(); langChart = null; }

    const dash = document.createElement('div');
    dash.className = 'dashboard';

    dash.appendChild(buildProfilePanel(user, events));
    dash.appendChild(buildHeatmapPanel(events));
    dash.appendChild(buildLanguagesPanel(repos));
    dash.appendChild(buildReposPanel(repos));

    document.getElementById('dashArea').replaceChildren(dash);
}

// ── Profile panel (col 1, full height) ───────────────────────────────────────

function buildProfilePanel(user, events) {
    const { currentStreak, longestStreak } = calcStreaks(events);

    const p = panel('panel-profile');

    p.innerHTML = `
        <img class="profile-avatar" src="${user.avatar_url}" alt="${user.login}">
        <div class="profile-name">${user.name || user.login}</div>
        <div class="profile-login">@${user.login}</div>
        ${user.bio ? `<div class="profile-bio">${esc(user.bio)}</div>` : ''}
        <div class="profile-stats">
            <div class="stat-box">
                <span class="stat-value">${fmt(user.followers)}</span>
                <div class="stat-label">Followers</div>
            </div>
            <div class="stat-box">
                <span class="stat-value">${fmt(user.following)}</span>
                <div class="stat-label">Following</div>
            </div>
            <div class="stat-box">
                <span class="stat-value">${fmt(user.public_repos)}</span>
                <div class="stat-label">Repos</div>
            </div>
            <div class="stat-box">
                <span class="stat-value">${fmt(user.public_gists)}</span>
                <div class="stat-label">Gists</div>
            </div>
        </div>
        <hr class="profile-divider">
        <a href="https://github.com/${user.login}" target="_blank" rel="noopener"
           class="profile-link">↗ GitHub Profile</a>
        <div class="streak-badges">
            <div class="streak-badge">
                <span class="streak-icon">🔥</span>
                <div>
                    <div class="streak-text-val">${currentStreak}d</div>
                    <div class="streak-text-label">Current streak</div>
                </div>
            </div>
            <div class="streak-badge">
                <span class="streak-icon">🏆</span>
                <div>
                    <div class="streak-text-val">${longestStreak}d</div>
                    <div class="streak-text-label">Longest streak</div>
                </div>
            </div>
        </div>
    `;
    return p;
}

// ── Heatmap panel (col 2, row 1) ──────────────────────────────────────────────

function buildHeatmapPanel(events) {
    const p = panel('panel-heatmap');

    const contribMap = buildContribMap(events);
    const today = new Date();
    const weeks = [];

    for (let w = 51; w >= 0; w--) {
        const days = [];
        for (let d = 0; d < 7; d++) {
            const dt = new Date(today);
            dt.setDate(dt.getDate() - w * 7 + d);
            const key = dateKey(dt);
            const count = contribMap[key] || 0;
            const lvl = level(count);
            days.push(`<div class="heatmap-day" data-level="${lvl}" title="${key}: ${count} commits"></div>`);
        }
        weeks.push(`<div class="heatmap-week">${days.join('')}</div>`);
    }

    p.innerHTML = `
        <div class="panel-title">Contribution Activity</div>
        <div class="heatmap-wrap">
            <div class="heatmap">${weeks.join('')}</div>
        </div>
        <div class="heatmap-note">Based on recent public push events</div>
    `;
    return p;
}

// ── Languages panel (col 3, row 1) ────────────────────────────────────────────

function buildLanguagesPanel(repos) {
    const p = panel('panel-languages');
    p.innerHTML = `<div class="panel-title">Top Languages</div><div class="chart-wrap"><canvas id="langCanvas"></canvas></div>`;

    const langs = {};
    repos.forEach(r => { if (r.language) langs[r.language] = (langs[r.language] || 0) + (r.size || 1); });
    const top = Object.entries(langs).sort((a,b) => b[1]-a[1]).slice(0, 6);

    if (top.length === 0) {
        p.querySelector('.chart-wrap').innerHTML = '<div class="panel-empty">No data</div>';
        return p;
    }

    setTimeout(() => {
        const ctx = document.getElementById('langCanvas');
        if (!ctx) return;
        langChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: top.map(([l]) => l),
                datasets: [{
                    data: top.map(([,v]) => v),
                    backgroundColor: ['#58a6ff','#3fb950','#a371f7','#f0883e','#ff7b72','#79c0ff'],
                    borderColor: '#161b22',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#8b949e',
                            font: { size: 11 },
                            boxWidth: 10,
                            padding: 8
                        }
                    }
                },
                cutout: '62%'
            }
        });
    }, 0);

    return p;
}

// ── Repos panel (col 2, row 2) ────────────────────────────────────────────────

function buildReposPanel(repos) {
    const p = panel('panel-repos');
    p.innerHTML = `<div class="panel-title">Top Repositories</div><div class="repos-list" id="reposList"></div>`;

    const top = repos.filter(r => !r.fork).sort((a,b) => (b.stargazers_count||0)-(a.stargazers_count||0)).slice(0, 6);
    const list = p.querySelector('#reposList');

    if (top.length === 0) {
        list.innerHTML = '<div class="panel-empty">No repos</div>';
        return p;
    }

    top.forEach(r => {
        const row = document.createElement('a');
        row.className = 'repo-row';
        row.href = r.html_url;
        row.target = '_blank';
        row.rel = 'noopener';
        row.innerHTML = `
            <span class="lang-dot" style="background:${langColor(r.language)}"></span>
            <span class="repo-name">${esc(r.name)}</span>
            <span class="repo-desc">${esc(r.description || '')}</span>
            <span class="repo-stars">⭐ ${fmt(r.stargazers_count || 0)}</span>
        `;
        list.appendChild(row);
    });
    return p;
}

// ── States ────────────────────────────────────────────────────────────────────

function showEmpty() {
    document.getElementById('dashArea').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚡</div>
            <div class="empty-state-text">Enter a GitHub username to get started</div>
        </div>`;
}

function showSkeleton() {
    document.getElementById('dashArea').innerHTML = `
        <div class="skeleton-grid">
            <div class="skel-panel" style="grid-row:1/3">
                <div class="skel-line" style="width:60px;height:60px;border-radius:50%"></div>
                <div class="skel-line" style="width:80%;margin-top:12px"></div>
                <div class="skel-line" style="width:55%"></div>
                <div class="skel-line" style="width:90%;margin-top:12px;height:60px"></div>
            </div>
            <div class="skel-panel"><div class="skel-line" style="width:100%;height:100px;margin:0"></div></div>
            <div class="skel-panel"><div class="skel-line" style="width:100%;height:100%;margin:0;border-radius:8px"></div></div>
            <div class="skel-panel"><div class="skel-line" style="width:100%;height:100%;margin:0;border-radius:8px"></div></div>
        </div>`;
}

function showError(msg) {
    const friendly = msg.includes('not found')
        ? 'User not found. Check the username and try again.'
        : msg.includes('rate limit') || msg.includes('403')
        ? 'GitHub API rate limit hit. Wait a minute and try again.'
        : 'Something went wrong. Try again.';

    document.getElementById('dashArea').innerHTML = `
        <div class="error-wrap">
            <div class="error-card">
                <div class="error-icon">⚠️</div>
                <div class="error-title">Oops!</div>
                <div class="error-msg">${friendly}</div>
                <button class="error-retry" onclick="document.getElementById('usernameInput').focus()">Try Another</button>
            </div>
        </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function panel(cls) {
    const d = document.createElement('div');
    d.className = `panel ${cls}`;
    return d;
}

function buildContribMap(events) {
    const map = {};
    events.forEach(e => {
        if (e.type === 'PushEvent') {
            const key = dateKey(new Date(e.created_at));
            map[key] = (map[key] || 0) + (e.payload?.commits?.length || 1);
        }
    });
    return map;
}

function calcStreaks(events) {
    const days = new Set();
    events.forEach(e => {
        if (e.type === 'PushEvent') {
            const d = new Date(e.created_at);
            d.setHours(0,0,0,0);
            days.add(d.getTime());
        }
    });

    if (!days.size) return { currentStreak: 0, longestStreak: 0 };

    const today = new Date(); today.setHours(0,0,0,0);
    let cur = 0, check = new Date(today);
    while (days.has(check.getTime())) { cur++; check.setDate(check.getDate()-1); }

    const sorted = Array.from(days).sort((a,b)=>a-b);
    let longest = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
        if ((sorted[i]-sorted[i-1]) === 86400000) { run++; longest = Math.max(longest,run); }
        else run = 1;
    }

    return { currentStreak: cur, longestStreak: longest };
}

function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function level(n) {
    if (n === 0) return 0;
    if (n <= 2)  return 1;
    if (n <= 5)  return 2;
    if (n <= 10) return 3;
    return 4;
}

function fmt(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
    if (n >= 1e3) return (n/1e3).toFixed(1)+'k';
    return String(n);
}

function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function langColor(lang) {
    const map = {
        JavaScript:'#f1e05a', TypeScript:'#3178c6', Python:'#3572A5',
        Java:'#b07219', 'C++':'#f34b7d', Go:'#00ADD8', Rust:'#ce422b',
        Ruby:'#cc342d', PHP:'#777bb4', 'C#':'#239120', Kotlin:'#7f52ff',
        Swift:'#fa7343', HTML:'#e34c26', CSS:'#563d7c', Dart:'#00B4AB'
    };
    return map[lang] || '#58a6ff';
}
