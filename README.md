# DevPulse - GitHub Activity Dashboard

A beautiful, production-ready static web app that visualizes GitHub profile activity. Zero backend, zero build step — just open `index.html` in your browser.

## Features

- **Profile Header** — Avatar, name, bio, followers, following, and public repos count
- **12-Month Contribution Heatmap** — Calendar-style activity grid based on recent events
- **Top Languages Chart** — Bar chart of your most-used programming languages
- **Top 5 Repositories** — Your most-starred repositories with stats
- **Streak Statistics** — Current and longest commit streaks calculated from push events
- **Shareable URLs** — Link format: `?user=ziyaad-mallick` auto-loads the user
- **Responsive Design** — Works perfectly on desktop, tablet, and mobile
- **Dark Theme** — Elegant, minimal design with electric blue accents

## How to Use

1. **Open the App**
   ```
   Open index.html in any modern web browser
   ```

2. **Search for a User**
   - Enter a GitHub username in the search box
   - Hit Enter or click Search
   - The dashboard loads automatically

3. **Share a Profile**
   - Copy the URL after searching: `devpulse/index.html?user=ziyaad-mallick`
   - Share it with anyone — it will auto-load

## Design Highlights

- **Dark Theme** — Deep background (#0d1117) with white/gray text
- **Minimal, Clean** — Subtle card borders, soft shadows, rounded corners
- **Electric Blue Accents** — Single accent color (#58a6ff) used sparingly
- **Smooth Animations** — Fade-in and slide-up effects on load
- **Mobile Responsive** — Optimized for all screen sizes

## Tech Stack

- Pure **Vanilla JavaScript** (no frameworks)
- **Chart.js** (loaded from CDN for language stats)
- **CSS3** (custom properties, Grid, Flexbox, animations)
- **GitHub API v3** (public endpoints, no authentication required)

## API Endpoints Used

- `GET /users/{username}` — Profile data
- `GET /users/{username}/repos` — Repository list
- `GET /users/{username}/events` — Recent events for heatmap and streak calculation

## Key Features Explained

### Contribution Heatmap
- Built from the last 100 public events (up to 90 days)
- Shows PushEvents only, grouped by day
- Color intensity indicates commit count (0–4+ levels)
- Greyed out days indicate no events

### Language Chart
- Aggregates all public repos
- Groups by language, sorted by total bytes
- Top 8 languages displayed in a horizontal bar chart
- Color-coded by language

### Streak Calculation
- **Current Streak** — Consecutive days ending today with at least one push
- **Longest Streak** — Longest consecutive-day run in the available event window
- Calculated from PushEvent timestamps

### Rate Limiting
- GitHub's public API allows 60 requests/hour per IP
- The app reserves a 5-request buffer for safety
- If rate limit is hit, a friendly error message is shown

## File Structure

```
devpulse/
├── index.html          (Main HTML, single entry point)
├── style.css           (All styling and animations)
├── app.js              (Core app logic and API integration)
└── README.md           (This file)
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile, etc.)

## Hosting on GitHub Pages

1. Push the `devpulse` folder to your GitHub repo
2. Enable GitHub Pages in repo settings → main branch → /root
3. Access at `https://yourusername.github.io/devpulse/`

Or simply open `index.html` locally — no server needed.

## Error Handling

- **Invalid Username** — Shows a friendly error with retry option
- **Rate Limit Hit** — Displays message with estimated reset time
- **No Events** — Gracefully handles users with no recent activity
- **Loading States** — Skeleton shimmer while fetching data

## Notes

- No authentication required — uses GitHub's public API
- All data is fetched client-side, in the browser
- No cookies, no tracking, no analytics
- Zero latency on subsequent searches (client-side caching not implemented, but data loads fast)

## Privacy

- No data is stored or sent anywhere except GitHub's API
- The app reads only public profile and repository data
- Shareable URLs contain only the username in the query string

---

Built with ❤️ for developers who want to showcase their GitHub activity beautifully.
