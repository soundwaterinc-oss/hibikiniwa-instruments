# CODEBOOK — 響庭（Hibikiniwa）楽器群

> このファイルは `node scripts/codebook.mjs` で各アプリの `js/codebook.js` から自動生成しています。手で編集しないでください。

UIでは [DECODE] を押すと、すべてのラベルにここの平文が併記されます。各コントロールの `title` と `aria-label` には常に平文が入っています。安全注意の文章だけは暗号化していません。

## HYPOGEUM // KKR-40

**HYPOGEUM // KKR-40** = 地下の石室・低域ドローン楽器（旧 KUKURU）（`apps/hypogeum/js/codebook.js`）

### グループ

| コード | 平文 |
| --- | --- |
| §0x1 TUN | 調律 |
| §0x2 EXC | 駆動モード |
| §0x3 GEN | 音色エンジン |
| §0x4 DRF | 有機的揺らぎ |
| §0x5 Γ40 | 療法レイヤー（40Hz・アイソクロニック・バイノーラル） |
| §0x6 Φ.RSP | 共鳴呼吸ガイド |
| §0x7 SPC | 空間・低域マスター処理 |
| §0x8 SES | セッション |

### パラメータ

| レジスタ | コード | 内部キー | 平文 | 範囲 | 初期値 | グループ |
| --- | --- | --- | --- | --- | --- | --- |
| R0x10 | F₀ | `f0` | 基音 | 20〜250 Hz | 41.2 | §0x1 TUN |
| R0x11 | Δ¢ | `dc` | 微調整 | -100〜100 ¢ | 0 | §0x1 TUN |
| R0x12 | SUB.k | `subK` | サブオクターブ量 | 0〜1 | 0.3 | §0x1 TUN |
| R0x13 | SUP.k | `hiK` | 上オクターブ量 | 0〜1 | 0.35 | §0x1 TUN |
| R0x14 | EXC.m | `exc` | 駆動モード | sustain / tanpura / hybrid | sustain | §0x2 EXC |
| R0x15 | T.cyc | `cyc` | タンプーラ1周の長さ | 1.2〜10 s | 3.6 | §0x2 EXC |
| R0x16 | τ.dk | `tau` | 撥弦の余韻 | 1〜12 s | 5 | §0x2 EXC |
| R0x17 | JWR | `jaw` | ジャワリ（さわり） | 0〜1 | 0.55 | §0x2 EXC |
| R0x18 | ENG | `eng` | 音色エンジン | add / sin / reese / fm2 / fold / undr / ladder / pwm / organ / kargyraa / didj / bow / tape | add | §0x3 GEN |
| R0x19 | Α | `ma` | マクロΑ（意味はエンジンごと） | 0〜1 | 0.35 | §0x3 GEN |
| R0x1A | Β | `mb` | マクロΒ（意味はエンジンごと） | 0〜1 | 0.35 | §0x3 GEN |
| R0x1B | Γ | `mc` | マクロΓ（意味はエンジンごと） | 0〜1 | 0.35 | §0x3 GEN |
| R0x1C | H.n | `hN` | 倍音数（ADD.H・撥弦） | 1〜48 | 10 | §0x3 GEN |
| R0x1D | ρ | `rho` | 倍音の減衰（ADD.H・撥弦） | 0.4〜3 | 1.4 | §0x3 GEN |
| R0x1E | O/E | `oe` | 奇数 ↔ 偶数倍音（ADD.H・撥弦） | -1〜1 | -0.2 | §0x3 GEN |
| R0x1F | U.n | `uni` | ユニゾン数（ADD.H） | 1〜5 | 3 | §0x3 GEN |
| R0x20 | δ | `dt` | デチューン（ADD.H） | 0〜30 ¢ | 5 | §0x3 GEN |
| R0x21 | LP.ω | `lpw` | フィルター（全体ローパス） | 60〜8000 Hz | 1200 | §0x3 GEN |
| R0x22 | LP.Q | `lpq` | レゾナンス | 0.1〜14 | 0.8 | §0x3 GEN |
| R0x23 | ΔF.¢ | `dfc` | ピッチの揺らぎ | 0〜40 ¢ | 6 | §0x4 DRF |
| R0x24 | ΔF.hz | `dfr` | 揺らぎの速さ | 0.003〜0.6 Hz | 0.04 | §0x4 DRF |
| R0x25 | ΔA | `dfa` | 音量の揺らぎ | 0〜1 | 0.35 | §0x4 DRF |
| R0x26 | W.st | `wid` | ステレオ幅（MONO.xより上の帯域） | 0〜1 | 0.7 | §0x4 DRF |
| R0x27 | Γ.hz | `ghz` | 刺激周波数 | 0.5〜60 Hz | 40 | §0x5 Γ40 |
| R0x28 | AM.d | `amd` | ドローンへのAM深さ | 0〜1 | 0 | §0x5 Γ40 |
| R0x29 | AM.w | `ams` | AM波形 | sine / pulse | sine | §0x5 Γ40 |
| R0x2A | ISO.k | `iso` | アイソクロニック音 | 0〜1 | 0 | §0x5 Γ40 |
| R0x2B | BIN.k | `bin` | バイノーラル | 0〜1 | 0 | §0x5 Γ40 |
| R0x2C | C.hz | `car` | キャリア周波数（下限120Hz） | 120〜1000 Hz | 220 | §0x5 Γ40 |
| R0x2D | C.lk | `carL` | キャリアを基音に追従 | on / off | on | §0x5 Γ40 |
| R0x2E | Φ.bpm | `pbpm` | 呼吸数 | 0〜12 /min | 0 | §0x6 Φ.RSP |
| R0x2F | Φ.in | `pin` | 吸う割合 | 0.2〜0.6 | 0.4 | §0x6 Φ.RSP |
| R0x30 | Φ.A | `pamp` | 音量の膨らみ | 0〜1 | 0.45 | §0x6 Φ.RSP |
| R0x31 | Φ.ω | `pflt` | 音色の開き | 0〜1 | 0.5 | §0x6 Φ.RSP |
| R0x32 | RV.k | `rvb` | リバーブ | 0〜1 | 0.3 | §0x7 SPC |
| R0x33 | RV.t | `rvt` | 残響時間 | 1〜20 s | 9 | §0x7 SPC |
| R0x34 | DL.k | `dly` | ディレイ | 0〜0.8 | 0.1 | §0x7 SPC |
| R0x35 | DL.t | `dlt` | ディレイ時間 | 0.05〜2 s | 0.83 | §0x7 SPC |
| R0x36 | DL.fb | `dlf` | ディレイのフィードバック | 0〜0.9 | 0.45 | §0x7 SPC |
| R0x37 | HPF.ω | `hpf` | サブソニック・ハイパス（24dB/oct） | 18〜30 Hz | 22 | §0x7 SPC |
| R0x38 | MONO.x | `monoX` | モノ化クロスオーバー（これより下はモノ） | 60〜250 Hz | 120 | §0x7 SPC |
| R0x39 | PSY.h | `psy` | 倍音エンハンサー（ミッシング・ファンダメンタル） | 0〜1 | 0.25 | §0x7 SPC |
| R0x3A | DRV | `drv` | ソフトクリップ（共通マスター段、リミッター前） | 0〜1 | 0 | §0x7 SPC |
| R0x3B | VOL | `vol` | 音量 | 0〜1 | 0.55 | §0x8 SES |
| R0x3C | F.in | `fin` | フェードイン | 0〜60 s | 8 | §0x8 SES |
| R0x3D | S.min | `ses` | セッション長 | 0〜120 min | 0 | §0x8 SES |
| R0x3E | F.out | `fout` | フェードアウト | 2〜180 s | 30 | §0x8 SES |

