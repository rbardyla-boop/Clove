# Singularity Inc. Web Beta

This folder contains a minimal Three.js HTML beta for the Singularity Inc. simulation.

## Files

- `index.html` - entry point for the browser
- `style.css` - UI styling and layout
- `main.js` - Three.js scene setup, region simulation, and UI synchronization

## Getting Started Locally

### Option 1: Python Static Server

From the `web` folder:

```bash
cd /home/thebackhand/Downloads/grok/sinularity/web
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

### Option 2: Live Server Extension

Use VS Code Live Server or any static file server to serve the `web/` folder.

## Deploying to Cloudflare Pages

1. Create a new Cloudflare Pages project.
2. Connect your GitHub repository or upload this repository.
3. Set the build output folder to `web`.
4. No build command is needed for this static site.
5. Deploy and visit the generated URL.

## Notes

- This beta uses the Three.js CDN for convenience.
- It is designed as a static HTML/JS prototype and requires no backend.
- Use Cloudflare Pages for easy hosting with automatic deployment.
