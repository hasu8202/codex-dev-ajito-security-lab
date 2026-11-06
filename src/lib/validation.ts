import { z } from "zod";

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,16}$/, "IDは半角の英小文字・数字・_ で3〜16文字にしてください");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "通り名を入れてください")
  .max(20, "通り名は20文字までです");

export const passwordSchema = z
  .string()
  .min(8, "パスワードは8文字以上にしてください")
  .max(72, "パスワードは72文字までです");

export const signupSchema = z.object({
  code: z.string().trim().min(1, "合言葉を入れてください"),
  handle: handleSchema,
  name: nameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  handle: z.string().trim().toLowerCase().min(1, "IDを入れてください").max(32, "IDかパスワードが違います"),
  // 上限が無いと巨大な文字列で scrypt を重くされる(登録時の上限 72 より余裕を持たせる)
  password: z.string().min(1, "パスワードを入れてください").max(200, "IDかパスワードが違います"),
});

export const postSchema = z.object({
  body: z.string().trim().min(1, "本文を入れてください").max(500, "本文は500文字までです"),
  sealed: z.boolean(),
  answersPrompt: z.boolean(),
});

export const commentSchema = z
  .string()
  .trim()
  .min(1, "コメントを入れてください")
  .max(300, "コメントは300文字までです");

export const messageSchema = z
  .string()
  .trim()
  .min(1, "メッセージを入れてください")
  .max(1000, "メッセージは1000文字までです");

export const profileSchema = z.object({
  name: nameSchema,
  bio: z.string().trim().max(120, "ひとことは120文字までです"),
  titleKey: z.string(),
});

export const groupSchema = z.object({
  name: z.string().trim().min(1, "会合の名前を入れてください").max(24, "会合の名前は24文字までです"),
  memberIds: z.array(z.string()).min(2, "自分以外に2人以上選んでください").max(30),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "入力を確かめてください";
}
