/* DevPulse - GitHub Activity Dashboard */

const API_BASE = 'https://api.github.com';
const RATE_LIMIT_BUFFER = 5; // API calls we'll always reserve
let languageChart = null;

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const username = params.get('user');

    if (username) {
        document.getElementById('usernameInput').value = username;
        loadUserData(username);
    }

    // Event listeners
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('usernameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    document.getElementById('exampleUser').addEventListener('click', () => {
        document.getElementById('usernameInput').value = 'torvalds';
        handleSearch();
    });
});

function handleSearch() {
    const username = document.getElementById('usernameInput').value.trim();
    if (username) {
        window.history.replaceState({}, '', `?user=${encodeURIComponent(username)}`);
        loadUserData(username);
    }
}

// ===== MAIN DATA LOADING =====

async function loadUserData(username) {
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = '';

    try {
        // Show loading skeleton
        showLoadingSkeleton(mainContent);

        // Fetch all data in parallel
        const [userResponse, reposResponse, eventsResponse] = await Promise.all([
            fetch(`${API_BASE}/users/${username}`),
            fetch(`${API_BASE}/users/${username}/repos?per_page=100&sort=updated`),
            fetch(`${API_BASE}/users/${username}/events?per_page=100`)
        ]);

        // Check rate limit
        checkRateLimit(userResponse);

        // Handle errors
        if (!userResponse.ok) {
            throw new Error(`User not found: ${username}`);
        }

        const userData = await userResponse.json();
        const reposRaw = await reposResponse.json();
        const eventsRaw = await eventsResponse.json();

        const reposData = Array.isArray(reposRaw) ? reposRaw : [];
        const eventsData = Array.isArray(eventsRaw) ? eventsRaw : [];

        // Clear loading skeleton
        mainContent.innerHTML = '';

        // Render all sections
        renderProfileCard(userData, mainContent);
        renderHeatmap(eventsData, mainContent, username);
        renderLanguagesChart(reposData, mainContent);
        renderTopRepos(reposData, mainContent);
        renderStreakStats(eventsData, mainContent);

    } catch (error) {
        mainContent.innerHTML = '';
        renderError(error.message, mainContent);
    }
}

// ===== PROFILE CARD =====

function renderProfileCard(userData, container) {
    const card = document.createElement('div');
    card.className = 'card profile-card';

    const avatar = document.createElement('img');
    avatar.src = userData.avatar_url;
    avatar.alt = userData.login;
    avatar.className = 'profile-avatar';

    const info = document.createElement('div');
    info.className = 'profile-info';

    const name = document.createElement('h2');
    name.textContent = userData.name || userData.login;

    const username = document.createElement('p');
    username.className = 'text-secondary';
    username.textContent = `@${userData.login}`;

    const bio = document.createElement('p');
    bio.className = 'profile-bio';
    bio.textContent = userData.bio || '(No bio)';

    const stats = document.createElement('div');
    stats.className = 'profile-stats';

    const statFollowers = createStatItem(userData.followers, 'Followers');
    const statFollowing = createStatItem(userData.following, 'Following');
    const statRepos = createStatItem(userData.public_repos, 'Repos');

    stats.appendChild(statFollowers);
    stats.appendChild(statFollowing);
    stats.appendChild(statRepos);

    const links = document.createElement('div');
    links.className = 'profile-links';

    if (userData.blog && userData.blog.trim()) {
        const blogLink = document.createElement('a');
        blogLink.href = userData.blog.startsWith('http') ? userData.blog : `https://${userData.blog}`;
        blogLink.target = '_blank';
        blogLink.rel = 'noopener noreferrer';
        blogLink.className = 'profile-link-btn';
        blogLink.textContent = '🌐 Website';
        links.appendChild(blogLink);
    }

    const profileLink = document.createElement('a');
    profileLink.href = `https://github.com/${userData.login}`;
    profileLink.target = '_blank';
    profileLink.rel = 'noopener noreferrer';
    profileLink.className = 'profile-link-btn';
    profileLink.textContent = '→ GitHub Profile';
    links.appendChild(profileLink);

    info.appendChild(name);
    info.appendChild(username);
    info.appendChild(bio);
    info.appendChild(stats);
    info.appendChild(links);

    card.appendChild(avatar);
    card.appendChild(info);
    container.appendChild(card);
}

