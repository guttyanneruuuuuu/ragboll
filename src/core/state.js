// ============================================================
// state.js — Top-level game state machine.
//
// Screens (title, lobby, game, settings, ...) form a stack so we
// can navigate "back" without re-rendering the entire tree.
// ============================================================

import { bus, Channels } from '../util/events.js';

export const Screens = Object.freeze({
  BOOT:        'boot',
  TITLE:       'title',
  HOWTO:       'howto',
  SETTINGS:    'settings',
  PROFILE:     'profile',
  SHOP:        'shop',
  CARDS:       'cards',
  LOBBY:       'lobby',
  ROOM:        'room',
  GAME:        'game',
  PAUSE:       'pause',
  RESULT:      'result',
  REPLAY:      'replay',
  REPLAY_LIST: 'replay-list',
  TUTORIAL:    'tutorial',
  ARCADE:      'arcade',
  LOADING:     'loading',
});

class StateMachine {
  constructor() {
    this.stack = [Screens.BOOT];
    this.match = null;       // active match payload
    this.context = {};       // free-form per-screen context
  }

  /** Current top-of-stack screen. */
  get current() { return this.stack[this.stack.length - 1]; }

  /** Replace the entire stack with a single screen. */
  reset(screen, context = {}) {
    this.stack = [screen];
    this.context = context;
    bus.emit(Channels.UI_SCREEN, { current: screen, stack: this.stack.slice(), context });
  }

  /** Push a new screen on top. */
  push(screen, context = {}) {
    this.stack.push(screen);
    this.context = context;
    bus.emit(Channels.UI_SCREEN, { current: screen, stack: this.stack.slice(), context });
  }

  /** Pop the current screen. */
  pop() {
    if (this.stack.length > 1) this.stack.pop();
    bus.emit(Channels.UI_SCREEN, { current: this.current, stack: this.stack.slice(), context: this.context });
  }

  /** Replace just the top of stack. */
  swap(screen, context = {}) {
    this.stack[this.stack.length - 1] = screen;
    this.context = context;
    bus.emit(Channels.UI_SCREEN, { current: screen, stack: this.stack.slice(), context });
  }

  /** Is the given screen visible right now? */
  is(screen) { return this.current === screen; }

  /** Helper: navigate to title and clear context. */
  toTitle() { this.reset(Screens.TITLE); }

  /** Set the active match payload. */
  setMatch(payload) {
    this.match = payload;
    bus.emit(Channels.UI_NAV, { match: payload });
  }
}

export const gameState = new StateMachine();
