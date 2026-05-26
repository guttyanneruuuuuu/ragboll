# ⚔ RAGBLADE ARENA

**Ragdoll Blade の上位互換ブラウザゲーム**  
ラグドール物理 × 剣戟アクション × オンライン友達対戦

🎮 **Play now → https://guttyanneruuuuuu.github.io/ragboll/**

> **初回セットアップ:** リポジトリの `Settings` → `Pages` → `Source: Deploy from a branch` → `Branch: main / root` を選んで `Save` するだけ。約1分後にURLが有効化されます。

---

## 🎯 コンセプト

> 「Ragdoll Blade の爽快感をそのままに、オンライン友達対戦・ビルドカスタム・物理ステージギミックを追加した、ギガ切れでも動く神ゲー」

- **3D ラグドール物理**: cannon-es による関節拘束シミュレーション
- **剣戟アクション**: スワイプ／マウスドラッグで剣の軌道を完全コントロール
- **関節ロックシステム**: 被弾した関節が硬直し、戦略的な戦闘を生む
- **オンライン友達対戦**: WebRTC P2P (PeerJS) — URL 共有だけで対戦開始
- **超軽量**: 初回ロード約 500KB、以降オフラインで動く PWA
- **触覚フィードバック**: 剣が当たると `navigator.vibrate` でスマホが震える

---

## 🕹 操作

| プラットフォーム | 移動 | 剣を振る | ガード |
| --- | --- | --- | --- |
| **PC** | `WASD` | マウスドラッグ | 右クリック |
| **モバイル** | 左バーチャルパッド | 右スワイプ | 専用ボタン |
| **ゲームパッド** | 左スティック | 右スティック | `LB` |

---

## 🏗 技術スタック

| レイヤー | 技術 |
| --- | --- |
| レンダリング | Three.js (CDN, r160) |
| 物理 | cannon-es (CDN) |
| ネットワーク | PeerJS (WebRTC P2P) |
| ビルド | **なし** — 素の ES Modules |
| PWA | Service Worker + Web App Manifest |
| ホスティング | GitHub Pages |

ビルドツール、フレームワーク、バンドラ一切なし。`index.html` を開けば動く設計。

---

## 🚀 ローカルで動かす

```bash
git clone https://github.com/guttyanneruuuuuu/ragboll.git
cd ragboll
python3 -m http.server 8000
# → http://localhost:8000
```

---

## 📦 リリース

`main` ブランチに push するだけで GitHub Pages が自動で再デプロイします（静的サイトなのでビルド不要）。

---

## 🗺 ロードマップ

- [x] Phase 0: プロトタイプ (3D ラグドール + 剣戟 + ローカル対戦)
- [ ] Phase 1: MVP (オンライン対戦 + ELO ランキング)
- [ ] Phase 2: 拡張 (バトロワ、ステージギミック、武器バリエーション)
- [ ] Phase 3: 正式 (リプレイ共有、シーズン制)

---

## 📜 ライセンス

MIT
