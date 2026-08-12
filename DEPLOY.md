# 馬柱ビューアーをサイトにする手順

> shindan-appと同じVercelを使う想定。GUIだけで完結する。

---

## 全体の流れ

```
① GitHubにこのフォルダをアップロード
② Vercelでそのリポジトリを取り込む
③ Vercelの環境変数にAPIキーを設定
④ 完成(URLが発行される)
```

所要時間の目安:15〜20分(shindan-appのデプロイ経験があれば、ほぼ同じ手順)。

---

## ① GitHubにアップロード

1. GitHubで新しいリポジトリを作る(例:`umabashira-viewer`)
2. このフォルダ一式(`package.json` や `src/` を含む)をアップロードする
   - GitHub Desktopや、GitHubのWeb画面の「Add file → Upload files」で
     ドラッグ&ドロップでもよい

## ② Vercelで取り込む

1. Vercelのダッシュボードで「Add New → Project」
2. ①で作ったGitHubリポジトリを選択
3. フレームワークは自動で「Vite」と検出されるはず。そのまま進める
4. **この時点ではまだ「Deploy」は押さない**(③のキー設定を先にやる)

## ③ 環境変数にAPIキーを設定

これが一番大事な工程。**ここを飛ばすと動かない。**

1. Vercelのプロジェクト設定画面で「Environment Variables」を開く
2. 以下を追加する

```
名前:ANTHROPIC_API_KEY
値:(Anthropic ConsoleのAPIキー。sk-ant-... で始まる文字列)
```

3. APIキーをまだ持っていない場合、
   [console.anthropic.com](https://console.anthropic.com) で発行する
   (shindan-appでStripe/Supabaseのキーを登録したのと同じ感覚)
4. 設定できたら「Deploy」を押す

## ④ 完成

数分でビルドが終わり、`umabashira-viewer.vercel.app` のようなURLが発行される。
これをそのまま外注先の方に共有すればよい。

---

## 触る人を限定したい場合(任意)

今の設定だと、URLを知っている人なら誰でもアクセスできる。
外注先の方1人だけに絞りたい場合、Vercelの「Password Protection」機能
(プロジェクト設定内)で、簡単なパスワードを設定できる。
プランによって使える/使えないがあるので、Vercel側の案内を確認すること。

---

## 費用について

- Vercelのホスティング自体は、この規模なら無料枠で足りるはず
- 実際にかかるのは**Anthropic APIの利用料のみ**。1回の「取得する」ボタンで
  Claudeが検索を何度か行うため、レース1回あたり数十円程度が目安
  (正確な金額はConsoleの使用量ページで確認できる)
- 使いすぎが心配な場合、Anthropic Consoleで**利用上限額**を設定できるので、
  最初は低めに設定しておくと安心

---

## もし途中でエラーが出たら

- Vercelの「Deployments」タブから、失敗したビルドのログが見られる
- 大抵は③のAPIキー設定漏れか、キーの入力ミスが原因
- shindan-appのVercel設定と同じアカウントを使っていれば、
  画面の勝手は同じはず
