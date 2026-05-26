// Switch between screen DOMs
export class ScreenManager {
  constructor() {
    this.ids = {
      title:    'title-screen',
      lobby:    'lobby-screen',
      settings: 'settings-screen',
      howto:    'howto-screen',
      game:     'game-screen',
      pause:    'pause-screen',
      result:   'result-screen',
      loading:  'loading-screen',
    };
  }
  /**
   * @param {string} name
   * @param {boolean} overlay - if true, leaves other screens visible
   */
  show(name, overlay = false) {
    const id = this.ids[name];
    if (!id) return;
    if (!overlay) {
      // hide non-overlay screens
      Object.values(this.ids).forEach((eid) => {
        const el = document.getElementById(eid);
        if (el && !el.classList.contains('overlay')) el.classList.remove('active');
      });
    }
    document.getElementById(id).classList.add('active');
  }
  hide(name) {
    const id = this.ids[name];
    if (!id) return;
    document.getElementById(id).classList.remove('active');
  }
}
