// ============================================================
// bootstrap.js — Wire up the persistent layers and emit the
// `app/ready` event so the UI can render its first screen.
// ============================================================

import { migrate } from '../util/storage.js';
import { loadSettings, settings } from './settings.js';
import { loadProfile, profile } from './profile.js';
import { loadLoadout } from './loadout.js';
import { setLocale, register, detect } from '../util/i18n.js';
import '../data/locale.ja.js';
import '../data/locale.en.js';
import { logger } from '../util/logger.js';
import { bus, Channels } from '../util/events.js';

const log = logger('bootstrap');

/** Ensure persistent state is migrated and loaded. */
export function bootstrap() {
  migrate();
  loadSettings();
  loadProfile();
  loadLoadout();
  setLocale(settings.locale || detect());
  log.info('Bootstrap done. profile=', profile.playerName);
  bus.emit(Channels.GAME_INIT, { time: Date.now() });
  return { settings, profile };
}

/** Surface the version string used by the title screen. */
export const APP_VERSION = 'v1.0.0';
