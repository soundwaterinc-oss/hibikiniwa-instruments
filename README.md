# 響庭（Hibikiniwa）楽器群

2つのブラウザ楽器と、その共通基盤です。**ビルドなし・ES Modules・本体の依存ゼロ**（devDependency はテスト用のみ）。

| 楽器 | 中身 |
|---|---|
| [**HYPOGEUM // KKR-40**](apps/hypogeum/) | 低域（20〜250Hz）のドローン楽器。13の音色エンジン、世界53音階、40Hz聴覚刺激・共鳴呼吸・バイノーラル（旧 KUKURU）。→ [README](apps/hypogeum/README.md)・[研究背景](apps/hypogeum/docs/RESEARCH.md) |
| [**STOMA//16**](apps/stoma16/) | 植物細胞の顕微鏡写真を切り分け、面積・隣接数・向き・組織の種類をビートの位置と音色に変えるリズム楽器。→ [README](apps/stoma16/README.md)・[形態学と設計](apps/stoma16/docs/MORPHOLOGY.md) |

**公開版**: https://soundwaterinc-oss.github.io/hibikiniwa-instruments/

## 起動

ES Modules と Web Worker を使うため、`index.html` をダブルクリック（`file://`）で開いても動きません。ローカルサーバー経由で開きます（Node.js 20 以上）。

- **Windows**：`HIBIKINIWA.bat` をダブルクリック → http://localhost:8080/ が開きます。
- **どのOSでも**：
  ```bash
  git clone https://github.com/soundwaterinc-oss/hibikiniwa-instruments.git
  cd hibikiniwa-instruments
  npm run serve      # 依存ゼロの Node 製サーバー → http://localhost:8080/
  ```

## GARDEN BUS（楽器どうしの同期）

同じブラウザで2つの楽器を別のタブで開き、ヘッダーの **BUS** ボタンで役割を選びます（OFF → MST＝master → FLW＝follow）。BroadcastChannel でテンポ・小節位置・基音・音階を共有します。

| master | follow | 何が起きるか |
|---|---|---|
| STOMA//16 | HYPOGEUM | HYPOGEUM の呼吸ガイドとドリフトの周期を小節の整数倍にそろえ、吸い始めを小節の頭に合わせる。基音は STOMA の F₀ に追従 |
| HYPOGEUM | STOMA//16 | STOMA の低音（T トラック・SUB 音色）を HYPOGEUM の音階の度数に量子化し、基音も合わせる |
| STOMA//16 | STOMA//16 | テンポと小節位置を合わせる |

入口のページ（ルートの index.html）に、開いている楽器の役割・BPM・基音・音階コード・小節を表示します。

## 共通基盤 `packages/core`

| ファイル | 役割 |
|---|---|
| `ui.js` `format.js` | スキーマ駆動UI（パラメータ定義からフェーダー・セレクタ・表示を作る。ダブルクリックで初期値。平文の aria-label・title） |
| `decode.js` | [DECODE] トグル（コード表示 ⇄ コード＋平文）。安全注意の文章は常に平文 |
| `store.js` | 保存・復元（localStorage はすべて try/catch）、`{ app, version, params }`、undo（直近20操作） |
| `master.js` | マスター段：DCカット → ソフトクリップ（任意）→ ルックアヘッド・リミッター（−1 dBTP 目安）→ メーター。標準ノードだけで組む |
| `wav.js` | MediaRecorder でマスター出力を録音 → WAV（PCM）に変換して保存 |
| `midi.js` `smf.js` | MIDI learn・ノートで基音・ノート出力、Standard MIDI File の書き出し |
| `bus.js` | GARDEN BUS |
| `shell.js` | メーター、録音、undo、MIDI learn、BUS の役割切替の操作部品 |
| `theme.css` | 測定器・地下観測所・暗視野顕微鏡の計器盤（ガンメタル＋真鍮の刻印＋減光したシアン）。画面全体の明滅・8Hz以上の点滅はしない |

## テスト・検証

```bash
npm install          # devDependency（node-web-audio-api、@napi-rs/canvas）
npm test             # 共通基盤・HYPOGEUM・STOMA（解析・音楽）・コードブック
npm run smoke        # 音響スモークテスト（両アプリ、オフライン描画で計測して表を出す）
npm run codebook     # docs/CODEBOOK.md を再生成
node scripts/browser-check.mjs http://localhost:8080   # ブラウザで各ページを開き、コンソールエラー・Worker 解析中の UI・2タブの同期を確認（Edge/Chrome）
```

- STOMA の実写真のテスト（根の横断面・苔の葉）は `fixtures/root_xs.jpg`・`fixtures/moss_leaf.jpg` がある環境でだけ実行されます。この2枚は出典・ライセンスが確認できないため、リポジトリには含めていません（`fixtures/` は .gitignore）。
- CI（GitHub Actions）で `npm test` と `npm run smoke` を実行します。
- 全コードの平文対応：[docs/CODEBOOK.md](docs/CODEBOOK.md)（自動生成）

## 構成

```
index.html               入口（GARDEN BUS の同期状態）
packages/core/           共通基盤
apps/hypogeum/           HYPOGEUM // KKR-40
apps/stoma16/            STOMA//16
scripts/                 serve / smoke / codebook / browser-check
tests/                   node --test
docs/CODEBOOK.md         コード名 ↔ 平文（自動生成）
fixtures/                実写真（ローカルのみ・リポジトリ外）
HIBIKINIWA.bat           Windows 用の起動
```

## 免責

どちらも医療機器ではなく、病気の診断・治療・予防を目的としません。音量は小さめから。てんかん・聴覚過敏・耳鳴り・ペースメーカー使用などで不安がある場合は医師に相談してください。

## ライセンス

MIT © 中村竜朗 (Tatsuro Nakamura)