#### 状態（スライダー以外）

| コード | 内部キー | 平文 |
| --- | --- | --- |
| SCL | `scl` | 音階 |
| DEG | `deg` | 鳴らす度数 |
| CST | `cst` | カスタム音階（セント・比率・.scl） |

#### 選択肢

| パラメータ | コード | 値 | 平文 |
| --- | --- | --- | --- |
| `exc` | SUS | `sustain` | 持続（シュルティ箱） |
| `exc` | TNP | `tanpura` | タンプーラ（撥弦循環） |
| `exc` | HYB | `hybrid` | 両方 |
| `ams` | SIN | `sine` | 正弦（やわらかい） |
| `ams` | PLS | `pulse` | パルス（クリック的） |
| `carL` | LCK | `on` | 追従（倍音に溶かす） |
| `carL` | FIX | `off` | 固定 |

### 音色エンジン（§0x3 GEN / ENG）

各エンジンは共通マクロ Α・Β・Γ（0〜1）に別々の意味を割り当てます。

| コード | 内部キー | 平文 | Α | Β | Γ |
| --- | --- | --- | --- | --- | --- |
| ADD.H | `add` | 加算合成（PeriodicWave倍音列） | H.n×：倍音数（H.n からの増減） | ρ±：減衰（ρ からの増減） | O/E±：奇偶（O/E からの増減） |
| SIN.0 | `sin` | 純正弦＋2倍音・tanh飽和 | H2：2倍音量 | SAT：飽和 | H3：3倍音量 |
| R33S | `reese` | リース・ベース（デチューンしたノコギリ波2〜4本） | DTN：デチューン幅 | N.os：本数（2〜4） | LP：ローパスの開き |
| FM.2 | `fm2` | 2オペレーターFM | IDX：変調指数 | RAT：周波数比（0.5/1/2/3） | FB~：フィードバック風の歪み |
| F0LD | `fold` | ウェーブフォールダー（Buchla系） | FLD：折り返し量 | SYM：対称性 | LP：後段ローパス |
| UNDR | `undr` | アンダートーン分周（f/2・f/3・f/4の矩形） | ÷2：f/2の量 | ÷3：f/3の量 | ÷4：f/4の量 |
| L4DR | `ladder` | ラダー・ローパス近似（biquad4段＋tanh） | FC：カットオフ | RES：レゾナンス | DRV：ドライブ |
| PWM | `pwm` | パルス幅変調（ノコギリ2本の位相差） | PW：パルス幅 | RT：PWMの速さ | DP：PWMの深さ |
| ORG.16 | `organ` | ドローバー・オルガン 16′ 8′ 5⅓′ 4′（16′＝基音） | 16′：16′（基音） | 5⅓′：5⅓′（3倍音） | 4′：4′（4倍音） |
| KRG | `kargyraa` | カルグラ（喉歌の低い唸り） | VWL：母音 o→u→a | ÷2：分周（周期倍化）の量 | GRT：ざらつき |
| D1DJ | `didj` | ディジュリドゥ | SWP：掃引幅 | SPD：掃引の速さ | LIP：唇の詰まり |
| B0W | `bow` | 擦弦ベース（ノイズ励起＋フィードバック・コム） | PRS：弓圧（ノイズ量） | BDY：胴鳴り | DMP：減衰 |
| TAPE | `tape` | 低域ノイズ＋共鳴コム＋ワウ・フラッター | RES：共鳴 | FLT：フラッター | BND：帯域 |

