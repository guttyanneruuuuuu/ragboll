// Persistent settings (localStorage)
export class Settings {
  constructor() {
    this.sfx = 0.8;
    this.bgm = 0.5;
    this.vibrate = true;
    this.quality = 'medium'; // low | medium | high
    this.sensitivity = 1.0;
    this.oneHand = true;
    this.weapon = 'katana';
    this.arena = 'arena';
  }
  load() {
    try {
      const raw = localStorage.getItem('ragblade.settings');
      if (raw) Object.assign(this, JSON.parse(raw));
    } catch (_) {}
  }
  save() {
    try {
      localStorage.setItem('ragblade.settings', JSON.stringify({
        sfx: this.sfx, bgm: this.bgm, vibrate: this.vibrate,
        quality: this.quality, sensitivity: this.sensitivity,
        weapon: this.weapon, arena: this.arena,
        oneHand: this.oneHand,
      }));
    } catch (_) {}
  }
}
