# アイプリ イントロクイズ ⚡スピードチャレンジ

おねがいアイプリ・ひみつのアイプリの公式 CGライブ（YouTube）で遊ぶ、非公式のイントロクイズです。
イントロが流れたら8択から曲名をタップ。**音が鳴ってから答えるまでの速さ**で点数が決まります。

## あそびかた

- 出題する曲（おねがいアイプリ CGライブ／ひみつのアイプリ CGライブ／ゲームMV／OP・ED）と問題数（5・10・15問）を選んでスタート
- 正解の点数は 0秒で1000点 → 15秒で100点。連続正解でコンボボーナス（最大 +250）
- 結果に応じて称号（イントロ見習い 〜 伝説のイントロクイーン）
- PC はキーボードでも遊べます（`1`〜`8` で解答、`Enter`／`Space` で次へ）

## しくみ

```
aipri-channel の catalog.json ──(GitHub Actions 毎日)──▶ scripts/build-quiz-data.ts ──▶ public/data/quiz.json
                                                              ▲
                                       quiz.config.json（出題セット）＋ quiz-overrides.json（曲ごとの調整）
```

- **出題データ**：[aipri-channel](https://github.com/IzminGit/aipri-channel) が YouTube Data API で集めている `catalog.json` を読み、動画タイトルから曲名と歌唱キャラを取り出します。埋め込み不可の動画は除外済みなので API キーは不要です
- **曲単位で出題**：ソロ版・デュオ版など同じ曲の動画は1曲にまとめ、出題のたびにどれか1本を流します
- **ダミー選択肢**：CGライブは映像でキャラが分かるので、**同じキャラが歌う別の曲**を優先してダミーに混ぜます（キャラは分かっても、曲名はイントロを聴かないと当てられない）
- **公平な計測**：タップした瞬間ではなく、動画が実際に再生され始めた瞬間から計測します。途中でバッファリングした時間は差し引きます
- **同じ問題の再現**：問題はシード付き乱数で作るので、同じ URL（出題セット・問題数・シード）なら同じ問題になります
- **YouTube の規約**：プレーヤーを覆ったり、音声だけを取り出したりはせず、映像は常に表示しています

## イントロ開始位置の調整

CGライブは曲の前に演出が入ることがあるため、動画ごとにイントロ開始秒を調整できます。

1. アプリのフッターにある「イントロ開始位置の調整」（`#/tune`）を開く
2. 「▶ 試聴」で確認し、秒数を直す（または再生しながら「⏱ 今の位置」）
   - ここでの変更は**その端末だけ**にすぐ反映されます
3. 「変更を書き出す」で出た JSON を `quiz-overrides.json` の `"videos"` に追記してコミット
   - push すると GitHub Actions が `quiz.json` を作り直し、全員に反映されます

`quiz-overrides.json` では次の上書きができます。

```json
{
  "videos": {
    "kuleEK8aVxM": { "introStart": 4.5 },
    "yRmssafjXf0": { "exclude": true },
    "xxxxxxxxxxx": { "song": "曲名を手で指定" }
  }
}
```

セットごとの既定値は `quiz.config.json` の `defaultIntroStart` で変えられます。

## 開発

```sh
npm install
npm run dev          # 開発サーバー
npm test             # テスト
npm run build-data   # 出題データを作り直す（CATALOG_SOURCE=ファイルパス でローカルの catalog.json も可）
npm run build        # 本番ビルド
```

Vite + React + TypeScript。Vercel にリポジトリをつなげば `vercel.json` の設定でそのままデプロイできます。

## 注意

非公式のファンメイドです。動画の権利は各権利者に帰属し、再生はすべて YouTube の公式チャンネルの埋め込みプレーヤーで行っています。