function createStatItem(value, label) {
    const item = document.createElement('div');
    item.className = 'stat-item';

    const statValue = document.createElement('span');
    statValue.className = 'stat-value';
    statValue.textContent = formatNumber(value);

    const statLabel = document.createElement('div');
    statLabel.className = 'stat-label';
    statLabel.textContent = label;

    item.appendChild(statValue);
    item.appendChild(statLabel);
    return item;
}

// ===== HEATMAP =====

function renderHeatmap(events, container, username) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = '📊 Contribution Activity';
    title.style.marginBottom = '20px';
    card.appendChild(title);

    if (!events || events.length === 0) {
        const noData = document.createElement('p');
        noData.className = 'text-secondary';
        noData.textContent = 'No recent events found.';
        card.appendChild(noData);
        container.appendChild(card);
        return;
    }

    // Build heatmap from events
    const contributionMap = buildContributionMap(events);
    const heatmapHtml = generateHeatmapHtml(contributionMap);

    const heatmapContainer = document.createElement('div');
    heatmapContainer.className = 'heatmap-container';
    heatmapContainer.innerHTML = heatmapHtml;
    card.appendChild(heatmapContainer);

    const note = document.createElement('p');
    note.className = 'heatmap-note';
    note.innerHTML = '📈 Based on recent public events (last 90 days)';
    card.appendChild(note);

    container.appendChild(card);
}

function buildContributionMap(events) {
    const today = new Date();
    const map = {};

    // Parse push events and count by day
    events.forEach(event => {
        if (event.type === 'PushEvent') {
            const date = new Date(event.created_at);
            const dateKey = formatDateKey(date);
            map[dateKey] = (map[dateKey] || 0) + (event.payload?.commits?.length || 1);
        }
    });

    return map;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function generateHeatmapHtml(contributionMap) {
    const today = new Date();
    const weeksHtml = [];

    // Generate last 52 weeks
    for (let w = 51; w >= 0; w--) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - w * 7);

        const weekDaysHtml = [];
        for (let d = 0; d < 7; d++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + d);
            const dateKey = formatDateKey(date);
            const count = contributionMap[dateKey] || 0;
            const level = getHeatmapLevel(count);

            weekDaysHtml.push(
                `<div class="heatmap-day" data-level="${level}" title="${dateKey}: ${count} commits"></div>`
            );
        }
        weeksHtml.push(`<div class="heatmap-week">${weekDaysHtml.join('')}</div>`);
    }

    return `<div class="heatmap">${weeksHtml.join('')}</div>`;
}

function getHeatmapLevel(count) {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 10) return 3;
    return 4;
}

// ===== LANGUAGES CHART =====

function renderLanguagesChart(repos, container) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = '💻 Top Languages';
    title.style.marginBottom = '20px';
    card.appendChild(title);

    // Aggregate languages by bytes
    const languages = {};
    repos.forEach(repo => {
        if (repo.language) {
            languages[repo.language] = (languages[repo.language] || 0) + (repo.size || 0);
        }
    });

    if (Object.keys(languages).length === 0) {
        const noData = document.createElement('p');
        noData.className = 'no-data-message';
        noData.textContent = 'No language data available.';
        card.appendChild(noData);
        container.appendChild(card);
        return;
    }

    // Sort and take top 8
    const topLanguages = Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.innerHTML = '<canvas id="languagesChart"></canvas>';
    card.appendChild(chartContainer);

    container.appendChild(card);

    // Render chart after element is in DOM
    setTimeout(() => {
        renderLanguagesChartCanvas(topLanguages);
    }, 0);
}

