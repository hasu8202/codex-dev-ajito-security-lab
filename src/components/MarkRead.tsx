"use client";

import { useEffect } from "react";
import { markNotificationsReadAction } from "@/server/actions";
import { BADGES_EVENT } from "./Nav";

/** 開いたら既読にする(この画面では未読の色を残したまま、ナビの数だけ消す) */
export function MarkRead() {
  useEffect(() => {
    void markNotificationsReadAction().then(() => window.dispatchEvent(new Event(BADGES_EVENT)));
  }, []);
  return null;
}
