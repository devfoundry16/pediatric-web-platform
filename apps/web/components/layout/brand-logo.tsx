"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n/i18n-context";
import { cn } from "@/lib/utils";

// Intrinsic size of public/site-logo.png — next/image needs both to reserve layout space.
const LOGO_WIDTH = 234;
const LOGO_HEIGHT = 181;

export function BrandLogo({
  className,
  priority,
}: {
  /** Height utility, e.g. "h-10". Width follows the logo's aspect ratio. */
  className?: string;
  priority?: boolean;
}) {
  const { dictionary: t } = useI18n();

  return (
    <Image
      src="/site-logo.png"
      alt={t.common.appName}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={cn("w-auto object-contain", className)}
    />
  );
}