### 音階

コード = 地域（＋略称）- 音数 / 調律記号

| 地域コード | 平文 |
| --- | --- |
| JPN | 日本・琉球 |
| RAG | インド・ラーガ |
| MQM | アラブ・マカーム |
| MKM | トルコ・マカーム |
| DST | ペルシア・ダストガー |
| GML | インドネシア・ガムラン |
| EAS | 東アジア |
| SEA | 東南アジア |
| AFR | アフリカ |
| EUR | ユーラシア・地中海 |
| HRM | 倍音・理論 |

| 調律記号 | 平文 |
| --- | --- |
| E12 | 12平均律 |
| J | 純正律 |
| S | 22シュルティの純正比 |
| Q | 24平均律 |
| Q~ | 24平均律近似 |
| C53 | 53コンマ（トルコ） |
| M | 実測近似 |
| P | ピタゴラス |
| E7 | 7平均律 |
| E72 | 72平均律近似 |
| H | 倍音列 |
| X | 自作 |

| コード | 内部キー | 平文 | 地域 | 調律 |
| --- | --- | --- | --- | --- |
| RYK-5/E12 | `ryukyu` | 琉球音階 | 日本・琉球 | 12-TET |
| RYK-5/J | `ryukyu-just` | 琉球音階（純正律） | 日本・琉球 | just |
| JPN.MNY-5/E12 | `minyo` | 民謡音階 | 日本・琉球 | 12-TET |
| JPN.MYK-5/E12 | `miyakobushi` | 都節音階（陰音階） | 日本・琉球 | 12-TET |
| JPN.YO-5/E12 | `yo` | 陽音階（律） | 日本・琉球 | 12-TET |
| JPN.HRJ-5/E12 | `hirajoshi` | 平調子 | 日本・琉球 | 12-TET |
| JPN.KMI-5/E12 | `kumoi` | 雲井調子 | 日本・琉球 | 12-TET |
| JPN.IWT-5/E12 | `iwato` | 岩戸調子 | 日本・琉球 | 12-TET |
| RAG.YMN-7/S | `yaman` | ヤマン（Kalyan） | インド・ラーガ | just |
| RAG.BHV-7/S | `bhairav` | バイラヴ | インド・ラーガ | just |
| RAG.BVI-7/S | `bhairavi` | バイラヴィ | インド・ラーガ | just |
| RAG.TOD-7/S | `todi` | トーディ | インド・ラーガ | just |
| RAG.MRW-6/S | `marwa` | マールワー（Pa抜き） | インド・ラーガ | just |
| RAG.BHP-5/S | `bhupali` | ブーパーリー | インド・ラーガ | just |
| RAG.MLK-5/S | `malkauns` | マールカウンス | インド・ラーガ | just |
| RAG.KFI-7/S | `kafi` | カーフィー | インド・ラーガ | just |
| MQM.RST-7/Q | `rast` | ラースト | アラブ・マカーム | 24-TET |
| MQM.BYT-7/Q | `bayati` | バヤーティー | アラブ・マカーム | 24-TET |
| MQM.HJZ-7/Q | `hijaz` | ヒジャーズ | アラブ・マカーム | 24-TET |
| MQM.SBA-7/Q | `saba` | サバー | アラブ・マカーム | 24-TET |
| MQM.SKH-7/Q | `sikah` | スィーカー | アラブ・マカーム | 24-TET |
| MQM.KRD-7/Q | `kurd` | クルド | アラブ・マカーム | 24-TET |
| MQM.NHW-7/Q | `nahawand` | ナハーワンド | アラブ・マカーム | 24-TET |
| MKM.USK-7/C53 | `ussak` | ウッシャク | トルコ・マカーム | 53-TET |
| MKM.HCZ-7/C53 | `hicaz-tr` | ヒジャーズ（AEU） | トルコ・マカーム | 53-TET |
| MKM.RST-7/C53 | `rast-tr` | ラスト（AEU） | トルコ・マカーム | 53-TET |
| DST.SHR-7/Q~ | `shur` | シュール | ペルシア・ダストガー | 24-TET近似 |
| DST.CHG-7/Q~ | `chahargah` | チャハールガー | ペルシア・ダストガー | 24-TET近似 |
| DST.HMY-7/Q~ | `homayoun` | ホマーユーン | ペルシア・ダストガー | 24-TET近似 |
| GML.SLN-5/M | `slendro` | スレンドロ | インドネシア・ガムラン | 実測近似 |
| GML.PLG-7/M | `pelog` | ペロッグ（7音） | インドネシア・ガムラン | 実測近似 |
| GML.SLS-5/M | `selisir` | スリシール（バリ） | インドネシア・ガムラン | 実測近似 |
| EAS.GNG-5/P | `gong` | 中国・宮調（ピタゴラス） | 東アジア | Pythagorean |
| EAS.SHG-5/P | `shang` | 中国・商調 | 東アジア | Pythagorean |
| EAS.JUE-5/P | `jue` | 中国・角調 | 東アジア | Pythagorean |
| EAS.ZHI-5/P | `zhi` | 中国・徴調 | 東アジア | Pythagorean |
| EAS.YU-5/P | `yu` | 中国・羽調 | 東アジア | Pythagorean |
| EAS.PYJ-5/E12 | `pyeongjo` | 韓国・平調 | 東アジア | 12-TET |
| EAS.GMJ-5/E12 | `gyemyeonjo` | 韓国・界面調 | 東アジア | 12-TET |
| SEA.TH7-7/E7 | `thai7` | タイ7平均律 | 東南アジア | 7-EDO |
| AFR.TZM-5/E12 | `tizita-maj` | エチオピア・ティジータ（長） | アフリカ | 12-TET |
| AFR.TZN-5/E12 | `tizita-min` | エチオピア・ティジータ（短） | アフリカ | 12-TET |
| AFR.BTI-5/E12 | `bati` | エチオピア・バティ | アフリカ | 12-TET |
| AFR.AMB-5/E12 | `ambassel` | エチオピア・アンバセル | アフリカ | 12-TET |
| AFR.ACH-5/E12 | `anchihoye` | エチオピア・アンチホイエ | アフリカ | 12-TET |
| AFR.MBR-7/M | `mbira` | ショナ・ムビラ（ニャマロパ近似） | アフリカ | 実測近似 |
| EUR.FRG-7/E12 | `freygish` | フライギッシュ（クレズマー） | ユーラシア・地中海 | 12-TET |
| EUR.HNG-7/E12 | `hungarian` | ハンガリー短音階 | ユーラシア・地中海 | 12-TET |
| EUR.BYZ-7/E72 | `dorian-byz` | ビザンチン第1旋法（近似） | ユーラシア・地中海 | 72-EDO近似 |
| HRM.H8-8/H | `harmonic` | 倍音列 8–16（ホーメイ / ディジュリドゥ） | 倍音・理論 | harmonic |
| HRM.JMJ-7/J | `just-major` | 純正長音階 | 倍音・理論 | just |
| HRM.P11-6/J | `partch-otonal` | パーチ 11-limit オトナリティ | 倍音・理論 | just |
| HRM.E12-12/E12 | `edo12` | 12平均律（半音階） | 倍音・理論 | 12-TET |
| USR-n/X | `custom` | カスタム（セント・比率・.scl） | 自作 | — |

