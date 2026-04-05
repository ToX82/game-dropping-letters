// ─── Costanti ──────────────────────────────────────────────
const COLS = 7;
const ROWS = 10;
const GAP = 4;
const POOL = 'AAABBBCCCDDDDEEEEEEEEFFGGHIIIILLLLMMMNNNNOOOOOOOPPQRRRRSSSSTTTTTUUUVVZ';
const DICT_URL = 'ita.txt';
let DICT = new Set();

// ─── Dizionario ───────────────────────────────────────────
async function loadDict() {
  console.log('[loadDict] Inizio caricamento dizionario da:', DICT_URL);
  const r = await fetch(DICT_URL);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = await r.text();
  t.split(/[\r\n]+/).forEach(w => {
    w = w.trim().toUpperCase();
    if (w.length >= 2) DICT.add(w);
  });
  console.log('[loadDict] Caricate', DICT.size, 'parole');
}

// ─── Audio (Web Audio API) ────────────────────────────────
const SFX = {
  ctx: null,
  on: true,

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.on = false;
      }
    }
  },

  play(t) {
    if (!this.on || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const c = this.ctx;
    const n = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);

    if (t === 'click') {
      o.type = 'sine';
      o.frequency.setValueAtTime(800, n);
      g.gain.setValueAtTime(.08, n);
      g.gain.exponentialRampToValueAtTime(.001, n + .1);
      o.start(n);
      o.stop(n + .1);
    }
    else if (t === 'valid') {
      o.type = 'sine';
      o.frequency.setValueAtTime(523, n);
      o.frequency.setValueAtTime(659, n + .1);
      o.frequency.setValueAtTime(784, n + .2);
      g.gain.setValueAtTime(.12, n);
      g.gain.exponentialRampToValueAtTime(.001, n + .4);
      o.start(n);
      o.stop(n + .4);
    }
    else if (t === 'err') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(200, n);
      o.frequency.setValueAtTime(150, n + .15);
      g.gain.setValueAtTime(.06, n);
      g.gain.exponentialRampToValueAtTime(.001, n + .2);
      o.start(n);
      o.stop(n + .2);
    }
    else if (t === 'combo') {
      o.type = 'triangle';
      o.frequency.setValueAtTime(900, n);
      o.frequency.setValueAtTime(1200, n + .15);
      g.gain.setValueAtTime(.1, n);
      g.gain.exponentialRampToValueAtTime(.001, n + .3);
      o.start(n);
      o.stop(n + .3);
    }
    else if (t === 'big') {
      o.type = 'sine';
      o.frequency.setValueAtTime(440, n);
      o.frequency.exponentialRampToValueAtTime(880, n + .2);
      o.frequency.exponentialRampToValueAtTime(1320, n + .4);
      g.gain.setValueAtTime(.15, n);
      g.gain.exponentialRampToValueAtTime(.001, n + .6);
      o.start(n);
      o.stop(n + .6);
    }
    else if (t === 'go') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(400, n);
      o.frequency.exponentialRampToValueAtTime(80, n + .8);
      g.gain.setValueAtTime(.1, n);
      g.gain.exponentialRampToValueAtTime(.001, n + .8);
      o.start(n);
      o.stop(n + .8);
    }
  }
};

// ─── Effetti visivi ───────────────────────────────────────
const FX = {

  // Popup "+N" punti
  pop(x, y, pts, col) {
    const e = document.createElement('div');
    e.className = 'pp';
    e.style.left = x + 'px';
    e.style.top = y + 'px';
    e.style.color = col || '#ffd740';
    e.style.fontSize = pts > 100 ? '24px' : '18px';
    e.textContent = '+' + pts;
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 900);
  },

  // Milestone a centro schermo
  milestone(t, c) {
    const u = Alpine.store('u');
    u.ms = t;
    u.mc = c || '#fff';
    setTimeout(() => { u.ms = null; u.mc = null }, 1700);
  },

  // Particelle esplosione
  particles(x, y, col, n) {
    n = n || 8;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'pc';
      const sz = 4 + Math.random() * 4;
      const angle = Math.PI * 2 / n * i;
      const dist = 20 + Math.random() * 30;
      p.style.cssText =
        'position:fixed;' +
        'width:' + sz + 'px;height:' + sz + 'px;' +
        'background:' + (col || '#00e676') + ';' +
        'left:' + x + 'px;top:' + y + 'px;' +
        'border-radius:50%;pointer-events:none;z-index:40;' +
        'animation:pf .7s ease-out forwards;' +
        '--dx:' + Math.cos(angle) * dist + 'px;' +
        '--dy:' + Math.sin(angle) * dist + 'px';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  },

  // Flash barra parole
  barPulse(t) {
    const b = document.getElementById('wbar');
    if (!b) return;
    b.classList.remove('ok', 'cb', 'er');
    void b.offsetWidth;
    b.classList.add(t);
    setTimeout(() => b.classList.remove('ok', 'cb', 'er'), 500);
  }
};

