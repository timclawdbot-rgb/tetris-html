// Tetris in plain JS (no deps)
// Board: 10x20 with hidden spawn rows.

(() => {
  const COLS = 10;
  const ROWS = 20;
  const HIDDEN = 2; // hidden spawn rows above visible
  const CELL = 30;

  const boardCanvas = document.getElementById('board');
  const nextCanvas = document.getElementById('next');
  const holdCanvas = document.getElementById('hold');
  const ctx = boardCanvas.getContext('2d');
  const nextCtx = nextCanvas.getContext('2d');
  const holdCtx = holdCanvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');

  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnRestart = document.getElementById('btnRestart');

  const COLORS = {
    I: '#56d5ff',
    O: '#ffd74a',
    T: '#c77dff',
    S: '#4bf08b',
    Z: '#ff5f5f',
    J: '#5f8bff',
    L: '#ff9d4a',
    G: '#0b0f17' // ghost
  };

  // 4x4 matrices
  const SHAPES = {
    I: [
      [0,0,0,0],
      [1,1,1,1],
      [0,0,0,0],
      [0,0,0,0],
    ],
    O: [
      [0,1,1,0],
      [0,1,1,0],
      [0,0,0,0],
      [0,0,0,0],
    ],
    T: [
      [0,1,0,0],
      [1,1,1,0],
      [0,0,0,0],
      [0,0,0,0],
    ],
    S: [
      [0,1,1,0],
      [1,1,0,0],
      [0,0,0,0],
      [0,0,0,0],
    ],
    Z: [
      [1,1,0,0],
      [0,1,1,0],
      [0,0,0,0],
      [0,0,0,0],
    ],
    J: [
      [1,0,0,0],
      [1,1,1,0],
      [0,0,0,0],
      [0,0,0,0],
    ],
    L: [
      [0,0,1,0],
      [1,1,1,0],
      [0,0,0,0],
      [0,0,0,0],
    ],
  };

  const KICKS = {
    // SRS-ish kicks for non-I pieces
    normal: [
      [0,0], [-1,0], [1,0], [0,-1], [-1,-1], [1,-1], [0,1]
    ],
    // limited I kicks (good-enough)
    I: [
      [0,0], [-2,0], [2,0], [-1,0], [1,0], [0,-1], [0,1]
    ]
  };

  const state = {
    running: false,
    paused: false,
    gameOver: false,

    grid: makeGrid(),

    bag: [],
    next: null,
    current: null,

    hold: null,
    canHold: true,

    score: 0,
    lines: 0,
    level: 1,

    dropMs: 800,
    lastTs: 0,
    acc: 0,
  };

  function makeGrid() {
    // includes hidden rows
    const total = ROWS + HIDDEN;
    return Array.from({ length: total }, () => Array(COLS).fill(null));
  }

  function cloneMat(m) {
    return m.map(r => r.slice());
  }

  function rotateCW(mat) {
    const N = mat.length;
    const out = Array.from({ length: N }, () => Array(N).fill(0));
    for (let y=0; y<N; y++) {
      for (let x=0; x<N; x++) {
        out[x][N-1-y] = mat[y][x];
      }
    }
    return out;
  }

  function rotateCCW(mat) {
    const N = mat.length;
    const out = Array.from({ length: N }, () => Array(N).fill(0));
    for (let y=0; y<N; y++) {
      for (let x=0; x<N; x++) {
        out[N-1-x][y] = mat[y][x];
      }
    }
    return out;
  }

  function refillBag() {
    const pieces = Object.keys(SHAPES);
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    state.bag.push(...pieces);
  }

  function takeFromBag() {
    if (state.bag.length === 0) refillBag();
    return state.bag.shift();
  }

  function newPiece(kind) {
    const mat = cloneMat(SHAPES[kind]);
    // spawn near top center
    return { kind, mat, x: 3, y: 0 };
  }

  function spawn() {
    if (!state.next) state.next = newPiece(takeFromBag());
    state.current = state.next;
    state.current.x = 3;
    state.current.y = 0;
    state.next = newPiece(takeFromBag());
    state.canHold = true;

    if (collides(state.current, 0, 0, state.current.mat)) {
      state.gameOver = true;
      state.running = false;
    }
  }

  function collides(piece, dx, dy, mat) {
    const px = piece.x + dx;
    const py = piece.y + dy;
    for (let y=0; y<4; y++) {
      for (let x=0; x<4; x++) {
        if (!mat[y][x]) continue;
        const gx = px + x;
        const gy = py + y;
        if (gx < 0 || gx >= COLS) return true;
        if (gy >= ROWS + HIDDEN) return true;
        if (gy >= 0 && state.grid[gy][gx]) return true;
      }
    }
    return false;
  }

  function lockPiece() {
    const p = state.current;
    for (let y=0; y<4; y++) {
      for (let x=0; x<4; x++) {
        if (!p.mat[y][x]) continue;
        const gx = p.x + x;
        const gy = p.y + y;
        if (gy >= 0 && gy < ROWS + HIDDEN) {
          state.grid[gy][gx] = p.kind;
        }
      }
    }
    clearLines();
    spawn();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = 0; y < ROWS + HIDDEN; y++) {
      if (y < HIDDEN) continue; // don't clear hidden rows
      if (state.grid[y].every(v => v)) {
        state.grid.splice(y, 1);
        state.grid.unshift(Array(COLS).fill(null));
        cleared++;
      }
    }

    if (cleared > 0) {
      state.lines += cleared;

      // classic-ish scoring
      const lineScores = [0, 100, 300, 500, 800];
      state.score += (lineScores[cleared] || 0) * state.level;

      const newLevel = 1 + Math.floor(state.lines / 10);
      if (newLevel !== state.level) {
        state.level = newLevel;
        state.dropMs = Math.max(80, 800 - (state.level - 1) * 60);
      }

      syncHud();
    }
  }

  function syncHud() {
    scoreEl.textContent = String(state.score);
    linesEl.textContent = String(state.lines);
    levelEl.textContent = String(state.level);
  }

  function softDrop() {
    if (!state.current) return;
    if (!collides(state.current, 0, 1, state.current.mat)) {
      state.current.y += 1;
      state.score += 1;
      syncHud();
    } else {
      lockPiece();
    }
  }

  function hardDrop() {
    if (!state.current) return;
    let dropped = 0;
    while (!collides(state.current, 0, 1, state.current.mat)) {
      state.current.y += 1;
      dropped++;
    }
    state.score += dropped * 2;
    syncHud();
    lockPiece();
  }

  function move(dx) {
    if (!state.current) return;
    if (!collides(state.current, dx, 0, state.current.mat)) {
      state.current.x += dx;
    }
  }

  function rotate(dir) {
    if (!state.current) return;
    const p = state.current;
    const rotated = dir === 'CW' ? rotateCW(p.mat) : rotateCCW(p.mat);

    const kickList = (p.kind === 'I') ? KICKS.I : KICKS.normal;
    for (const [kx, ky] of kickList) {
      if (!collides(p, kx, ky, rotated)) {
        p.mat = rotated;
        p.x += kx;
        p.y += ky;
        return;
      }
    }
  }

  function getGhostY() {
    const p = state.current;
    if (!p) return 0;
    let y = p.y;
    while (!collides(p, 0, 1, p.mat)) y++;
    return y;
  }

  function hold() {
    if (!state.current || !state.canHold) return;
    const curKind = state.current.kind;

    if (!state.hold) {
      state.hold = curKind;
      spawn();
    } else {
      const swap = state.hold;
      state.hold = curKind;
      state.current = newPiece(swap);
      state.current.x = 3;
      state.current.y = 0;
      if (collides(state.current, 0, 0, state.current.mat)) {
        state.gameOver = true;
        state.running = false;
      }
    }

    state.canHold = false;
  }

  function drawCell(c, x, y, color, alpha=1) {
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x*CELL, y*CELL, CELL, CELL);
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    c.strokeRect(x*CELL + 0.5, y*CELL + 0.5, CELL-1, CELL-1);
    c.restore();
  }

  function drawGrid() {
    ctx.clearRect(0,0,boardCanvas.width,boardCanvas.height);

    // background grid lines
    ctx.save();
    ctx.strokeStyle = 'rgba(30,42,64,0.9)';
    for (let x=0; x<=COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x*CELL + 0.5, 0);
      ctx.lineTo(x*CELL + 0.5, ROWS*CELL);
      ctx.stroke();
    }
    for (let y=0; y<=ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y*CELL + 0.5);
      ctx.lineTo(COLS*CELL, y*CELL + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    // locked blocks (skip hidden rows)
    for (let gy=HIDDEN; gy<ROWS+HIDDEN; gy++) {
      for (let gx=0; gx<COLS; gx++) {
        const v = state.grid[gy][gx];
        if (!v) continue;
        drawCell(ctx, gx, gy-HIDDEN, COLORS[v]);
      }
    }

    // ghost + current
    if (state.current) {
      const p = state.current;
      const ghostY = getGhostY();

      // ghost
      for (let y=0; y<4; y++) {
        for (let x=0; x<4; x++) {
          if (!p.mat[y][x]) continue;
          const gx = p.x + x;
          const gy = ghostY + y;
          if (gy >= HIDDEN) drawCell(ctx, gx, gy-HIDDEN, '#ffffff', 0.12);
        }
      }

      // current
      for (let y=0; y<4; y++) {
        for (let x=0; x<4; x++) {
          if (!p.mat[y][x]) continue;
          const gx = p.x + x;
          const gy = p.y + y;
          if (gy >= HIDDEN) drawCell(ctx, gx, gy-HIDDEN, COLORS[p.kind]);
        }
      }
    }

    // overlays
    if (!state.running && !state.gameOver) {
      overlay('Press Start');
    }
    if (state.paused) {
      overlay('Paused');
    }
    if (state.gameOver) {
      overlay('Game Over (R to restart)');
    }
  }

  function overlay(text) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0,0,boardCanvas.width,boardCanvas.height);
    ctx.fillStyle = '#e7eefc';
    ctx.font = 'bold 22px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, boardCanvas.width/2, boardCanvas.height/2);
    ctx.restore();
  }

  function drawMini(canvasCtx, kind) {
    canvasCtx.clearRect(0,0,120,120);
    if (!kind) return;
    const mat = SHAPES[kind];

    const miniCell = 24;
    const offsetX = 12;
    const offsetY = 12;

    for (let y=0; y<4; y++) {
      for (let x=0; x<4; x++) {
        if (!mat[y][x]) continue;
        canvasCtx.fillStyle = COLORS[kind];
        canvasCtx.fillRect(offsetX + x*miniCell, offsetY + y*miniCell, miniCell, miniCell);
        canvasCtx.strokeStyle = 'rgba(255,255,255,0.08)';
        canvasCtx.strokeRect(offsetX + x*miniCell + 0.5, offsetY + y*miniCell + 0.5, miniCell-1, miniCell-1);
      }
    }
  }

  function tick(ts) {
    if (!state.running) {
      drawGrid();
      requestAnimationFrame(tick);
      return;
    }

    if (!state.lastTs) state.lastTs = ts;
    const dt = ts - state.lastTs;
    state.lastTs = ts;

    if (!state.paused && !state.gameOver) {
      state.acc += dt;
      while (state.acc >= state.dropMs) {
        state.acc -= state.dropMs;
        // gravity
        if (!collides(state.current, 0, 1, state.current.mat)) {
          state.current.y += 1;
        } else {
          lockPiece();
          if (state.gameOver) break;
        }
      }
    }

    drawMini(nextCtx, state.next?.kind);
    drawMini(holdCtx, state.hold);
    drawGrid();
    requestAnimationFrame(tick);
  }

  function startGame() {
    if (state.running) return;
    state.running = true;
    state.paused = false;
    state.gameOver = false;
    state.lastTs = 0;
    state.acc = 0;

    if (!state.current) {
      spawn();
    }
  }

  function pauseToggle() {
    if (!state.running) return;
    if (state.gameOver) return;
    state.paused = !state.paused;
  }

  function resetGame() {
    state.grid = makeGrid();
    state.bag = [];
    state.next = null;
    state.current = null;
    state.hold = null;
    state.canHold = true;

    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.dropMs = 800;
    state.lastTs = 0;
    state.acc = 0;

    state.gameOver = false;
    state.paused = false;
    state.running = false;
    syncHud();
  }

  // Inputs
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'p') { pauseToggle(); return; }
    if (k === 'r') { resetGame(); return; }

    if (!state.running || state.paused || state.gameOver) {
      // allow start with space/enter
      if (e.key === ' ' || e.key === 'Enter') startGame();
      return;
    }

    if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); softDrop(); }
    else if (e.key === ' ') { e.preventDefault(); hardDrop(); }
    else if (k === 'z') { rotate('CCW'); }
    else if (k === 'x') { rotate('CW'); }
    else if (k === 'c') { hold(); }
  });

  btnStart.addEventListener('click', () => startGame());
  btnPause.addEventListener('click', () => pauseToggle());
  btnRestart.addEventListener('click', () => resetGame());

  // Init
  syncHud();
  resetGame();
  requestAnimationFrame(tick);
})();
