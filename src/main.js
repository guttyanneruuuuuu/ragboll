// ============================================================
// RAGBLADE ARENA — Entry Point
// ============================================================
// 全画面遷移、UIイベント、ゲームインスタンス起動を統括する。
// 純粋ES Modules で書く（ビルド不要）。
// ============================================================

import { Settings } from './core/settings.js';
import { ScreenManager } from './ui/screens.js';
import { Game } from './game/game.js';
import { Net } from './net/net.js';
import { Hud } from './ui/hud.js';
import { CARD_LIBRARY, summarizeDeck } from './game/cards.js';
import { Lobby } from './ui/lobby.js';

class App {
  constructor() {
    this.settings = new Settings();
    this.settings.load();
    this.screens = new ScreenManager();
    this.hud = new Hud();
    this.net = new Net();
    this.game = null;
    this.lobby = new Lobby(this);
  }

  start() {
    this.bindGlobalActions();
    this.screens.show('title');
    this.bootLog('✔ Boot complete · v0.1.0');

    // apply persisted settings to inputs
    document.getElementById('cfg-sfx').value = this.settings.sfx;
    document.getElementById('cfg-bgm').value = this.settings.bgm;
    document.getElementById('cfg-vibrate').checked = this.settings.vibrate;
    document.getElementById('cfg-quality').value = this.settings.quality;
    document.getElementById('cfg-sens').value = this.settings.sensitivity;
    document.getElementById('cfg-weapon').value = this.settings.weapon;
    document.getElementById('cfg-arena').value = this.settings.arena;
    document.getElementById('cfg-camera').value = this.settings.cameraMode;

    // settings save
    const wire = (id, key, type='value', parse=v=>v) => {
      document.getElementById(id).addEventListener('input', (e) => {
        this.settings[key] = parse(e.target[type]);
        this.settings.save();
      });
    };
    wire('cfg-sfx', 'sfx', 'value', parseFloat);
    wire('cfg-bgm', 'bgm', 'value', parseFloat);
    wire('cfg-vibrate', 'vibrate', 'checked');
    wire('cfg-quality', 'quality');
    wire('cfg-sens', 'sensitivity', 'value', parseFloat);
    wire('cfg-weapon', 'weapon');
    wire('cfg-arena', 'arena');
    wire('cfg-camera', 'cameraMode');

    // card loadout UI
    const cardHost = document.getElementById('card-loadout');
    if (cardHost) {
      const render = () => {
        cardHost.innerHTML = CARD_LIBRARY.map((c) => {
          const on = this.settings.deck?.includes(c.id);
          return `<button class="card-chip ${on ? 'on' : ''}" data-card="${c.id}" title="${c.desc}">${c.name}</button>`;
        }).join('');
      };
      render();
      cardHost.addEventListener('click', (e) => {
        const b = e.target.closest('[data-card]'); if (!b) return;
        const id = b.dataset.card;
        const deck = new Set(this.settings.deck || []);
        if (deck.has(id)) deck.delete(id); else if (deck.size < 5) deck.add(id);
        this.settings.deck = [...deck];
        this.settings.save();
        render();
      });
    }

    // Auto-join from URL hash (?join=ABCD1234)
    const params = new URLSearchParams(location.search);
    if (params.has('join')) {
      const code = params.get('join').toUpperCase();
      setTimeout(() => this.lobby.join(code), 500);
    }
    // Auto-launch for dev/testing: ?auto=solo|local-versus
    if (params.has('auto')) {
      const m = params.get('auto');
      setTimeout(() => this.startGame({ mode: m }), 300);
    }
  }

  bindGlobalActions() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]');
      if (!a) return;
      const action = a.dataset.action;
      this.handleAction(action);
    });
    // pause via keyboard
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.game && this.game.running) {
        this.handleAction('pause');
      }
    });
  }

  handleAction(action) {
    switch (action) {
      case 'solo':           this.startGame({ mode: 'solo' }); break;
      case 'local-versus':   this.startGame({ mode: 'local-versus' }); break;
      case 'online-host':    this.screens.show('lobby'); this.lobby.host(); break;
      case 'online-join':    this.screens.show('lobby'); this.lobby.askCode(); break;
      case 'settings':       this.screens.show('settings'); break;
      case 'how-to-play':    this.screens.show('howto'); break;
      case 'back-to-title':  this.lobby.leave(); this.screens.show('title'); break;
      case 'pause':          this.pauseGame(); break;
      case 'resume':         this.resumeGame(); break;
      case 'restart':        this.restartGame(); break;
      case 'rematch':        this.restartGame(); break;
      case 'quit':           this.quitGame(); break;
    }
  }

  startGame(opts) {
    this.screens.show('loading');
    setLoader(0, 'シーンを構築中...');
    // give the loader a frame to paint
    requestAnimationFrame(() => {
      this.game = new Game({
        canvas: document.getElementById('game-canvas'),
        settings: this.settings,
        hud: this.hud,
        net: opts.mode.startsWith('online') ? this.net : null,
        mode: opts.mode,
        cardMods: summarizeDeck(this.settings.deck || []),
        onLoadProgress: (p, msg) => setLoader(p, msg),
        onMatchEnd: (result) => this.showResult(result),
      });
      this.game.init().then(() => {
        setLoader(100, '開戦！');
        setTimeout(() => {
          this.screens.show('game');
          this.game.start();
        }, 200);
      });
    });
  }

  pauseGame() {
    if (!this.game) return;
    this.game.pause();
    this.screens.show('pause', true);
  }
  resumeGame() {
    this.screens.hide('pause');
    if (this.game) this.game.resume();
  }
  restartGame() {
    this.screens.hide('pause');
    this.screens.hide('result');
    if (this.game) this.game.restart();
  }
  quitGame() {
    if (this.game) { this.game.dispose(); this.game = null; }
    this.screens.hide('pause');
    this.screens.hide('result');
    this.screens.show('title');
  }

  showResult(result) {
    document.getElementById('result-text').textContent = result.victory ? 'VICTORY!' : 'DEFEAT...';
    document.getElementById('result-stats').innerHTML = `
      <div>⏱ 試合時間 : ${result.time}</div>
      <div>⚔ 与ダメージ : ${result.damageDealt}</div>
      <div>💥 最大コンボ : ${result.maxCombo}</div>
      <div>🔒 関節ロック : ${result.jointsLocked}</div>
    `;
    this.screens.show('result', true);
  }

  bootLog(msg) { console.log('%c[RAGBLADE]', 'color:#ff3344;font-weight:bold;', msg); }
}

function setLoader(p, msg) {
  const fill = document.getElementById('loader-fill');
  const txt = document.getElementById('loader-text');
  if (fill) fill.style.width = `${p}%`;
  if (txt && msg) txt.textContent = msg;
}

const app = new App();
window.__RAGBLADE__ = app;
app.start();
