import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { CommentForm } from "@/components/CommentForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageHeader } from "@/components/PageHeader";
import { PostCard } from "@/components/PostCard";
import { RoleTag } from "@/components/MemberTags";
import { db } from "@/db";
import { relativeTime } from "@/lib/time";
import { deleteCommentAction, deletePostAction } from "@/server/actions";
import { requireUser } from "@/server/auth";
import { canModerate, getComments, getFeed } from "@/server/services";
import { toPostView } from "@/server/views";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const [post] = await getFeed(db, me.id, { postId: id, limit: 1 });
  if (!post) notFound();
  const list = await getComments(db, id);
  const now = new Date();

  return (
    <>
      <PageHeader title="調書" en="File" back="/">
        {(post.author.id === me.id || canModerate(me, post.author)) && (
          <ConfirmButton
            action={deletePostAction.bind(null, id)}
            redirectTo="/"
            message="この情報を消します。元に戻せません"
            className="text-sm text-cream-dim hover:text-wine-hi"
          >
            {post.author.id === me.id ? "消す" : "管理削除"}
          </ConfirmButton>
        )}
      </PageHeader>
      <div className="pt-6">
        <PostCard post={toPostView(post, now, me)} detail />
      </div>

      <section aria-labelledby="notes-h" className="mx-gutter">
        <div className="ornament-rule mb-3">
          <h2 id="notes-h" className="eyebrow">
            Annotations · 追記
          </h2>
        </div>
        {list.length === 0 && <p className="py-4 text-center text-sm text-cream-dim">まだ追記はありません。</p>}
        <ol className="space-y-px">
          {list.map((c) => (
            <li key={c.id} className="flex gap-3 border-l-2 border-brass-lo/50 py-2.5 pl-3">
              <Link href={`/u/${c.author.handle}`}>
                <Avatar name={c.author.name} imageId={c.author.avatarImageId} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <Link href={`/u/${c.author.handle}`} className="font-display font-bold tracking-[0.06em] hover:text-brass-hi">
                    {c.author.name}
                  </Link>
                  <span className="ml-1.5 inline-flex align-middle">
                    <RoleTag isAdmin={c.author.isAdmin} isModerator={c.author.isModerator} />
                  </span>
                  <span className="ml-2 text-xs text-cream-dim">{relativeTime(c.createdAt, now)}</span>
                  {(c.author.id === me.id || canModerate(me, c.author)) && (
                    <ConfirmButton
                      action={deleteCommentAction.bind(null, c.id, id)}
                      message="この追記を消します"
                      className="ml-2 text-xs text-cream-dim hover:text-wine-hi"
                    >
                      {c.author.id === me.id ? "消す" : "管理削除"}
                    </ConfirmButton>
                  )}
                </p>
                <p className="text-[15px] whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <CommentForm postId={id} />
    </>
  );
}
