# こどもクローゼット（wardrobe-kids）

子ども2人の服を管理するアプリ。サイズアウト管理・お下がりの引き継ぎ対応。

## GitHubへのアップロード手順（ブラウザだけでOK）

1. https://github.com/suu30/wardrobe-kids を開く
2. 既存の空の `package.json` を削除（ファイルを開く → 右上の「…」→ Delete file → Commit changes）
3. リポジトリトップで「Add file」→「Upload files」
4. このzipを解凍した中身（package.json, index.html, vite.config.js, .gitignore, README.md, srcフォルダ）を全部ドラッグ&ドロップ
5. 「Commit changes」をクリック

## Vercelでのデプロイ手順

1. https://vercel.com にGitHubアカウントでログイン
2. 「Add New...」→「Project」→ wardrobe-kids リポジトリを「Import」
3. Framework Preset が「Vite」と自動認識されるのを確認（設定変更は不要）
4. 「Deploy」をクリック → 1〜2分でURLが発行される

以降はGitHubにファイルを更新するたび自動で再デプロイされます。

## データについて

- データは端末のブラウザ（localStorage）に保存されます
- スマホで使う場合はデプロイ後のURLをスマホで開き、ホーム画面に追加すると便利です