### プログラム（シーン）

| コード | 内部キー | 平文 | 内容 |
| --- | --- | --- | --- |
| PRG-40G | `gamma40` | 40Hz ガンマ | 琉球純正のドローンに40Hzの振幅変調とクリック音を重ねる |
| PRG-0.1R | `resonance6` | 6回/分 共鳴呼吸 | 0.1Hzの音の満ち引きで、吸う4秒・吐く6秒へ導く |
| PRG-θ6 | `theta-rest` | シータ休息（6Hzバイノーラル） | 6Hzのバイノーラルビート。ヘッドホン必須 |
| PRG-δ2 | `delta-sleep` | デルタ入眠 | 2Hzのゆるいうねりと長いフェードアウト付き30分 |
| PRG-TNP | `tanpura-yaman` | タンプーラ・ヤマン | Pa–Sa–Sa–Saの撥弦循環。ラーガ練習の伴奏に |
| PRG-MQR | `maqam-rast` | マカーム・ラースト | 中立3度を含む和音をゆっくり揺らす |
| PRG-OMB | `ombak` | ガムランのうなり（オンバッ） | スリシールの対楽器的デチューンで揺れる金属音 |
| PRG-NKJ | `okinawa-dusk` | 今帰仁の夕凪 | 琉球音階を三味線の1オクターブ下で、波のような呼吸ガイド付き |
| PRG-B01 | `b01` | 純正弦の床（SIN.0） | E1の純正弦に2・3倍音を薄く。小型スピーカーでもPSY.hで基音が感じられる |
| PRG-B02 | `b02` | リースの地鳴り（R33S） | デチューンしたノコギリ3本。位相がゆっくりずれて地鳴りになる |
| PRG-B03 | `b03` | FMの鉄骨（FM.2） | 比率1:2のFM。指数を上げると鉄骨のような倍音 |
| PRG-B04 | `b04` | 折り返す岩盤（F0LD） | 正弦を折り返す。対称性をずらすと偶数倍音が出る |
| PRG-B05 | `b05` | 分周の階段（UNDR） | f/2・f/3の矩形を足すSubharmonicon的な分周の階段 |
| PRG-B06 | `b06` | ラダーの唸り（L4DR） | 4段ラダーの唸り。レゾナンスで声のようなピーク |
| PRG-B07 | `b07` | 呼吸するパルス（PWM） | 幅がゆっくり呼吸するパルス。0.1Hzの呼吸ガイドと合わせて |
| PRG-B08 | `b08` | 石室のペダル（ORG.16） | 16′と5⅓′を引き出したペダル。石室で鳴るオルガン |
| PRG-B09 | `b09` | カルグラ（KRG） | 周期倍化の唸りに母音uのフォルマント。トゥバの喉歌の低音 |
| PRG-B10 | `b10` | ディジュリドゥ（D1DJ） | 低いパルス列と口腔フォルマントの掃引 |
| PRG-B11 | `b11` | 擦弦コントラバス（B0W） | 弓で擦り続けるコントラバス。胴鳴りで木の響き |
| PRG-B12 | `b12` | 磁気テープの井戸（TAPE） | 低域ノイズを共鳴させ、テープのワウ・フラッターで揺らす |