// Iniezione keyframe particelle
const pfStyle = document.createElement('style');
pfStyle.textContent =
  '@keyframes pf{' +
    '0%{opacity:1;transform:translate(0,0) scale(1)}' +
    '100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(0)}' +
  '}';
document.head.appendChild(pfStyle);

// ─── Motore di gioco ──────────────────────────────────────
const G = {
  board: [],
  sel: [],
  score: 0,
  level: 1,
  combo: 1,
  comboTimer: null,
  bestCombo: 1,
  wordsFound: 0,
  longestWord: '',
  history: [],
  dropInterval: 2800,
  dropTimer: null,
  tid: 0,
  spawnPaused: false,
  boardEl: null,
  ts: 0,
  bh: 0,

  missions: [
    { text: 'Trova una parola da 5 lettere', check: () => G.history.some(w => w.length >= 5), done: false },
    { text: 'Raggiungi 300 punti', check: () => G.score >= 300, done: false },
    { text: 'Fai una combo x3', check: () => G.combo >= 3, done: false },
    { text: 'Trova 5 parole', check: () => G.wordsFound >= 5, done: false },
    { text: 'Trova una parola da 6 lettere', check: () => G.history.some(w => w.length >= 6), done: false },
    { text: 'Raggiungi 1000 punti', check: () => G.score >= 1000, done: false }
  ],
  curMission: null,
  mIdx: 0,

  // Reset completo e avvio partita
  init() {
    this.boardEl = document.getElementById('board');
    this.calcSize();
    console.log('[G.init] ts=' + this.ts, 'bh=' + this.bh);

    this.board = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
    this.sel = [];
    this.score = 0;
    this.level = 1;
    this.combo = 1;
    this.bestCombo = 1;
    this.wordsFound = 0;
    this.longestWord = '';
    this.history = [];
    this.dropInterval = 2800;
    this.spawnPaused = false;
    this.tid = 0;
    this.mIdx = 0;
    this.curMission = null;

    this.missions.forEach(m => m.done = false);
    this.nextMission();
    this.boardEl.innerHTML = '';
    this.startDrop();
  },

  // Calcolo dimensioni tile e board
  calcSize() {
    const parent = this.boardEl?.parentElement;
    let cw = parent ? parent.clientWidth - 4 : 0;
    if (cw <= 0) {
      cw = Math.min(window.innerWidth - 24, 448) - 4;
      console.log('[calcSize] Fallback window-based cw=' + cw);
    }
    this.ts = Math.max(1, Math.floor((cw - (COLS + 1) * GAP) / COLS));
    this.bh = this.ts * ROWS + GAP * (ROWS + 1);
    this.boardEl.style.width = cw + 'px';
    this.boardEl.style.height = this.bh + 'px';
  },

  // Avvia il timer di cadenza lettere
  startDrop() {
    clearInterval(this.dropTimer);
    this.dropTimer = setInterval(() => {
      if (!this.spawnPaused) this.spawn();
    }, this.dropInterval);
  },

  // Genera una nuova lettera in colonna random
  spawn() {
    const col = Math.floor(Math.random() * COLS);

    // Trova la prima riga libera dal basso
    let row = -1;
    for (let r = 0; r < ROWS; r++) {
      if (!this.board[col][r]) { row = r; break; }
    }
    if (row === -1) { this.gameOver(); return; }

    const letter = POOL[Math.floor(Math.random() * POOL.length)];
    const id = ++this.tid;
    const el = document.createElement('div');

    el.className = 'tl';
    el.dataset.id = id;
    el.textContent = letter;

    const s = this.ts;
    el.style.width = s + 'px';
    el.style.height = s + 'px';
    el.style.fontSize = (s * .45) + 'px';
    el.style.left = (GAP + col * (s + GAP)) + 'px';
    el.style.top = (-s - 10) + 'px';

    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      G.toggleSel(+el.dataset.col, +el.dataset.row);
    });

    el.dataset.col = col;
    el.dataset.row = row;
    this.boardEl.appendChild(el);
    this.board[col][row] = { id, letter, el };

    // Animazione caduta
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.top = (GAP + (ROWS - 1 - row) * (s + GAP)) + 'px';
        setTimeout(() => el.classList.add('ln'), 350);
      });
    });

    this.checkDanger();
  },

  // Seleziona / deseleziona una tile
  toggleSel(col, row) {
    SFX.init();
    const idx = this.sel.findIndex(s => s.col === col && s.row === row);

    if (idx !== -1) {
      this.sel.splice(idx, 1);
      this.board[col][row].el.classList.remove('sl');
      SFX.play('click');
    } else {
      this.sel.push({ col, row });
      this.board[col][row].el.classList.add('sl');
      SFX.play('click');
    }

    this.updateWordBar();
  },

  // Parola formata dalla selezione corrente
  getWord() {
    return this.sel.map(s => this.board[s.col][s.row]?.letter || '').join('');
  },

  // Aggiorna la barra parole nel DOM
  updateWordBar() {
    const w = this.getWord();
    const u = Alpine.store('u');
    u.cw = w;
    u.iv = w.length >= 2 && DICT.has(w);
    u.cb = this.combo;
    u.cm = this.combo;
  },

  // Validazione e punteggio parola
  submitWord() {
    const w = this.getWord().toUpperCase();
    const u = Alpine.store('u');

    if (w.length < 2 || !DICT.has(w)) {
      SFX.play('err');
      FX.barPulse('er');
      this.clearSel();
      this.breakCombo();
      return;
    }

    // Calcolo punti
    const isCombo = this.combo > 1;
    let pts = w.length * 10 * this.combo;
    if (w.length >= 5) pts += w.length * 20;
    if (w.length >= 7) pts += w.length * 50;

    this.score += pts;
    this.wordsFound++;
    if (w.length > (this.longestWord || '').length) this.longestWord = w;
    this.history.push(w);

    // Feedback audio/visivo per lunghezza
    if (w.length >= 7) {
      SFX.play('big');
      FX.milestone('PAROLA EPICA', '#c6ff00');
    } else if (w.length >= 5) {
      SFX.play('big');
      FX.milestone('GRANDE!', '#ffd740');
    } else if (isCombo) {
      SFX.play('combo');
      FX.barPulse('cb');
    } else {
      SFX.play('valid');
      FX.barPulse('ok');
    }

    // Effetti su ultima tile selezionata
    const last = this.sel[this.sel.length - 1];
    if (last) {
      const el = this.board[last.col][last.row]?.el;
      if (el) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        FX.pop(cx - 15, r.top - 10, pts, isCombo ? '#ffd740' : '#00e676');
        FX.particles(cx, cy, isCombo ? '#ffab00' : '#00e676', w.length >= 5 ? 14 : 8);
      }
    }

    // Rimozione tile e gravity
    const toRemove = [...this.sel];
    toRemove.forEach(s => {
      const t = this.board[s.col][s.row];
      if (t) {
        t.el.classList.remove('sl');
        t.el.classList.add('rm');
      }
      this.board[s.col][s.row] = null;
    });
    this.sel = [];
    u.cw = null;
    u.iv = false;

    setTimeout(() => this.collapse(), 400);
    this.updateCombo();
    this.checkMission();
    this.updateLevel();

    // Traguardo ogni 5 parole
    if (this.wordsFound % 5 === 0) FX.milestone('STRAORDINARIO!', '#00e676');

    // Pausa spawn per parole lunghe
    if (w.length >= 5) {
      this.spawnPaused = true;
      setTimeout(() => { this.spawnPaused = false }, 1200);
    }

    this.syncHUD();
  },

  // Gravity: compatta le colonne verso il basso
  collapse() {
    for (let c = 0; c < COLS; c++) {
      let wr = 0;
      for (let r = 0; r < ROWS; r++) {
        if (this.board[c][r]) {
          if (wr !== r) {
            this.board[c][wr] = this.board[c][r];
            this.board[c][r] = null;
            this.board[c][wr].el.dataset.row = wr;
            this.board[c][wr].el.style.top = (GAP + (ROWS - 1 - wr) * (this.ts + GAP)) + 'px';
            setTimeout(() => this.board[c][wr]?.el.classList.add('ln'), 350);
          }
          wr++;
        }
      }
    }
    this.checkDanger();
  },

  // Pulisce la selezione corrente
  clearSel() {
    this.sel.forEach(s => {
      const t = this.board[s.col][s.row];
      if (t) t.el.classList.remove('sl');
    });
    this.sel = [];
    Alpine.store('u').cw = null;
    Alpine.store('u').iv = false;
  },

  // Incrementa combo e resetta timer 5s
  updateCombo() {
    clearTimeout(this.comboTimer);
    this.combo++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.comboTimer = setTimeout(() => {
      this.combo = 1;
      Alpine.store('u').cb = 1;
      Alpine.store('u').cm = 1;
    }, 5000);
  },

  // Azzera la combo
  breakCombo() {
    this.combo = 1;
    clearTimeout(this.comboTimer);
    Alpine.store('u').cb = 1;
    Alpine.store('u').cm = 1;
  },

  // Check livello successivo (ogni 500 punti)
  updateLevel() {
    const nl = Math.floor(this.score / 500) + 1;
    if (nl > this.level) {
      this.level = nl;
      this.dropInterval = Math.max(800, 2800 - (this.level - 1) * 200);
      this.startDrop();
      FX.milestone('LIVELLO ' + this.level, '#00d4aa');
      SFX.play('combo');
    }
  },

  // Aggiorna indicatori pericolo sulle colonne
  checkDanger() {
    let maxH = 0;
    for (let c = 0; c < COLS; c++) {
      let h = 0;
      for (let r = 0; r < ROWS; r++) {
        if (this.board[c][r]) h = r + 1;
      }
      if (h > maxH) maxH = h;

      for (let r = 0; r < ROWS; r++) {
        const t = this.board[c][r];
        if (t) {
          if (r >= ROWS - 2) t.el.classList.add('wr');
          else t.el.classList.remove('wr');
        }
      }
    }

    const u = Alpine.store('u');
    if (maxH >= ROWS - 1) u.dl = 'critical';
    else if (maxH >= ROWS - 3) u.dl = 'danger';
    else u.dl = 'safe';
  },

  // Missione successiva
  nextMission() {
    if (this.mIdx < this.missions.length) {
      this.curMission = this.missions[this.mIdx++];
    } else {
      this.curMission = null;
    }
    Alpine.store('u').mp = this.curMission ? this.curMission.text : null;
  },

  // Check completamento missione
  checkMission() {
    if (!this.curMission || this.curMission.done) return;
    if (this.curMission.check()) {
      this.curMission.done = true;
      this.score += 100;
      FX.milestone('MISSIONE COMPLETATA', '#c6ff00');
      SFX.play('big');
      setTimeout(() => this.nextMission(), 1800);
    }
  },

  // Sincronizza stato verso Alpine store (reactive HUD)
  syncHUD() {
    const u = Alpine.store('u');
    u.sc2 = this.score;
    u.lv = this.level;
    u.wc = this.wordsFound;
    u.lw = this.longestWord;
    u.bc = this.bestCombo;
    u.hs = [...this.history];
    u.cb = this.combo;
    u.cm = this.combo;
  },

  // Fine partita
  gameOver() {
    clearInterval(this.dropTimer);
    this.spawnPaused = true;
    SFX.play('go');

    const u = Alpine.store('u');
    u.fs = this.score;
    u.fw = this.wordsFound;
    u.fl = this.longestWord || '—';
    u.fb = this.bestCombo;
    u.fv = this.level;
    u.sc = 'gameover';
  },

  pause() {
    clearInterval(this.dropTimer);
    this.spawnPaused = true;
  },

  resume() {
    this.spawnPaused = false;
    this.startDrop();
  },

  destroy() {
    clearInterval(this.dropTimer);
    clearTimeout(this.comboTimer);
  }
};

