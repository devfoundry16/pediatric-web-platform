"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Reads `?appointment=<id>` and scrolls that card into view once it exists.
 *
 * Notification emails link here rather than to a bare list, so the recipient
 * lands on the booking the mail is about instead of hunting for it.
 *
 * Pass `ready` as false while the list is still loading — the element is not
 * mounted yet, so scrolling before then silently does nothing.
 *
 * Callers using this must sit inside a <Suspense> boundary (see
 * app/auth/login/page.tsx for the pattern): useSearchParams opts a route out of
 * static prerendering otherwise.
 */
export function useHighlightedAppointment<T extends HTMLElement = HTMLDivElement>(
  ready: boolean
): {
  highlightedId: string | null;
  highlightRef: React.RefObject<T | null>;
} {
  const highlightedId = useSearchParams().get("appointment");
  const highlightRef = useRef<T | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (!ready || !highlightedId || scrolled.current) return;
    const node = highlightRef.current;
    if (!node) return;
    // Once only — re-scrolling on every refetch would yank the page out from
    // under someone who has since scrolled away.
    scrolled.current = true;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [ready, highlightedId]);

  return { highlightedId, highlightRef };
}
