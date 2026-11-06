# アジト防衛演習室 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 情報屋アジトの体験を複製した、リセット可能なローカル専用セキュリティ演習アプリを実装する。

**Architecture:** 元アプリのNext.js/Drizzle画面とサービス層を別リポジトリへコピーし、Cloudflare関連を取り除く。専用のローカル実行ガード、DB初期化、教材案内レイヤーを加え、実データ・実Cookie・外部公開経路を完全に分ける。

**Tech Stack:** Node.js 26、Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4、Drizzle ORM、libSQL、Vitest。

**Spec:** `docs/superpowers/specs/2026-11-06-ajito-security-lab-design.md`

## Global Constraints

- 外部公開、Cloudflare/D1、実サービスの設定・データ・秘密情報を含めない。
- 起動時は `127.0.0.1` のみにバインドする。
- DBは `data/ajito-security-lab.db` に限定し、初期化コマンドで再作成可能にする。
- 変更ごとにテストを先に追加し、`scripts/codex-verify.ps1` で型・lint・テスト・buildを確認する。

## Review Focus

- localhost以外へのバインド要求を起動スクリプトが拒否すること。
- 初期化が専用DB以外を削除しないこと。
- テスト用Cookie名が実アプリのCookie名と一致しないこと。
- package.jsonに公開・デプロイ・リモートDBコマンドが残らないこと。
- 教材データに実在の個人情報や秘密情報が含まれないこと。

---

### Task 1: 分離されたアプリ基盤

**Files:**
- Copy: 元アプリの `src/`、`drizzle/`、テスト・基本設定
- Create: `src/lib/lab-safety.ts`、`tests/lab-safety.test.ts`
- Modify: `package.json`、`.gitignore`、`scripts/codex-verify.ps1`

**Interfaces:**
- Produces: `assertLabRuntime(): void` とローカル限定の npm scripts。

- [ ] テストで localhost以外の実行を拒否し、専用DB名だけを受け入れることを定義する。
- [ ] テストが失敗することを確認する。
- [ ] 元アプリを複製し、公開用設定を削除して `assertLabRuntime()` を実装する。
- [ ] 型・lint・テスト・buildを実行する。
- [ ] コミットする。

### Task 2: 教材データとリセット

**Files:**
- Create: `scripts/reset.ts`、`tests/reset.test.ts`
- Modify: `scripts/seed.ts`、`package.json`、README

**Interfaces:**
- Produces: `npm run db:reset`。

- [ ] テストで専用DBだけを初期化することと、シード後に必要な架空アカウントがあることを定義する。
- [ ] テストが失敗することを確認する。
- [ ] リセット処理と教材用シードを実装する。
- [ ] テストと一括検証を実行する。
- [ ] コミットする。

### Task 3: 演習案内と課題レイヤー

**Files:**
- Create: `src/app/(main)/training/page.tsx`、`src/components/TrainingBrief.tsx`、`docs/exercises.md`
- Modify: ナビゲーション、README、AGENTS.md、`.claude/settings.json`

**Interfaces:**
- Produces: `/training` の演習一覧と、安全境界・修正確認を説明する教材文書。

- [ ] 課題一覧が演習の目的、対象画面、修正後の確認を表示するテストを定義する。
- [ ] テストが失敗することを確認する。
- [ ] 教材案内を実装し、UIの世界観を保つ。
- [ ] 一括検証とブラウザでのlocalhost画面確認を実行する。
- [ ] コミットする。
