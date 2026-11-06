import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { MemberTags } from "@/components/MemberTags";
import { db } from "@/db";
import { requireUser } from "@/server/auth";
import { listMembers } from "@/server/services";

export const metadata: Metadata = { title: "名簿" };

export default async function MembersPage() {
  await requireUser();
  const members = await listMembers(db);
  return (
    <>
      <PageHeader title={`名簿(${members.length}人)`} en="Register of Members" back="/ranking" />
      <ul className="mx-gutter mt-4">
        {members.map((m) => (
          <li key={m.id} className="border-b border-rule">
            <Link href={`/u/${m.handle}`} className="flex items-center gap-3 px-4 py-3 hover:bg-panel sm:px-5">
              <Avatar name={m.name} imageId={m.avatarImageId} />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate font-display tracking-[0.06em] group-hover:text-brass-hi">{m.name}</span>
                  <MemberTags tags={m} />
                </span>
                <span className="text-xs text-cream-dim">
                  <span className="font-latin tracking-[0.12em]">AGENT</span> @{m.handle}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
