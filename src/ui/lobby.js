// Online lobby UI: host/join room, share invite link, ready up.
export class Lobby {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('lobby-content');
    this._wireNet();
  }
  _wireNet() {
    const net = this.app.net;
    net.on('open', (code) => {
      const inviteUrl = `${location.origin}${location.pathname}?join=${code}`;
      this.el.innerHTML = `
        <p class="lobby-status">部屋コード（友達に送ろう）</p>
        <div class="lobby-code" id="lobby-code" title="クリックでコピー">${code}</div>
        <div class="lobby-share">
          <button id="copy-link">🔗 招待リンクをコピー</button>
          <button id="copy-code">📋 コードをコピー</button>
        </div>
        <p class="lobby-status" id="conn-status">⏳ 友達の接続を待っています...</p>
      `;
      document.getElementById('lobby-code').onclick = () => copy(code);
      document.getElementById('copy-link').onclick = () => copy(inviteUrl);
      document.getElementById('copy-code').onclick = () => copy(code);
    });
    net.on('ready', (role) => {
      const status = document.getElementById('conn-status');
      if (status) status.textContent = '✅ 接続完了！3秒後に開始...';
      setTimeout(() => {
        if (role === 'host') this.app.startGame({ mode: 'online-host' });
        else this.app.startGame({ mode: 'online-joiner' });
      }, 1500);
    });
    net.on('error', (e) => {
      this.el.innerHTML = `
        <p class="lobby-status" style="color:#ff3344">❌ 接続エラー: ${e.type || e.message || e}</p>
        <p class="lobby-status">部屋コードを確認するか、しばらく待って再度お試しください。</p>
      `;
    });
    net.on('close', () => {
      const status = document.getElementById('conn-status');
      if (status) status.textContent = '🔌 友達が切断しました';
    });
  }
  async host() {
    this.el.innerHTML = `<p class="lobby-status">⏳ サーバーに接続中...</p>`;
    await this.app.net.host();
  }
  askCode() {
    this.el.innerHTML = `
      <p class="lobby-status">友達から教えてもらった部屋コードを入れよう</p>
      <input class="lobby-input" id="lobby-code-input" maxlength="6" autocapitalize="characters" placeholder="ABCDEF" />
      <div class="lobby-share" style="margin-top:12px;">
        <button id="join-go" style="background: rgba(255,51,68,0.5); border-color:#ff3344;">🚀 参加</button>
      </div>
    `;
    const input = document.getElementById('lobby-code-input');
    input.focus();
    input.oninput = (e) => { e.target.value = e.target.value.toUpperCase(); };
    document.getElementById('join-go').onclick = () => {
      const c = input.value.trim().toUpperCase();
      if (c.length >= 4) this.join(c);
    };
  }
  async join(code) {
    this.el.innerHTML = `<p class="lobby-status">⏳ コード ${code} に接続中...</p>`;
    await this.app.net.join(code);
  }
  leave() {
    this.app.net.close();
  }
}

function copy(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}
