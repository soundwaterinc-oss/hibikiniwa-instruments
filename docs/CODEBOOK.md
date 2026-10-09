# CODEBOOK — HYPOGEUM // KKR-40

> このファイルは `node scripts/codebook.mjs` で `js/codebook.js` から自動生成しています。手で編集しないでください。

**HYPOGEUM // KKR-40** = 地下の石室・低域ドローン楽器（旧 KUKURU）

UIでは [DECODE] を押すと、すべてのラベルにここの平文が併記されます。各コントロールの `title` と `aria-label` には常に平文が入っています。安全注意だけは暗号化していません。

## グループ

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

## パラメータ

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
| R0x3A | DRV | `drv` | ソフトクリップ（リミッター前） | 0〜1 | 0 | §0x7 SPC |
| R0x3B | VOL | `vol` | 音量 | 0〜1 | 0.55 | §0x8 SES |
| R0x3C | F.in | `fin` | フェードイン | 0〜60 s | 8 | §0x8 SES |
| R0x3D | S.min | `ses` | セッション長 | 0〜120 min | 0 | §0x8 SES |
| R0x3E | F.out | `fout` | フェードアウト | 2〜180 s | 30 | §0x8 SES |

### 状態（スライダー以外）

| コード | 内部キー | 平文 |
| --- | --- | --- |
| SCL | `scl` | 音階 |
| DEG | `deg` | 鳴らす度数 |
| CST | `cst` | カスタム音階（セント・比率・.scl） |

### 選択肢

| パラメータ | コード | 値 | 平文 |
| --- | --- | --- | --- |
| `exc` | SUS | `sustain` | 持続（シュルティ箱） |
| `exc` | TNP | `tanpura` | タンプーラ（撥弦循環） |
| `exc` | HYB | `hybrid` | 両方 |
| `ams` | SIN | `sine` | 正弦（やわらかい） |
| `ams` | PLS | `pulse` | パルス（クリック的） |
| `carL` | LCK | `on` | 追従（倍音に溶かす） |
| `carL` | FIX | `off` | 固定 |

## 音色エンジン（§0x3 GEN / ENG）

各エンジンは共通マクロ Α・Β・Γ（0〜1）に別々の意味を割り当てます。

| コード | 内部キー | 平文 | Α | Β | Γ |
| --- | --- | --- | --- | --- | --- |
| ADD.H | `add` | 加算合成（PeriodicWave倍音列） | BRT：明るさ（倍音の傾き） | SPR：ユニゾンの広がり | SAT：飽和 |
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

## 音階

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

## プログラム（シーン）

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

## v1（KUKURU）→ v2 のキー対応

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