function renderLanguagesChartCanvas(topLanguages) {
    const ctx = document.getElementById('languagesChart');
    if (!ctx) return;

    const labels = topLanguages.map(([lang]) => lang);
    const data = topLanguages.map(([, bytes]) => bytes);

    // Destroy existing chart if any
    if (languageChart) {
        languageChart.destroy();
    }

    // Load Chart.js from CDN if not already loaded
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        script.onload = () => {
            createLanguageChart(ctx, labels, data);
        };
        document.head.appendChild(script);
    } else {
        createLanguageChart(ctx, labels, data);
    }
}

function createLanguageChart(ctx, labels, data) {
    const colors = [
        '#58a6ff',
        '#79c0ff',
        '#3fb950',
        '#a371f7',
        '#f0883e',
        '#ffa657',
        '#ff7b72',
        '#d1240b'
    ];

    languageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Bytes',
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: 'rgba(88, 166, 255, 0.2)',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(139, 148, 158, 0.1)'
                    },
                    ticks: {
                        color: '#8b949e'
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#8b949e'
                    }
                }
            }
        }
    });
}

// ===== TOP REPOS =====

function renderTopRepos(repos, container) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = '⭐ Top 5 Repositories';
    title.style.marginBottom = '20px';
    card.appendChild(title);

    const topRepos = repos
        .filter(r => !r.fork)
        .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        .slice(0, 5);

    if (topRepos.length === 0) {
        const noData = document.createElement('p');
        noData.className = 'no-data-message';
        noData.textContent = 'No repositories found.';
        card.appendChild(noData);
        container.appendChild(card);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'repos-grid';

    topRepos.forEach(repo => {
        const repoCard = createRepoCard(repo);
        grid.appendChild(repoCard);
    });

    card.appendChild(grid);
    container.appendChild(card);
}

function createRepoCard(repo) {
    const card = document.createElement('a');
    card.className = 'repo-card';
    card.href = repo.html_url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    const name = document.createElement('div');
    name.className = 'repo-name';
    name.textContent = repo.name;

    const desc = document.createElement('p');
    desc.className = 'repo-desc';
    desc.textContent = repo.description || '(No description)';

    const meta = document.createElement('div');
    meta.className = 'repo-meta';

    // Stars
    const stars = document.createElement('div');
    stars.className = 'repo-stat';
    stars.innerHTML = `⭐ ${formatNumber(repo.stargazers_count || 0)}`;
    meta.appendChild(stars);

    // Forks
    const forks = document.createElement('div');
    forks.className = 'repo-stat';
    forks.innerHTML = `🔀 ${formatNumber(repo.forks_count || 0)}`;
    meta.appendChild(forks);

    // Language
    if (repo.language) {
        const language = document.createElement('div');
        language.className = 'repo-stat language';
        const badge = document.createElement('span');
        badge.className = 'language-badge';
        badge.style.backgroundColor = getLanguageColor(repo.language);
        language.appendChild(badge);
        language.appendChild(document.createTextNode(repo.language));
        meta.appendChild(language);
    }

    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(meta);
    return card;
}

function getLanguageColor(language) {
    const colors = {
        'JavaScript': '#f1e05a',
        'TypeScript': '#3178c6',
        'Python': '#3572A5',
        'Java': '#b07219',
        'C++': '#f34b7d',
        'Go': '#00ADD8',
        'Rust': '#ce422b',
        'Ruby': '#cc342d',
        'PHP': '#777bb4',
        'C#': '#239120',
        'Kotlin': '#7f52ff',
        'Swift': '#fa7343',
        'HTML': '#e34c26'
    };
    return colors[language] || '#58a6ff';
}

// ===== STREAK STATS =====

