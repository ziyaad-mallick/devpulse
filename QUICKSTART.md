# DevPulse Quick Start Guide

## Open the App

1. **Navigate to the project folder:**
   ```
   C:\Users\testi\Desktop\Parhai\Projects\devpulse\
   ```

2. **Double-click `index.html`** or right-click → "Open with" → your favorite browser

3. **You should see:**
   - A beautiful header with "DevPulse" title
   - A search box asking for a GitHub username
   - An example link: "Try: torvalds"

## Try It Out

### Example 1: Linux Creator
- Type `torvalds` in the search box
- Press Enter or click Search
- You'll see Linus Torvalds' GitHub profile with his contributions, languages, and top repos

### Example 2: Python Creator
- Search for `gvanrossum`
- See Guido van Rossum's activity

### Example 3: You
- Search for your own GitHub username
- See your personal dashboard

## What You'll See

After searching, the dashboard displays:

1. **Profile Card** — Your avatar, name, bio, followers, following, repos
2. **Contribution Heatmap** — Calendar view of recent activity (last 90 days)
3. **Languages Chart** — Bar chart of your top programming languages
4. **Top Repositories** — Your 5 most-starred repos with stats
5. **Streak Statistics** — Your current and longest commit streaks

## Share Your Dashboard

After searching for a user, the URL changes to:
```
devpulse/index.html?user=ziyaad-mallick
```

**Copy this URL and share it!** Anyone who opens it will immediately see that user's dashboard.

## Key Features

- ✓ No login required (uses public GitHub API)
- ✓ Works offline once loaded (data is fetched, not streamed)
- ✓ Mobile responsive (works on phones and tablets)
- ✓ No backend, no build step, no npm install
- ✓ Beautiful dark theme with electric blue accents
- ✓ Smooth animations and transitions

## Troubleshooting

### "User not found"
- Check the spelling of the GitHub username
- The username is case-sensitive on some systems
- Try the example: `torvalds`

### Rate limit message
- GitHub allows 60 API requests per hour per IP address
- Wait a few minutes and try again
- The limit resets automatically

### No contribution data
- The heatmap shows only recent public events (last 90 days)
- If the user has no recent public activity, it will be empty
- The streak stats require push events

### Charts not loading
- Chart.js is loaded from CDN (requires internet)
- Check your internet connection
- Try refreshing the page

## Browser Requirements

- Any modern browser (Chrome, Firefox, Safari, Edge)
- JavaScript must be enabled
- Internet connection (to fetch from GitHub API)

## File Overview

| File | Purpose |
|------|---------|
| `index.html` | Main page structure and layout |
| `style.css` | All styling, colors, responsive design, animations |
| `app.js` | Core logic, API calls, data processing, rendering |
| `README.md` | Full documentation |
| `QUICKSTART.md` | This quick reference guide |

## Tips & Tricks

1. **Pre-fill any username:**
   - Share: `devpulse/index.html?user=torvalds`
   - It auto-loads without requiring a click

2. **Try famous developers:**
   - `torvalds` (Linux)
   - `gvanrossum` (Python)
   - `jashkenas` (CoffeeScript)
   - `octocat` (GitHub's mascot)

3. **Mobile responsive:**
   - Open on your phone
   - Everything adapts automatically
   - Touch-friendly interface

4. **Fastest search:**
   - Press Enter in the input field
   - No need to click the button

## What Data Is Used?

The app fetches (publicly available data only):
- User profile (name, avatar, bio, followers, repos)
- Repository list (names, descriptions, stars, languages)
- Recent events (for heatmap and streak calculation)

**Privacy:** No data is stored locally or sent anywhere except GitHub's API.

## Next Steps

1. Try searching for yourself
2. Share your dashboard URL with friends
3. Check out the GitHub profile linked from each repo
4. Explore the code (all in 3 files, no dependencies!)

Enjoy! 🚀
