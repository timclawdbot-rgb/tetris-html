# Tetris (HTML)

A dependency-free Tetris clone in plain HTML/CSS/JS.

## Play online

GitHub Pages: https://timclawdbot-rgb.github.io/tetris-html/

## Run locally

Just open `index.html` in a browser.

Or use a tiny local server (recommended to avoid any browser file restrictions):

```bash
cd games/tetris
python3 -m http.server 8000
```

Then open: http://localhost:8000

## Controls

- Left/Right: move
- Down: soft drop
- Space: hard drop
- Z / X: rotate
- C: hold
- P: pause
- R: restart

## Publish to GitHub Pages

1. Create a repo
2. Push this folder
3. In GitHub → **Settings → Pages**
   - Build and deployment: **Deploy from a branch**
   - Branch: `main` / folder: `/ (root)`

