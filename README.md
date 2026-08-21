# 習慣トラッカー

毎日の習慣をチェックして、連続日数と達成率を記録するモバイル向けの PWA。
スマホのブラウザで開いてホーム画面に追加すると、アドレスバーのないアプリとして起動でき、オフラインでも動く。

**データはこの端末のブラウザ内（localStorage）だけに保存され、サーバーには何も送信されない。**
ブラウザのサイトデータを消すと記録も消えるので、設定タブの「バックアップを書き出す」でときどき JSON を保存しておくとよい。

## 機能

| タブ | できること |
| --- | --- |
| 今日 | 今日が対象の習慣を一覧表示。カードをタップで達成／解除、長押しで編集。上部に達成率リング |
| カレンダー | 習慣ごとの月表示。過去の日をタップして後から記録できる（未来日は不可） |
| 統計 | 現在の連続日数・最長連続・直近30日の達成率と、直近14日のミニ棒グラフ |
| 設定 | 習慣の並び替え／編集、テーマ（端末・ライト・ダーク）、週の開始曜日、バックアップの書き出し／読み込み、全削除 |

習慣の頻度は「毎日」と「曜日を選ぶ」の2種類。曜日指定の場合、対象外の曜日は連続日数を切らずに読み飛ばす。
また、今日がまだ未達成でも「その日はまだ終わっていない」ものとして連鎖は切らない。

## 構成

ビルド不要・依存パッケージゼロ。素の ES modules と CSS だけなので、
静的ファイルをそのまま置けばどこでも動く。

```
index.html              単一ページ。4つのビューを内包
manifest.webmanifest    PWA マニフェスト
sw.js                   Service Worker（プリキャッシュ＋更新通知）
css/style.css           モバイルファースト。ライト／ダーク対応
js/
  app.js                起動・タブ切り替え・再描画
  store.js              localStorage への永続化と状態変更 API
  habits.js             ドメインロジック（純関数）
  dates.js              ローカル日付ユーティリティ（純関数）
  ui.js                 DOM 組み立て、ボトムシート、トースト
  views/                today / calendar / stats / settings / editor
icons/                  PNG アイコン（scripts/make-icons.mjs で生成）
scripts/
  make-icons.mjs        Node 標準の zlib だけで PNG を生成
  serve.mjs             動作確認用の静的サーバー
test/                   node:test によるユニットテスト
```

日付はすべてローカルタイムゾーンの `YYYY-MM-DD` 文字列で扱う。
`toISOString()` は UTC に寄って日付が1日ずれるため使わず、`dates.js` の `toKey()` に一本化している。

## 開発

```bash
node scripts/serve.mjs
```

`http://localhost:4180/` で開く。同じ Wi-Fi のスマホからも起動時に表示される LAN の URL で見られる
（ただし Service Worker は https か localhost でしか動かないので、LAN 経由で確認できるのは UI だけ）。

テスト:

```bash
node --test "test/**/*.test.mjs"
```

アイコンを作り直す:

```bash
node scripts/make-icons.mjs
```

### Service Worker の注意

開発中にファイルを変更しても、Service Worker がキャッシュを返すため反映されないことがある。
その場合は DevTools のコンソールで次を実行してからリロードする。

```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
```

**アプリを更新して公開するときは `sw.js` の `VERSION` を上げる**（`v1` → `v2` など）。
これを忘れると、すでにインストール済みの端末に新しいファイルが届かない。
版を上げると、次回起動時に「新しいバージョンがあります」というトーストが出る。

## GitHub Pages で公開する

アセットの参照はすべて `./` 相対にしてあるので、`https://<ユーザー名>.github.io/<リポジトリ名>/`
のようなサブパス配下でもそのまま動く。

1. GitHub で空のリポジトリを作る（README などは追加しない）
2. リモートを登録して push する

   ```bash
   git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
   git push -u origin main
   ```

3. リポジトリの **Settings → Pages** で、Source を「Deploy from a branch」、
   Branch を `main` / `/ (root)` にして保存
4. 数分後に `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される

`gh` CLI（`brew install gh` → `gh auth login`）を入れていれば、1〜3 はまとめてできる。

```bash
gh repo create <リポジトリ名> --public --source=. --push
gh api -X POST repos/{owner}/{repo}/pages -f build_type=legacy -F 'source[branch]=main' -F 'source[path]=/'
```

### スマホのホーム画面に追加する

- **iOS (Safari)**: 公開 URL を開く → 共有ボタン → 「ホーム画面に追加」
- **Android (Chrome)**: 公開 URL を開く → メニュー → 「アプリをインストール」

追加後は機内モードにして起動すると、オフラインで動くことを確認できる。
