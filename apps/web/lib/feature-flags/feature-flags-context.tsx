"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { featureFlagsApi } from "@/lib/api/feature-flags";
// SectionFlagKey, not FeatureFlagKey: this context is fed by the PUBLIC
// endpoint, which returns section flags only. Operational settings are read
// on the admin settings page and never reach here.
import type { SectionFlagKey, FeatureFlags } from "@/lib/api/feature-flags";

interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  /** A section is hidden unless the API says it is on — unknown reads as off. */
  isEnabled: (key: SectionFlagKey) => boolean;
  refresh: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(
  undefined
);

interface FeatureFlagsProviderProps {
  /** Read on the server so the first paint already has the right navigation. */
  initialFlags: FeatureFlags;
  children: ReactNode;
}

export function FeatureFlagsProvider({
  initialFlags,
  children,
}: FeatureFlagsProviderProps) {
  const [flags, setFlags] = useState<FeatureFlags>(initialFlags);

  const refresh = useCallback(async () => {
    try {
      setFlags(await featureFlagsApi.list());
    } catch {
      // Keep whatever we last knew rather than blanking the UI on a hiccup.
    }
  }, []);

  // The server value can be up to a revalidation window old; catch up once the
  // page is interactive so an admin's change is not waited out.
  useEffect(() => {
    let cancelled = false;

    featureFlagsApi
      .list()
      .then((next) => { if (!cancelled) setFlags(next); })
      // Keep whatever we last knew rather than blanking the UI on a hiccup.
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags,
      isEnabled: (key) => flags[key] === true,
      refresh,
    }),
    [flags, refresh]
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagsProvider");
  }
  return context;
}

/** Convenience for the common single-flag case. */
export function useFeatureFlag(key: SectionFlagKey): boolean {
  return useFeatureFlags().isEnabled(key);
}
