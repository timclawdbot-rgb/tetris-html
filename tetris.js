// Minimal, dependency-free Tetris (HTML Canvas)
// Controls: ← → move, ↑ rotate, ↓ soft drop, Space hard drop, P pause, R restart

(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;

  const boardCanvas = document.getElementById('board');
  const nextCanvas = document.getElementById('next');
  const holdCanvas = document.getElementById('hold');

  if (!boardCanvas || !nextCanvas || !holdCanvas) {
    throw new Error('Missing canvas elements');
  }

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
  };

  // 4x4 matrices for pieces
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

  function cloneMatrix(m) {
    return m.map(r => r.slice());
  }

  function rotateCW(m) {
    const N = m.length;
    const out = Array.from({ length: N }, () => Array(N).fill(0));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) out[x][N - 1 - y] = m[y][x];
    }
    return out;
  }

  function makeGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  const state = {
    grid: makeGrid(),
    running: false,
    paused: false,
    gameOver: false,

    score: 0,
    lines: 0,
    level: 1,

    bag: [],
    current: null,
    next: null,
    hold: null,
    canHold: true,

    dropMs: 800,
    acc: 0,
    lastTs: 0,
  };

  function refillBag() {
    const keys = Object.keys(SHAPES);
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    state.bag.push(...keys);
  }

  function takePieceKey() {
    if (state.bag.length === 0) refillBag();
    return state.bag.shift();
  }

  function newPiece(kind) {
    return {
      kind,
      m: cloneMatrix(SHAPES[kind]),
      x: 3,
      y: 0,
    };
  }

  function collides(piece, dx, dy, mat = piece.m) {
    const px = piece.x + dx;
    const py = piece.y + dy;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (!mat[y][x]) continue;
        const gx = px + x;
        const gy = py + y;
        if (gx < 0 || gx >= COLS) return true;
        if (gy >= ROWS) return true;
        if (gy >= 0 && state.grid[gy][gx]) return true;
      }
    }
    return false;
  }

  function spawn() {
    if (!state.next) state.next = newPiece(takePieceKey());
    state.current = state.next;
    state.current.x = 3;
    state.current.y = 0;
    state.next = newPiece(takePieceKey());
    state.canHold = true;

    if (collides(state.current, 0, 0)) {
      state.gameOver = true;
      state.running = false;
    }
  }

  function lock() {
    const p = state.current;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (!p.m[y][x]) continue;
        const gx = p.x + x;
        const gy = p.y + y;
        if (gy >= 0 && gy < ROWS) state.grid[gy][gx] = p.kind;
      }
    }
    clearLines();
    spawn();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (state.grid[y].every(Boolean)) {
        state.grid.splice(y, 1);
        state.grid.unshift(Array(COLS).fill(null));
        cleared++;
        y++; // recheck same index
      }
    }

    if (cleared) {
      state.lines += cleared;
      const scores = [0, 100, 300, 500, 800];
      state.score += (scores[cleared] || 0) * state.level;

      const newLevel = 1 + Math.floor(state.lines / 10);
      if (newLevel !== state.level) {
        state.level = newLevel;
        state.dropMs = Math.max(80, 800 - (state.level - 1) * 60);
      }
      syncHud();
    }
  }

  function syncHud() {
    if (scoreEl) scoreEl.textContent = String(state.score);
    if (linesEl) linesEl.textContent = String(state.lines);
    if (levelEl) levelEl.textContent = String(state.level);
  }

  function move(dx) {
    if (!state.current) return;
    if (!collides(state.current, dx, 0)) state.current.x += dx;
  }

  function rotate() {
    if (!state.current) return;
    const p = state.current;
    const r = rotateCW(p.m);

    // small kick tests (simple & reliable)
    const kicks = [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1]];
    for (const [kx, ky] of kicks) {
      if (!collides(p, kx, ky, r)) {
        p.m = r;
        p.x += kx;
        p.y += ky;
        return;
      }
    }
  }

  function softDrop() {
    if (!state.current) return;
    if (!collides(state.current, 0, 1)) {
      state.current.y += 1;
      state.score += 1;
      syncHud();
    } else {
      lock();
    }
  }

  function hardDrop() {
    if (!state.current) return;
    let d = 0;
    while (!collides(state.current, 0, 1)) {
      state.current.y += 1;
      d++;
    }
    state.score += d * 2;
    syncHud();
    lock();
  }

  function hold() {
    if (!state.current || !state.canHold) return;
    const cur = state.current.kind;
    if (!state.hold) {
      state.hold = cur;
      spawn();
    } else {
      const swap = state.hold;
      state.hold = cur;
      state.current = newPiece(swap);
      state.current.x = 3;
      state.current.y = 0;
      if (collides(state.current, 0, 0)) {
        state.gameOver = true;
        state.running = false;
      }
    }
    state.canHold = false;
  }

  function drawCell(c, x, y, color, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.strokeRect(x * BLOCK + 0.5, y * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
    c.restore();
  }

  function overlay(text) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.fillStyle = '#e7eefc';
    ctx.font = 'bold 22px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, boardCanvas.width / 2, boardCanvas.height / 2);
    ctx.restore();
  }

  function drawMini(c, kind) {
    c.clearRect(0, 0, 120, 120);
    if (!kind) return;
    const mat = SHAPES[kind];
    const mini = 24;
    const ox = 12;
    const oy = 12;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (!mat[y][x]) continue;
        c.fillStyle = COLORS[kind];
        c.fillRect(ox + x * mini, oy + y * mini, mini, mini);
        c.strokeStyle = 'rgba(255,255,255,0.08)';
        c.strokeRect(ox + x * mini + 0.5, oy + y * mini + 0.5, mini - 1, mini - 1);
      }
    }
  }

  function draw() {
    // background
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

    // grid lines
    ctx.save();
    ctx.strokeStyle = 'rgba(30,42,64,0.9)';
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK + 0.5, 0);
      ctx.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK + 0.5);
      ctx.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    // locked
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = state.grid[y][x];
        if (v) drawCell(ctx, x, y, COLORS[v]);
      }
    }

    // current
    if (state.current) {
      const p = state.current;
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          if (!p.m[y][x]) continue;
          const gx = p.x + x;
          const gy = p.y + y;
          if (gy >= 0) drawCell(ctx, gx, gy, COLORS[p.kind]);
        }
      }
    }

    drawMini(nextCtx, state.next?.kind);
    drawMini(holdCtx, state.hold);

    if (!state.running && !state.gameOver) overlay('Press Start');
    if (state.paused) overlay('Paused');
    if (state.gameOver) overlay('Game Over (R to restart)');
  }

  function step(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = ts - state.lastTs;
    state.lastTs = ts;

    if (state.running && !state.paused && !state.gameOver) {
      state.acc += dt;
      if (state.acc >= state.dropMs) {
        state.acc = 0;
        if (!collides(state.current, 0, 1)) state.current.y += 1;
        else lock();
      }
    }

    draw();
    requestAnimationFrame(step);
  }

  function start() {
    if (state.gameOver) return;
    if (!state.current) spawn();
    state.running = true;
    state.paused = false;
    state.acc = 0;
  }

  function togglePause() {
    if (!state.running || state.gameOver) return;
    state.paused = !state.paused;
  }

  function reset() {
    state.grid = makeGrid();
    state.running = false;
    state.paused = false;
    state.gameOver = false;

    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.dropMs = 800;

    state.bag = [];
    state.current = null;
    state.next = null;
    state.hold = null;
    state.canHold = true;

    state.acc = 0;
    state.lastTs = 0;

    syncHud();
    draw();
  }

  // Wire UI
  btnStart?.addEventListener('click', start);
  btnPause?.addEventListener('click', togglePause);
  btnRestart?.addEventListener('click', reset);

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    const lower = k.toLowerCase();

    if (lower === 'p') { togglePause(); return; }
    if (lower === 'r') { reset(); return; }

    if (!state.running || state.paused || state.gameOver) {
      if (k === ' ' || k === 'Enter') start();
      return;
    }

    if (k === 'ArrowLeft') { e.preventDefault(); move(-1); }
    else if (k === 'ArrowRight') { e.preventDefault(); move(1); }
    else if (k === 'ArrowDown') { e.preventDefault(); softDrop(); }
    else if (k === 'ArrowUp') { e.preventDefault(); rotate(); }
    else if (k === ' ') { e.preventDefault(); hardDrop(); }
    else if (lower === 'c') { hold(); }
  });

  // Boot
  reset();
  requestAnimationFrame(step);
})();
