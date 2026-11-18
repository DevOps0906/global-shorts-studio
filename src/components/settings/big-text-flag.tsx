"use client";

import { useEffect } from "react";

export const BIG_TEXT_CLASS = "big-text";

export function BigTextFlag({ saved }: { saved: boolean }) {
  useEffect(() => {
    document.documentElement.classList.toggle(BIG_TEXT_CLASS, saved);
  }, [saved]);
  return null;
}
