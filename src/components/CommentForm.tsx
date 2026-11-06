"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCommentAction, type FormState } from "@/server/actions";

export function CommentForm({ postId }: { postId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addCommentAction.bind(null, postId),
    undefined,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="px-gutter py-4">
      <label htmlFor="comment" className="sr-only">
        追記
      </label>
      <div className="flex gap-2">
        <input
          id="comment"
          name="body"
          maxLength={300}
          required
          autoComplete="off"
          placeholder="追記を書く"
          className="field min-w-0 flex-1"
        />
        <button type="submit" disabled={pending} className="plate btn-brass px-4 py-2">
          送る
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-wine-hi">
          {state.error}
        </p>
      )}
    </form>
  );
}
