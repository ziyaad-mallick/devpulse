# DevPulse Deployment Guide

DevPulse is a static web app with zero backend and zero build dependencies. Deploy it anywhere.

## Option 1: Local File (Fastest)

1. **Navigate to the project folder:**
   ```
   C:\Users\testi\Desktop\Parhai\Projects\devpulse\
   ```

2. **Double-click `index.html`**
   - Opens in your default browser
   - Works immediately — no setup required
   - Use for testing, demos, or personal use

---

## Option 2: GitHub Pages (Free, Production)

### Prerequisites
- A GitHub account
- Git installed locally

### Steps

1. **Create a GitHub repository** (or use an existing one)
   ```bash
   git clone https://github.com/yourusername/your-repo.git
   cd your-repo
   ```

2. **Copy DevPulse files**
   - Copy `index.html`, `style.css`, `app.js` into the repo root (or a `devpulse` subfolder)

3. **Optional: Add examples page**
   - Copy `examples.html` to show featured developers

4. **Commit and push**
   ```bash
   git add .
   git commit -m "Add DevPulse GitHub activity dashboard"
   git push origin main
   ```

5. **Enable GitHub Pages**
   - Go to repo → Settings → Pages
   - Select "Deploy from a branch"
   - Choose `main` branch, `/root` folder
   - Click Save

6. **Access your app**
   ```
   https://yourusername.github.io/your-repo/
   ```

### Optional: Custom Domain

1. In Settings → Pages, add your custom domain
2. Update your domain's DNS settings (follow GitHub's instructions)
3. Access via your custom domain

---

## Option 3: Netlify (Recommended for Production)

### Prerequisites
- GitHub account (to connect repo)

### Steps

1. **Push to GitHub** (see Option 2, steps 1-4)

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Authorize GitHub
   - Select your repo

3. **Configure**
   - Build command: (leave blank)
   - Publish directory: `.` (or your subfolder)
   - Click "Deploy site"

4. **Access your app**
   ```
   https://your-site-name.netlify.app/
   ```

**Advantages:**
- Faster CDN globally
- Custom domain support
- HTTPS by default
- Environmental variables (if needed)

---

## Option 4: Vercel (Alternative)

### Steps

1. **Push to GitHub** (see Option 2)

2. **Import on Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Paste your GitHub repo URL
   - Click "Import"

3. **Configure**
   - Root directory: `.` (or your folder)
   - Framework: "Other"
   - Build command: (leave blank)
   - Click "Deploy"

4. **Access**
   ```
   https://your-project.vercel.app/
   ```

---

## Option 5: Static Hosting Services

DevPulse works with any static hosting:

- **AWS S3 + CloudFront** — Scalable, CDN included
- **Google Cloud Storage** — Simple and reliable
- **Azure Static Web Apps** — Microsoft's offering
- **Bunny CDN** — Affordable, fast worldwide
- **Firebase Hosting** — Google's free tier
- **DigitalOcean Spaces** — Affordable S3-compatible

For all: Just upload the three files (`index.html`, `style.css`, `app.js`) and set `index.html` as the default document.

---

## Configuration for Different Hosting

### If deployed to a subdirectory

Example: `https://example.com/devpulse/`

No changes needed! The app uses relative paths:
- `style.css` → works
- `app.js` → works
- All data fetches work (GitHub API is CORS-enabled)

### If deployed to root

Example: `https://example.com/`

Everything works as-is.

---

## Pre-Deployment Checklist

Before going live, verify:

- [ ] `index.html` opens without errors
- [ ] Searching for a user works (try: `torvalds`)
- [ ] Profile loads with data
- [ ] Heatmap displays
- [ ] Languages chart renders
- [ ] Top repos show
- [ ] Streak stats appear
- [ ] Shareable URL works: `?user=ziyaad-mallick`
- [ ] Mobile responsive (test on phone/tablet)
- [ ] No console errors (F12 → Console tab)

---

## Performance & Optimization

DevPulse is already highly optimized:

### Size
- **index.html** — 1.6 KB (HTML structure)
- **style.css** — 11.6 KB (All styling)
- **app.js** — 19.6 KB (All logic)
- **Total** — ~33 KB (without docs)

### Speed
- Loads all content in <1 second (on fast internet)
- Chart.js loaded from CDN (cached by browsers)
- No database queries
- Direct GitHub API calls

### Caching
Browsers automatically cache:
- Static assets (CSS, JS)
- Chart.js library
- User data (until refresh)

### Bandwidth
- Each profile load: ~50-100 KB total
- No re-uploads on subsequent visits
- GitHub API calls are very fast

---

## Monitoring & Analytics (Optional)

Add basic analytics without changing the app:

### Option 1: Google Analytics
Add before closing `</head>` in index.html:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

### Option 2: Plausible Analytics
Add to `<head>`:
```html
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

### Option 3: Simple Page Counter
Netlify, Vercel, and GitHub all provide built-in traffic stats.

---

## Security

DevPulse is secure by design:

- ✓ **No backend** — No server to attack
- ✓ **Public data only** — Uses GitHub's public API
- ✓ **HTTPS** — All hosting options support TLS
- ✓ **No credentials** — No authentication stored
- ✓ **CORS safe** — GitHub API supports CORS
- ✓ **No cookies** — No tracking or state
- ✓ **No user input stored** — Only fetched from GitHub

### Content Security Policy (Optional)

For maximum security, add to `<head>`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self';">
```

---

## Troubleshooting Deployment

### "Files not found" error
- Check that `index.html`, `style.css`, `app.js` are in the right directory
- For subdirectories, ensure paths are relative

### "Styles not loading"
- Verify `style.css` is in the same directory as `index.html`
- Check browser console (F12) for file not found errors
- Clear browser cache (Ctrl+Shift+Delete)

### "API calls failing"
- GitHub API requires CORS headers — all hosting options support this
- Check internet connection
- Verify GitHub API is not down (status.github.com)

### "Chart not rendering"
- Chart.js is loaded from CDN (requires internet)
- Check browser console for load errors
- Verify Content Security Policy (if added) allows CDN

---

## Keeping Up to Date

DevPulse has no dependencies, so updates are simple:

1. **Pull latest changes** (if on GitHub)
   ```bash
   git pull origin main
   ```

2. **Redeploy** (Netlify/Vercel auto-deploy on push)
   - Netlify: Auto-deploys on push
   - Vercel: Auto-deploys on push
   - GitHub Pages: Auto-deploys on push
   - Manual hosting: Re-upload files

---

## Success! 🎉

Your DevPulse instance is now live!

### Next Steps
1. **Share the URL** with friends and colleagues
2. **Try pre-filled links**: `?user=torvalds`, `?user=gvanrossum`
3. **Add to portfolio** — Show off your GitHub stats
4. **Customize** — Fork the repo and modify colors/fonts

---

## Support

- Check `README.md` for features and usage
- Check `QUICKSTART.md` for quick reference
- Check `examples.html` for demo profiles
- View `app.js` source code — it's well-commented

Happy deploying! 🚀
