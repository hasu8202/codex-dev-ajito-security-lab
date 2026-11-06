import "server-only";
import type { PostView } from "@/components/PostCard";
import { relativeTime } from "@/lib/time";
import { canModerate, type FeedPost, type Rank } from "./services";

export function toPostView(p: FeedPost, now = new Date(), viewer?: Rank): PostView {
  return {
    id: p.id,
    body: p.body,
    imageId: p.imageId,
    sealed: p.sealed,
    promptDate: p.promptDate,
    timeLabel: relativeTime(p.createdAt, now),
    likeCount: Number(p.likeCount),
    commentCount: Number(p.commentCount),
    likedByMe: Boolean(p.likedByMe),
    author: p.author,
    canModerate: !!viewer && canModerate(viewer, p.author),
  };
}
