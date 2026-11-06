import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MessagePanel } from "@/components/MessagePanel";
import { PageHeader } from "@/components/PageHeader";
import { db } from "@/db";
import { leaveRoomAction } from "@/server/actions";
import { requireUser } from "@/server/auth";
import { getMessages, getRoom, isBlocking, ServiceError } from "@/server/services";

export const metadata: Metadata = { title: "密談" };

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  let room, msgs;
  try {
    room = await getRoom(db, me.id, id);
    msgs = await getMessages(db, me.id, id);
  } catch (e) {
    if (e instanceof ServiceError) notFound();
    throw e;
  }
  if (!room) notFound();
  const other = room.isGroup ? undefined : room.others[0];
  // 自分がブロックしている相手のときだけ知らせる(相手からのブロックは見せない)
  const blocking = other ? await isBlocking(db, me.id, other.id) : false;

  return (
    <>
      <PageHeader title={room.title} en={room.isGroup ? "Assembly" : "Private Line"} back="/rooms">
        {room.isGroup && <span className="numeral text-sm text-cream-dim">{room.others.length + 1}人</span>}
      </PageHeader>
      {room.isGroup && (
        <p className="px-gutter pt-3 text-xs text-cream-dim">
          参加者: {["あなた", ...room.others.map((o) => o.name)].join("、")}
          <ConfirmButton
            action={leaveRoomAction.bind(null, id)}
            message="この会合から抜けます。抜けると、これまでの話も見られなくなります"
            className="ml-3 underline decoration-rule-hi underline-offset-4 hover:text-wine-hi"
          >
            会合から抜ける
          </ConfirmButton>
        </p>
      )}
      {blocking && (
        <p role="status" className="px-gutter pt-3 text-xs text-cream-dim">
          この相手をブロックしているため、新しく話せません。解除は相手のページか「自分」から
        </p>
      )}
      <MessagePanel
        roomId={id}
        meId={me.id}
        initial={msgs.map((m) => ({ ...m, createdAt: m.createdAt.getTime() }))}
      />
    </>
  );
}
