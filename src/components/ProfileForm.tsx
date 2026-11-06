/* eslint-disable @next/next/no-img-element -- 選んだ画像のプレビュー(blob URL)なので next/image を通さない */
"use client";

import { useActionState, useState } from "react";
import { resizeImage } from "@/lib/resize-image";
import { updateProfileAction, type FormState } from "@/server/actions";
import { Avatar } from "./Avatar";

type Props = {
  user: { name: string; bio: string; titleKey: string; avatarImageId: string | null };
  titles: { key: string; name: string }[];
};

const field = "field mt-1";

export function ProfileForm({ user, titles }: Props) {
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await updateProfileAction(prev, fd);
    if (result?.ok) {
      setAvatar(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    return result;
  }, undefined);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const small = await resizeImage(file, 400, 0.85);
    setAvatar(small);
    setPreview(URL.createObjectURL(small));
  }

  function submit(fd: FormData) {
    fd.delete("avatar");
    if (avatar) fd.set("avatar", avatar);
    formAction(fd);
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="flex items-center gap-4">
        {preview ? (
          <img src={preview} alt="新しいアイコン" className="size-20 rounded-full object-cover shadow-[0_0_0_1.5px_var(--brass-lo)]" />
        ) : (
          <Avatar name={user.name} imageId={user.avatarImageId} size="lg" />
        )}
        <label className="btn-ghost cursor-pointer px-3 py-1.5 text-sm">
          <input type="file" accept="image/*" className="sr-only" onChange={onPick} />
          アイコンを変える
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-cream-dim">通り名</span>
        <input name="name" defaultValue={user.name} required maxLength={20} className={field} />
      </label>
      <label className="block">
        <span className="text-sm text-cream-dim">名乗る称号</span>
        <select name="titleKey" defaultValue={user.titleKey} className={field}>
          {titles.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm text-cream-dim">ひとこと</span>
        <textarea name="bio" defaultValue={user.bio} maxLength={120} rows={2} className={field} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="plate btn-brass px-5 py-2">
          {pending ? "保存しています…" : "保存する"}
        </button>
        {saved && <span className="text-sm text-brass-hi">保存しました</span>}
        {state?.error && (
          <span role="alert" className="text-sm text-wine-hi">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