### v1（KUKURU）→ v2 のキー対応

旧 `kukuru-drone:v1` の保存や version 1 のJSONは、読み込み時にこの表で変換します。基音は 20〜250Hz にオクターブ単位で折り畳み、キャリアは120Hz以上にします。

| v1 | v2 | コード |
| --- | --- | --- |
| `rootHz` | `f0` | F₀ |
| `fineCents` | `dc` | Δ¢ |
| `subLevel` | `subK` | SUB.k |
| `upperLevel` | `hiK` | SUP.k |
| `harmonics` | `hN` | H.n |
| `rolloff` | `rho` | ρ |
| `oddEven` | `oe` | O/E |
| `unison` | `uni` | U.n |
| `detune` | `dt` | δ |
| `cutoff` | `lpw` | LP.ω |
| `resonance` | `lpq` | LP.Q |
| `driftCents` | `dfc` | ΔF.¢ |
| `driftRate` | `dfr` | ΔF.hz |
| `ampDrift` | `dfa` | ΔA |
| `spread` | `wid` | W.st |
| `mode` | `exc` | EXC.m |
| `tanpuraCycle` | `cyc` | T.cyc |
| `pluckDecay` | `tau` | τ.dk |
| `jawari` | `jaw` | JWR |
| `beatHz` | `ghz` | Γ.hz |
| `amDepth` | `amd` | AM.d |
| `amShape` | `ams` | AM.w |
| `isoLevel` | `iso` | ISO.k |
| `binauralLevel` | `bin` | BIN.k |
| `carrierHz` | `car` | C.hz |
| `carrierLock` | `carL` | C.lk |
| `breathBpm` | `pbpm` | Φ.bpm |
| `inhaleRatio` | `pin` | Φ.in |
| `breathDepth` | `pamp` | Φ.A |
| `breathFilter` | `pflt` | Φ.ω |
| `reverbMix` | `rvb` | RV.k |
| `reverbDecay` | `rvt` | RV.t |
| `delayMix` | `dly` | DL.k |
| `delayTime` | `dlt` | DL.t |
| `delayFb` | `dlf` | DL.fb |
| `volume` | `vol` | VOL |
| `fadeIn` | `fin` | F.in |
| `sessionMin` | `ses` | S.min |
| `fadeOut` | `fout` | F.out |
| `scaleId` | `scl` | SCL |
| `degrees` | `deg` | DEG |
| `customCents` | `cst` | CST |

## STOMA//16

**STOMA//16** = 植物細胞の形からリズムを作る楽器（細胞幾何リズム装置）（`apps/stoma16/js/codebook.js`）

### グループ

| コード | 平文 |
| --- | --- |
| §0x1 SEG | 細胞の切り分け |
| §0x2 MAP | 形 → 時間の写像 |
| §0x3 CLK | テンポと揺れ |
| §0x4 EVO | 自動展開 |
| §0x5 FX | 質感・空間 |

### パラメータ