// ─── Alpine store (stato reattivo UI) ─────────────────────
document.addEventListener('alpine:init', () => {
  Alpine.store('u', {
    sc: 'intro',      // screen: intro | loading | game | paused | gameover
    sc2: '0',         // score display
    lv: '1',          // livello
    cb: 1,            // combo attuale
    cm: 1,            // combo display
    wc: 0,            // words count
    lw: '',           // longest word
    bc: 1,            // best combo
    fs: '0',          // final score
    fw: 0,            // final words
    fl: '—',          // final longest
    fb: 1,            // final best combo
    fv: '1',          // final level
    cw: null,         // current word
    iv: false,        // is valid
    au: true,         // audio on
    dl: 'safe',       // danger level: safe | danger | critical
    hs: [],           // history
    tut: false,       // tutorial visible
    mp: null,         // mission prompt
    ms: null,         // milestone text
    mc: null,         // milestone color
    lt: ''            // loading text
  });
});

// ─── Alpine component (collegamento HTML ↔ motore) ────────
function gc() {
  return {
    get wbc() {
      const u = Alpine.store('u');
      if (u.cw && u.iv && u.cb > 1) return 'cb';
      if (u.cw && u.iv) return 'ok';
      return '';
    },

    onKey(e) {
      if (Alpine.store('u').sc !== 'game') return;
      if (e.key === 'Enter') this.submitWord();
      else if (e.key === 'Escape') this.clearSel();
      else if (e.key === 'Backspace') {
        e.preventDefault();
        if (G.sel.length) {
          const s = G.sel[G.sel.length - 1];
          G.toggleSel(s.col, s.row);
        }
      }
    },

    async startGame() {
      SFX.init();
      Alpine.store('u').sc = 'loading';
      Alpine.store('u').lt = 'Caricamento dizionario...';
      try {
        await loadDict();
      } catch (e) {
        console.error('[startGame] Errore:', e);
        Alpine.store('u').lt = 'Errore di caricamento.';
        return;
      }
      if (DICT.size < 100) {
        Alpine.store('u').lt = 'Dizionario troppo piccolo.';
        return;
      }
      Alpine.store('u').lt = DICT.size + ' parole caricate';
      Alpine.store('u').sc = 'game';
      await Alpine.nextTick();
      G.init();
      G.syncHUD();
      Alpine.store('u').tut = true;
    },

    clearSel() { G.clearSel() },
    submitWord() { G.submitWord() },

    togglePause() {
      if (Alpine.store('u').sc === 'game') {
        G.pause();
        Alpine.store('u').sc = 'paused';
      }
    },

    resumeGame() {
      G.resume();
      Alpine.store('u').sc = 'game';
    },

    quitGame() {
      G.destroy();
      Alpine.store('u').sc = 'intro';
    },

    async restartGame() {
      Alpine.store('u').sc = 'game';
      await Alpine.nextTick();
      G.init();
      G.syncHUD();
    },

    toggleAudio() {
      SFX.on = !SFX.on;
      Alpine.store('u').au = SFX.on;
    },

    shareWhatsApp() {
      const u = Alpine.store('u');
      const msg =
        '\uD83D\uDD10 LETTERE \u2013 Puzzle Arcade\n\n' +
        '\uD83C\uDFAF ' + u.fs + ' punti\n' +
        '\uD83D\uDCDD ' + u.fw + ' parole\n' +
        '\uD83D\uDCCF Pi\u00F9 lunga: ' + u.fl + '\n' +
        '\u26A1 Combo max: x' + u.fb + '\n' +
        '\uD83C\uDFC6 Livello: ' + u.fv + '\n\n' +
        'Riesci a battermi?';
      window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg), '_blank');
    }
  };
}
