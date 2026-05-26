// HUD: HP bars, joint indicators, combo, timer.
const JOINT_NAMES = ['head', 'spine', 'lShoulder', 'rShoulder', 'lElbow', 'rElbow', 'lHip', 'rHip', 'lKnee', 'rKnee'];

export class Hud {
  constructor() {
    this.p1HpEl   = document.getElementById('hud-p1-hp');
    this.p2HpEl   = document.getElementById('hud-p2-hp');
    this.p1NameEl = document.getElementById('hud-p1-name');
    this.p2NameEl = document.getElementById('hud-p2-name');
    this.p1JointsEl = document.getElementById('hud-p1-joints');
    this.p2JointsEl = document.getElementById('hud-p2-joints');
    this.timerEl  = document.getElementById('hud-timer');
    this.roundEl  = document.getElementById('hud-round');
    this.flashEl  = document.getElementById('hit-flash');
    this.comboEl  = document.getElementById('combo-display');
    this._buildJoints(this.p1JointsEl);
    this._buildJoints(this.p2JointsEl);
  }
  _buildJoints(parent) {
    parent.innerHTML = '';
    JOINT_NAMES.forEach((name) => {
      const d = document.createElement('div');
      d.className = 'hud-joint';
      d.dataset.joint = name;
      d.title = name;
      parent.appendChild(d);
    });
  }
  setNames(p1, p2) {
    this.p1NameEl.textContent = p1;
    this.p2NameEl.textContent = p2;
  }
  setHp(which, ratio) {
    const el = which === 1 ? this.p1HpEl : this.p2HpEl;
    el.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }
  setJoint(which, jointName, locked) {
    const parent = which === 1 ? this.p1JointsEl : this.p2JointsEl;
    const el = parent.querySelector(`[data-joint="${jointName}"]`);
    if (el) el.classList.toggle('locked', locked);
  }
  setTimer(seconds) {
    if (seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  setRound(round) {
    this.roundEl.textContent = `ROUND ${round}`;
  }
  flashHit(color = '#ff3344') {
    this.flashEl.style.background = `radial-gradient(circle, ${color}99 0%, transparent 60%)`;
    this.flashEl.classList.remove('active');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('active');
  }
  showCombo(text) {
    this.comboEl.textContent = text;
    this.comboEl.classList.remove('show');
    void this.comboEl.offsetWidth;
    this.comboEl.classList.add('show');
  }
}