| レジスタ | コード | 内部キー | 平文 | 範囲 | 初期値 | グループ |
| --- | --- | --- | --- | --- | --- | --- |
| R0x10 | CH | `ch` | 見る特徴 | LUMA / CHL / WALL / RIDGE | 3 | §0x1 SEG |
| R0x11 | INV | `inv` | 壁が明るい画像 | OFF / ON | 0 | §0x1 SEG |
| R0x12 | RES | `res` | 解析解像度（長辺の画素数） | 256 / 384 / 512 | 384 | §0x1 SEG |
| R0x13 | Σ.σ | `sig` | 線を見る太さ（ヘッセ行列のスケール倍率） | 0.6〜3 × | 1 | §0x1 SEG |
| R0x14 | THR.H | `hi` | 壁の閾値（強）：ここを超える線から壁をたどる | 0.1〜0.8 | 0.36 | §0x1 SEG |
| R0x15 | THR.L | `lo` | 壁の閾値（弱）：強い線につながっていれば壁とみなす | 0.05〜0.6 | 0.2 | §0x1 SEG |
| R0x16 | GAP | `gap` | 途切れの補修（端点を伸ばす距離） | 0〜16 px | 6 | §0x1 SEG |
| R0x17 | MIN.A | `mina` | 最小面積（これより小さい区画は隣に吸収） | 4〜120 px² | 14 | §0x1 SEG |
| R0x18 | FILL | `fill` | 内容物の埋め戻し（核・葉緑体の輪を消す大きさ） | 0〜6 | 2.6 | §0x1 SEG |
| R0x19 | MRG | `merge` | 弱い境界の併合 | 0〜0.9 | 0.55 | §0x1 SEG |
| R0x1A | LIN | `lin` | 線の連続性（まっすぐ続く壁だけを残す長さ） | 0〜20 px | 0 | §0x1 SEG |
| R0x1B | EDGE | `edge` | 縁の切れた細胞 | INCL / EXCL | 1 | §0x1 SEG |
| R0x1C | MODE | `mode` | 走査方式 | SWEEP / RASTER / WALK | SWEEP | §0x2 MAP |
| R0x1D | BARS | `bars` | ループ小節数 | 1 / 2 / 4 | 2 | §0x2 MAP |
| R0x1E | Q | `q` | 量子化の強さ | 0〜1 | 0.85 | §0x2 MAP |
| R0x1F | DENS | `dens` | 打点の密度 | 0.05〜1 | 0.55 | §0x2 MAP |
| R0x20 | ANC | `anchor` | アンカー（拍の頭に必ず置くトラック） | OFF / ON | 1 | §0x2 MAP |
| R0x21 | POLY | `poly` | ポリメトリック（トラックごとのループ長） | OFF / MAN / AUTO | OFF | §0x2 MAP |
| R0x22 | TIS.k | `clsw` | 組織クラスを振り分けに効かせる強さ | 0〜1 | 0.5 | §0x2 MAP |
| R0x23 | ANG | `ang` | 細胞の向きの写像先 | OFF / PAN / TONE / BOTH | OFF | §0x2 MAP |
| R0x24 | BPM | `bpm` | テンポ | 60〜180 BPM | 118 | §0x3 CLK |
| R0x25 | F₀ | `f0` | 基音（SUB・低音・サブドローンの高さ。GARDEN BUS で共有） | 27.5〜110 Hz | 41.2 | §0x3 CLK |
| R0x26 | SWG | `swg` | MPC スウィング（50%＝なし） | 0.5〜0.75 % | 0.5 | §0x3 CLK |
| R0x27 | HUM | `hum` | 人の手の揺れ（スタイルの揺れの倍率） | 0〜2 × | 1 | §0x3 CLK |
| R0x28 | VOL | `vol` | 全体音量 | 0〜1 | 0.7 | §0x3 CLK |
| R0x29 | EVO | `evo` | 自動展開 | OFF / ON | 0 | §0x4 EVO |
| R0x2A | FORM | `form` | 構成の型 | ARC / DUB / MIN / DRF / TISSUE | ARC | §0x4 EVO |
| R0x2B | PHR | `phr` | 1区間のループ数 | 1 / 2 / 4 / 8 | 2 | §0x4 EVO |
| R0x2C | MUT | `rate` | 変化の量 | 0〜1 | 0.5 | §0x4 EVO |
| R0x2D | SEED | `seed` | 展開の種（0＝毎回ちがう） | 0〜9999 | 0 | §0x4 EVO |
| R0x2E | CYC | `cyc` | STYLE CYCLE（区間ごとにスタイルを段階的に移す） | OFF / ON | 0 | §0x4 EVO |
| R0x2F | DLY | `dly` | ダブディレイ量 | 0〜0.8 | 0.42 | §0x5 FX |
| R0x30 | D.FB | `dfb` | ディレイ帰還 | 0〜0.92 | 0.58 | §0x5 FX |
| R0x31 | SPR | `spr` | スプリング残響 | 0〜1 | 0.35 | §0x5 FX |
| R0x32 | S.CH | `sc` | サイドチェイン（キックで他を沈める） | 0〜1 | 0 | §0x5 FX |
| R0x33 | WOW | `wow` | テープのワウ | 0〜1 | 0 | §0x5 FX |
| R0x34 | CRSH | `crsh` | ビット深度（0=オフ） | 0〜14 bit | 0 | §0x5 FX |
| R0x35 | LP.HZ | `lofi` | ローファイLP | 2000〜20000 Hz | 14000 | §0x5 FX |
| R0x36 | CRKL | `crkl` | チリの頻度 | 0〜30 /s | 0 | §0x5 FX |
| R0x37 | HISS | `hiss` | ヒス量 | 0〜0.05 | 0.004 | §0x5 FX |

