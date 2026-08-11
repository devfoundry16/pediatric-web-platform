"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_TIMEZONE, getSystemTimezone, isValidTimezone } from "@/lib/timezone";

const STORAGE_KEY = "viewerTimezone";

/**
 * Cached at module scope so `getSnapshot` is referentially stable — returning a
 * fresh value on every call makes useSyncExternalStore loop forever.
 */
let cached: string | null = null;
const listeners = new Set<() => void>();

function read(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isValidTimezone(stored)) return stored;
  } catch {
    // Private mode / storage disabled — fall through to detection.
  }
  return getSystemTimezone();
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function handleStorage(event: StorageEvent): void {
  // key is null when storage is cleared wholesale.
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  cached = null;
  emit();
}

function subscribe(onChange: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", handleStorage);
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): string {
  if (cached === null) cached = read();
  return cached;
}

/**
 * There is no browser timezone during a server render. Returning null rather
 * than guessing is what keeps the server HTML and the hydration render
 * identical; React swaps in the real value on the next client render.
 */
function getServerSnapshot(): string | null {
  return null;
}

/**
 * The timezone times should be displayed in for this viewer: their own system
 * zone, or an explicit override they picked.
 *
 * Client components are prerendered on the server (app/layout.tsx is an async
 * server component wrapping the whole tree), so reading
 * `Intl...resolvedOptions().timeZone` or `localStorage` during render would
 * resolve the SERVER's zone and then flip on hydration — a hydration mismatch
 * plus a visible flash of wrong times. useSyncExternalStore is the supported
 * way to read a client-only value without that.
 *
 * Until resolved this returns `fallback` — pass the doctor's zone, so the
 * pre-hydration paint shows the schedule's own times rather than a guess.
 */
export function useViewerTimezone(fallback: string = DEFAULT_TIMEZONE): {
  timezone: string;
  setTimezone: (tz: string) => void;
  isResolved: boolean;
} {
  const stored = useSyncExternalStore<string | null>(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setTimezone = useCallback((tz: string) => {
    if (!isValidTimezone(tz)) return;
    cached = tz;
    try {
      window.localStorage.setItem(STORAGE_KEY, tz);
    } catch {
      // Non-fatal: the choice just won't survive a reload.
    }
    emit();
  }, []);

  return {
    timezone: stored ?? fallback,
    setTimezone,
    isResolved: stored !== null,
  };
}
