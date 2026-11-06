# アジト防衛演習室 — プロジェクト固有のルール

共通の方針は `C:/Users/kkth8/source/CodexProjects/AGENTS.md`(Codex では `~/.codex/AGENTS.md`)に従う。ここにはこのプロジェクト固有のことだけを書く。

- ユーザーはアイデアを伝えるだけにしたい。技術選定・実装・検証・コミットはAIが進める。質問するのは、ユーザーにしか決められないこと(公開範囲、有料サービス、アカウント、実機や見た目の最終確認)だけにする。
- README.md の「現在の状態」と「次のチャットへの引き継ぎ」を作業のたびに更新し、Codex と Claude のどちらでも続きから再開できるようにする。
- 検証は `scripts/codex-verify.ps1` にまとめる。技術を決めたらビルド・テスト・lint を実装し、下の「コマンド」節と `.claude/settings.json` にも反映する。
- コマンド・構成・注意点が変わったら、このファイルも同じ作業の中で更新する。
- 秘密情報は `.env` に置いてコミットしない。必要な変数名は値なしで `.env.example` に書く。

## 必要な道具

- Node.js 26 / npm 12、Next.js 16、React 19、TypeScript、Tailwind CSS 4、Drizzle ORM、libSQL、Vitest
- 外部公開・Cloudflare・D1・実アプリの環境変数は禁止。`127.0.0.1` と `data/ajito-security-lab.db` だけを使う。

## コマンド

- 一括検証: `pwsh -NoProfile -File scripts/codex-verify.ps1`
- 開発: `npm run dev` (http://127.0.0.1:3227)
- 初期化: `npm run db:reset` / テスト: `npm test` / 型: `npm run typecheck` / lint: `npm run lint` / build: `npm run build`

## 共有Vault

- 共有Vault(Obsidian互換、Claude Code と Codex で共用): `C:\Users\kkth8\Desktop\AI-DataBase\AI_DataBase`
- 作業開始時に、Vault の `projects/ajito-security-lab.md` と `shared/context.md` を読む。
- 作業の区切りで `projects/ajito-security-lab.md` の「現在の状態」と「直近の決定事項」を更新する(frontmatter の date を更新し、author は claude-code か codex)。重要な決定は `decisions/` に1件1ファイルで残す。
- APIキー・パスワード・トークン・`.env` の中身などの秘密情報は Vault に書かない。