#### 選択肢

| パラメータ | コード | 値 | 平文 |
| --- | --- | --- | --- |
| `ch` | LUMA | `0` | 明るさ（暗い壁） |
| `ch` | CHL | `1` | 葉緑体・染色の密度の谷 |
| `ch` | WALL | `2` | 透明な細胞壁 |
| `ch` | RIDGE | `3` | 線状の壁（Frangi） |
| `inv` | OFF | `0` | 暗い壁 |
| `inv` | ON | `1` | 明るい壁 |
| `res` | 256 | `256` | 粗い・速い |
| `res` | 384 | `384` | 標準 |
| `res` | 512 | `512` | 細かい・遅い |
| `edge` | INCL | `0` | 含める |
| `edge` | EXCL | `1` | 除外 |
| `mode` | SWEEP | `SWEEP` | 中心から回転走査（環ごとに小節） |
| `mode` | RASTER | `RASTER` | 左→右の読み取り |
| `mode` | WALK | `WALK` | 隣の細胞を辿る |
| `bars` | 1 | `1` | 1小節 |
| `bars` | 2 | `2` | 2小節 |
| `bars` | 4 | `4` | 4小節 |
| `anchor` | OFF | `0` | 細胞だけで決める |
| `anchor` | ON | `1` | スタイルのアンカーを置く |
| `poly` | OFF | `OFF` | 全トラック同じ長さ |
| `poly` | MAN | `MAN` | トラックごとに選ぶ（16/12/10/7） |
| `poly` | AUTO | `AUTO` | 細胞の周長から導く |
| `ang` | OFF | `OFF` | 使わない |
| `ang` | PAN | `PAN` | 向き → 定位 |
| `ang` | TONE | `TONE` | 向き → 音色（マクロ2） |
| `ang` | BOTH | `BOTH` | 定位と音色の両方 |
| `evo` | OFF | `0` | 固定ループ |
| `evo` | ON | `1` | 展開する |
| `form` | ARC | `ARC` | 導入→盛り上がり→頂点→ブレイク→頂点→終息 |
| `form` | DUB | `DUB` | 落とす⇄残響だけ |
| `form` | MIN | `MIN` | 1トラックずつ出入り |
| `form` | DRF | `DRF` | 細胞を漂流し続ける |
| `form` | TISSUE | `TISSUE` | 組織を外側から内側へ（皮層→内皮→中心柱） |
| `phr` | 1 | `1` | 1ループ |
| `phr` | 2 | `2` | 2ループ |
| `phr` | 4 | `4` | 4ループ |
| `phr` | 8 | `8` | 8ループ |
| `cyc` | OFF | `0` | スタイル固定 |
| `cyc` | ON | `1` | 区間ごとに次のスタイルへ移す |

### スタイル

各作家の手法を合成音で再現するスタディです（サンプルは使いません）。

| コード | 参照 | 平文 |
| --- | --- | --- |
| REF.TWL | Azu Tiwaline | ダブ×サハラの枠太鼓。3:4 のヘミオラが回転し、スプリング残響とサブドローン |
| REF.IKD | Ryoji Ikeda | 純正弦のバーストとノイズとインパルス。64分割の完全量子化、細胞データを数値行列とバーコードで表示 |
| REF.BDM | Budamunk | MPC スウィング、16段階のベロシティ、合成ループのチョップ、キックでのサイドチェイン |
| REF.JLN | Jan Jelinek | クリック＆カット。粒の長さ＝細胞の周長のグラニュラー、テープのワウ、64分のクリック層 |

### トラック

| 役割コード | 平文 | 細胞の形 | TWL | IKD | BDM | JLN |
| --- | --- | --- | --- | --- | --- | --- |
| K | キック系 | 大きく丸い細胞 | K.DUB：ダブキック | K.SUB：50Hz正弦パルス | K.DST：ダスティ・キック | K.SFT：ソフトキック |
| T | 低音・トーン系 | 大きく細長い細胞 | T.DUM：ベンディール低音 | T.SIN：純正弦バースト | T.CHP：合成ループのチョップ | T.GRN：和音のグラニュラー（粒の長さ＝周長） |
| S | スネア・響き系 | 六角形的な中くらいの細胞 | S.TEK：ベンディール響き線 | S.WHT：ホワイトノイズ・ゲート | S.SNR：スネア＋クラップ | S.FLT：フィルター・ノイズ |
| H | ハット・ティック系 | 小さい細胞（孔辺細胞など） | H.RIQ：リク・シェイカー | H.HF：高域正弦ティック | H.CHH：クローズドハット | H.MCK：64分のマイクロクリック |
| C | クリック・打撃系 | 極端に細長い細胞 | C.STK：スティック | C.IMP：単一サンプル・インパルス | C.RIM：リムショット | C.CRK：チリ |
| Z | ノイズ・質感系 | 明暗の外れた細胞（内容物） | Z.THR：ダブ投げノイズ | Z.BIT：1ビット・ノイズ | Z.VNL：シェイカー | Z.HST：ヒスのスタッター |