function renderStreakStats(events, container) {
    if (!events || events.length === 0) {
        return;
    }

    const { currentStreak, longestStreak } = calculateStreaks(events);

    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = '🔥 Streak Stats';
    title.style.marginBottom = '20px';
    card.appendChild(title);

    const container_ = document.createElement('div');
    container_.className = 'streak-container';

    // Current streak
    const currentCard = document.createElement('div');
    currentCard.className = 'streak-card';
    currentCard.innerHTML = `
        <div class="streak-icon">🔥</div>
        <div class="streak-value">${currentStreak}</div>
        <div class="streak-label">Current Streak</div>
    `;
    container_.appendChild(currentCard);

    // Longest streak
    const longestCard = document.createElement('div');
    longestCard.className = 'streak-card';
    longestCard.innerHTML = `
        <div class="streak-icon">🏆</div>
        <div class="streak-value">${longestStreak}</div>
        <div class="streak-label">Longest Streak</div>
    `;
    container_.appendChild(longestCard);

    card.appendChild(container_);
    container.appendChild(card);
}

function calculateStreaks(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Extract dates with push events
    const dates = new Set();
    events.forEach(event => {
        if (event.type === 'PushEvent') {
            const date = new Date(event.created_at);
            date.setHours(0, 0, 0, 0);
            dates.add(date.getTime());
        }
    });

    if (dates.size === 0) {
        return { currentStreak: 0, longestStreak: 0 };
    }

    const sortedDates = Array.from(dates).sort((a, b) => a - b);

    // Calculate current streak (must include today or yesterday)
    let currentStreak = 0;
    let checkDate = new Date(today);
    for (let i = 0; i < 365; i++) {
        if (dates.has(checkDate.getTime())) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    // Calculate longest streak
    let longestStreak = 1;
    let currentCount = 1;

    for (let i = 1; i < sortedDates.length; i++) {
        const diff = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
            currentCount++;
            longestStreak = Math.max(longestStreak, currentCount);
        } else {
            currentCount = 1;
        }
    }

    return { currentStreak, longestStreak };
}

// ===== ERROR HANDLING =====

function renderError(message, container) {
    const card = document.createElement('div');
    card.className = 'error-card';

    const icon = document.createElement('div');
    icon.className = 'error-icon';
    icon.textContent = '⚠️';

    const title = document.createElement('div');
    title.className = 'error-title';
    title.textContent = 'Oops!';

    const errorMsg = document.createElement('p');
    errorMsg.className = 'error-message';

    if (message.includes('rate limit')) {
        errorMsg.textContent = 'GitHub API rate limit reached. Please try again in a few minutes.';
    } else if (message.includes('not found')) {
        errorMsg.textContent = `User not found. Please check the username and try again.`;
    } else {
        errorMsg.textContent = message;
    }

    const retryBtn = document.createElement('button');
    retryBtn.className = 'error-retry';
    retryBtn.textContent = '← Try Another Username';
    retryBtn.addEventListener('click', () => {
        document.getElementById('usernameInput').value = '';
        document.getElementById('usernameInput').focus();
        document.getElementById('mainContent').innerHTML = '';
    });

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(errorMsg);
    card.appendChild(retryBtn);

    container.appendChild(card);
}

function checkRateLimit(response) {
    const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '0');
    const limit = parseInt(response.headers.get('x-ratelimit-limit') || '60');

    console.log(`Rate limit: ${remaining}/${limit}`);

    if (remaining < RATE_LIMIT_BUFFER) {
        const resetTime = parseInt(response.headers.get('x-ratelimit-reset') || '0');
        const resetDate = new Date(resetTime * 1000);
        const minutesUntilReset = Math.ceil((resetDate - new Date()) / 60000);
        throw new Error(`rate limit reached. Reset in ${minutesUntilReset} minutes.`);
    }
}

// ===== LOADING SKELETON =====

function showLoadingSkeleton(container) {
    const template = document.getElementById('skeletonTemplate');
    for (let i = 0; i < 5; i++) {
        const clone = template.content.cloneNode(true);
        container.appendChild(clone);
    }
}

// ===== UTILITIES =====

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}
