"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function ComingSoon({ title, description, icon: Icon = Clock }: ComingSoonProps) {
  const { dictionary: t } = useI18n();

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <Badge variant="secondary">{t.common.comingSoon}</Badge>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