### 16音色とマクロ

| コード | 平文 | M1 | M2 |
| --- | --- | --- | --- |
| NAT | スタイル標準の音 | TON：音色の明るさ | LEN：長さ |
| K808 | 808キック：長い正弦と歪み | DST：歪み | PCH：ピッチの落ち幅 |
| FMK | FMキック：金属的なアタック | IDX：変調の強さ | CLK：アタックの硬さ |
| MBR | 膜鳴：枠太鼓・タブラの倍音比 | STR：打面の張り（音程） | RNG：胴鳴りの長さ |
| WOD | 木質打音：木魚・木琴 | HRD：硬さ（高い倍音） | PCH：音程 |
| GLS | ガラス・ベル：非整数倍音の長い余韻 | INH：倍音のずれ | TAIL：余韻 |
| KLM | カリンバ：五音音階の金属舌 | BUZ：さわりのうなり | OCT：オクターブ |
| MTL | 金属：808シンバル式の6矩形波 | OPN：開き（減衰） | TON：帯域 |
| SNP | クラップ：3連の破裂と尾 | SPR：破裂の間隔 | TAIL：尾の長さ |
| SUB | サブベース：上から滑り込む低音 | GLD：滑り込みの深さ | DRV：歪み |
| GRN | 和音グレイン：和音の一片 | LEN：粒の長さ | PIT：再生速度 |
| VOX | 息・母音：細長さで母音が変わる | VWL：母音 | BRT：息の量 |
| DRP | 水滴：上昇する正弦 | RIS：上昇の幅 | LEN：長さ |
| LEF | 葉擦れ：微細なノイズの粒 | DEN：粒の密度 | BND：帯域 |
| IMP | インパルス：1サンプルのクリック | FLT：フィルター | RNG：共鳴 |
| BIT | 1ビット・ノイズ | LEN：長さ | RAT：ビットの粗さ |

### EVO の区間

| コード | 平文 |
| --- | --- |
| §INT | 導入 |
| §BLD | 盛り上がり（BUILD） |
| §PK | 頂点 |
| §BRK | ブレイク（ダブディレイの帰還を自動で上げ下げ） |
| §DRP | ドロップ |
| §ECH | 残響だけ |
| §OUT | 終息 |
| §DRF | 漂流 |
| §ADD | 加算（1トラックずつ出入り） |
| §RNG | 環（TISSUE：外側から n 番目の層） |

### 組織クラス

コード = `TIS.<色>-<大きさ>`（例 `TIS.R-sm` ＝赤・小さい）。同じ名前が重なると末尾に番号が付きます。

| 色 | 平文 |
| --- | --- |
| R | 赤 |
| Y | 黄 |
| G | 緑 |
| C | 青緑 |
| B | 青 |
| V | 紫 |
| W | 白 |
| K | 黒 |
| N | 灰 |

| 大きさ | 平文 |
| --- | --- |
| sm | 小さい |
| md | 中くらい |
| lg | 大きい |

### 標本

| コード | 内部キー | 平文 |
| --- | --- | --- |
| QRC.SUBR | `cork` | コルク（Hooke 1665の蜂の巣状組織） |
| ALL.CEPA | `onion` | タマネギ表皮（細長い煉瓦積み・核あり） |
| BRY.FOL | `moss` | 蘚類の葉（菱形細胞・葉緑体・中肋） |
| EPD.STM | `stoma` | 葉の表皮（ジグソー状の細胞と気孔） |
| LOC.ROOT | `local-root` | LOCAL：根の横断面（fixtures/root_xs.jpg） |
| LOC.MOSS | `local-moss` | LOCAL：苔の葉（fixtures/moss_leaf.jpg） |
| USR.IMG | `user` | 読み込んだ画像 |
| LIV.CAM | `live` | カメラ・USB顕微鏡のライブ入力 |

### 統計の表示

| コード | 平文 |
| --- | --- |
| N.CELL | 細胞数（縁に触れない細胞） |
| ⟨n⟩ | 平均隣接数（平面分割の理論値≈6） |
| HEX | 六角形（隣接6）の割合 |
| LEWIS r | ルイスの法則：面積と隣接数の相関 |
| A–W a | アボフ–ウィアの法則の係数 a（n·m(n) = (6−a)n + 6a + μ₂） |
| ⟨A⟩ | 平均面積（基準座標 px²） |
| ⟨CVX⟩ | 平均の凸包率（ジグソー状ほど小さい） |
| EVD | evidence：境界上の壁らしさ ÷ 全体平均 |
| TIS | 組織クラスの構成比 |
| EVT | 1ループの打点数 |

