import { createHash, randomBytes, randomInt } from "node:crypto";

export function newId(): string {
  return randomBytes(12).toString("base64url");
}

// 読み間違えやすい 0/O/1/I/L を除いた文字
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 合言葉(招待コード)。例: K7QM-R2XH */
export function newInviteCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** 入力ゆれ(小文字・空白・ハイフン抜け)を吸収する */
export function normalizeInviteCode(input: string): string {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
