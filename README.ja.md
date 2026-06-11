# VRM Game Starter

**[English](README.md) | 日本語**

[VRM](https://vrm.dev/)アバターと[Three.js](https://threejs.org/)（WebGPU）で3Dゲームを作り始めるためのスターターテンプレートです。cloneしてコマンドを1つ実行するだけで、キャラクターが歩き回れるレベルが動きます。そこから自分のゲームに育ててください。

物理エンジン不要・フレームワーク非依存。素のTypeScript + Three.jsに、[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)による高速で三角形精度の衝突判定を組み合わせています。

## 特徴

- 🧍 **VRMアバター** — VRM 0.x / VRM 1.0の両方を読み込み可能。ウィンドウへのドラッグ＆ドロップでアバターを即座に差し替え
- 🏃 **アニメーションリターゲット** — 共通のアニメーションライブラリ（待機 / 歩行 / 走行 / ジャンプ / パンチ）を任意のヒューマノイドVRMに適用
- 🦶 **Foot IK** — 坂や段差に足が吸い付く
- 🎮 **キャラクターコントローラー** — 物理エンジン不要のフローティングカプセル方式。[BVHEcctrl](https://github.com/pmndrs/BVHEcctrl)コアをベースに、キーボード / ゲームパッド / タッチ操作に対応
- 🗺️ **ゲーム内レベルエディタ** — ブラウザ上でオブジェクトの移動・回転・拡縮ができ、localStorageへの保存やJSONエクスポートが可能
- 🌅 **WebGPUレンダリング** — SSGI、アンビエントオクルージョン、ブルーム、カスケードシャドウマップ、動的な空
- 🔍 **インスペクタ** — レンダリング・影・空・カメラ・操作パラメータをリアルタイムに調整
- ✅ **テスト済み** — IK、カメラ、リターゲット契約、レベル状態などゲームプレイの要となる処理をユニットテストでカバー

## 必要環境

- [Node.js](https://nodejs.org/) 20以上
- WebGPU対応ブラウザ（最新のChromeまたはEdge推奨）

## クイックスタート

```bash
# GitHubの「Use this template」を使うか、cloneしてください:
git clone https://github.com/norio/vrm-game-starter.git
cd vrm-game-starter

npm install
npm run dev
```

表示されたURL（通常は `http://localhost:5173`）を開くと、すぐに歩き回れます。

## 自分のアバターを使う

方法は2つあります:

1. **ドラッグ＆ドロップ** — 任意の `.vrm` ファイルをウィンドウにドロップ。VRM 0.x / VRM 1.0どちらも動きます。
2. **デフォルトを差し替え** — [src/assets/sample.vrm](src/assets/sample.vrm) を自分のモデルで上書き（ファイル名を変える場合は [AnimatedCharacterModel.ts](src/character/AnimatedCharacterModel.ts) のURLも更新）。

アバターは[VRoid Studio](https://vroid.com/studio)で無料で作れます。

## 操作方法

| 入力 | アクション |
| --- | --- |
| `W` `A` `S` `D` / 矢印キー | 移動 |
| `Shift` | 走る |
| `Space` | ジャンプ |
| 左クリック | パンチ |
| マウスドラッグ / ホイール | カメラ回転・ズーム |
| ゲームパッド | 左スティック移動、右スティックカメラ、ボタンでジャンプ/パンチ/走行 |
| タッチ | 仮想ジョイスティック＋ボタン（自動表示） |

画面右上の**インスペクタ**パネルでレンダリングやゲームプレイのパラメータを調整できます。**Level → Edit**でゲーム内レベルエディタが起動します。

## プロジェクト構成

```
index.html            エントリHTML（canvas、HUD、ドロップオーバーレイ）
src/
  main.ts             アプリの起動処理
  app/                ゲーム本体
    App.ts            全体の組み立て役 — まずここから読むのがおすすめ
    Controller.ts     プレイヤー入力とキャラクターコントローラー設定
    CameraRig.ts      三人称追従カメラ（衝突判定つき）
    Level.ts          レベルの組み立て・コライダー・保存/読込
    LevelLayout.ts    レベルのジオメトリ — マップを作るならここを編集
    LevelGimmicks.ts  動く床などのキネマティックオブジェクト
    LevelEditor.ts    ゲーム内トランスフォームエディタ
    Inspector.ts      リアルタイムパラメータパネル
  character/          VRM読み込み・アニメーションリターゲット・Foot IK
  render/             WebGPUレンダーグラフ（SSGI / AO / ブルーム）
  scene/              空とカスケードシャドウマップ
  lib/ecctrl/         キャラクターコントローラーコア（BVHEcctrlベース）
  assets/             サンプルVRMとアニメーションライブラリ
test/                 ユニットテスト（vitest）
```

## カスタマイズの入り口

| やりたいこと | 編集する場所 |
| --- | --- |
| 歩行/走行速度・ジャンプ力を変える | [src/app/Controller.ts](src/app/Controller.ts)（`createEcctrl`のオプション） |
| 自分のレベルを作る | [src/app/LevelLayout.ts](src/app/LevelLayout.ts) — またはゲーム内エディタで編集してJSONエクスポート |
| 動く床を追加する | [src/app/LevelGimmicks.ts](src/app/LevelGimmicks.ts) |
| カメラの挙動を変える | [src/app/CameraRig.ts](src/app/CameraRig.ts) |
| アニメーション/アクションを追加する | [src/assets/AnimationLibrary.glb](src/assets/AnimationLibrary.glb) + [src/character/AnimationContract.ts](src/character/AnimationContract.ts) |
| ライティング・空・ポストエフェクトを調整する | [src/scene/](src/scene)、[src/render/](src/render) — インスペクタでのライブ調整も可能 |

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | `dist/` へ本番ビルド |
| `npm run preview` | 本番ビルドのプレビュー |
| `npm run typecheck` | TypeScript型チェック |
| `npm test` | ユニットテスト実行 |

## 学習リソース

- [Three.js manual](https://threejs.org/manual/) — シーン・カメラ・マテリアルの基礎
- [VRMドキュメント](https://vrm.dev/) — VRMアバターフォーマットの公式情報
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — 本テンプレートで使用しているVRMローダー
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) — 衝突判定の高速化構造

## クレジット

- キャラクターコントローラーコアは [Erdong Chen (Andrew)](https://github.com/ErdongChen-Andrew) 氏の [BVHEcctrl](https://github.com/pmndrs/BVHEcctrl)（MIT）をベースにしています
- アニメーションは [Quaternius](https://x.com/quaternius) 氏の [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) を使用
- サンプルアバターは [VRoid Studio](https://vroid.com/) で作成されたVRoidサンプルモデル（ライセンスにより再配布許可）

## ライセンス

ソースコードは[MIT](LICENSE)ライセンスです。

同梱アセットはMITの対象外で、それぞれ独自のライセンスに従います:

- `src/assets/sample.vrm`、`src/assets/sample2.vrm` — VRoidサンプルモデル。VRMメタデータに宣言された条件のもとで再配布
- `src/assets/AnimationLibrary.glb` — [Quaternius](https://x.com/quaternius)氏の[Universal Animation Library](https://quaternius.itch.io/universal-animation-library)を元に作成

自分のゲームとして公開する際は、各アセットのライセンスを確認のうえ差し替え・利用してください。
