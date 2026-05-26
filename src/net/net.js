// ============================================================
// Net: P2P over WebRTC (PeerJS). 友達対戦専用。
// Host = サーバー権威。Joiner = ホストにinput送信、状態を受信。
// ============================================================
// Loaded lazily because peerjs is large; Solo / Local mode doesn't need it.

let PeerCtor = null;
async function loadPeer() {
  if (PeerCtor) return PeerCtor;
  await import('peerjs');
  // peerjs UMD: attaches to window.Peer
  PeerCtor = window.Peer;
  return PeerCtor;
}

export class Net {
  constructor() {
    this.peer = null;
    this.conn = null;           // active DataConnection
    this.role = null;           // 'host' | 'joiner'
    this.code = null;           // room code (= peer id)
    this.handlers = {
      open: [],
      ready: [],
      data: [],
      close: [],
      error: [],
    };
  }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  _emit(ev, ...a) { (this.handlers[ev] || []).forEach((fn) => fn(...a)); }

  async host() {
    const Peer = await loadPeer();
    this.role = 'host';
    this.code = genCode();
    this.peer = new Peer('ragblade-' + this.code, { debug: 0 });
    this.peer.on('open', (id) => this._emit('open', this.code));
    this.peer.on('error', (e) => this._emit('error', e));
    this.peer.on('connection', (conn) => {
      this.conn = conn;
      this._wireConn(conn);
    });
  }

  async join(code) {
    const Peer = await loadPeer();
    this.role = 'joiner';
    this.code = code.toUpperCase();
    this.peer = new Peer(null, { debug: 0 });
    this.peer.on('open', () => {
      this.conn = this.peer.connect('ragblade-' + this.code, { reliable: false });
      this._wireConn(this.conn);
    });
    this.peer.on('error', (e) => this._emit('error', e));
  }

  _wireConn(conn) {
    conn.on('open', () => this._emit('ready', this.role));
    conn.on('data', (d) => this._emit('data', d));
    conn.on('close', () => this._emit('close'));
    conn.on('error', (e) => this._emit('error', e));
  }

  send(data) {
    if (this.conn && this.conn.open) {
      try { this.conn.send(data); } catch (_) {}
    }
  }

  close() {
    try { this.conn?.close(); } catch (_) {}
    try { this.peer?.destroy(); } catch (_) {}
    this.conn = null; this.peer = null; this.role = null; this.code = null;
  }
}

function genCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // skip ambiguous chars
  let c = '';
  for (let i = 0; i < 6; i++) c += A[(Math.random() * A.length) | 0];
  return c;
}
