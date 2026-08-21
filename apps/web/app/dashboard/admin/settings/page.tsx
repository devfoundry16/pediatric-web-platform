"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { featureFlagsApi, type FeatureFlagKey } from "@/lib/api/feature-flags";
import { useFeatureFlags } from "@/lib/feature-flags/feature-flags-context";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface Section {
  key: FeatureFlagKey;
  labelKey: keyof Dictionary["common"];
  descriptionKey: keyof Dictionary["admin"]["settings"];
  icon: LucideIcon;
}

const SECTIONS: Section[] = [
  {
    key: "courses",
    labelKey: "courses",
    descriptionKey: "coursesDescription",
    icon: GraduationCap,
  },
];

export default function AdminSettingsPage() {
  const { dictionary: t } = useI18n();
  const { flags, isEnabled, refresh } = useFeatureFlags();
  const [savingKey, setSavingKey] = useState<FeatureFlagKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (key: FeatureFlagKey, enabled: boolean) => {
    setSavingKey(key);
    setError(null);
    try {
      await featureFlagsApi.update(key, enabled);
      // Pull the saved value back so the switch reflects the server, not the click.
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.admin.settings.saveError);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t.admin.settings.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.admin.settings.subtitle}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.admin.settings.sectionsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 p-0">
          {SECTIONS.map((section) => {
            const enabled = isEnabled(section.key);
            const label = t.common[section.labelKey];
            return (
              <div
                key={section.key}
                className="flex items-start justify-between gap-6 border-b border-border px-6 py-5 last:border-0"
              >
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <section.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{label}</span>
                      {!enabled && <Badge variant="secondary">{t.common.comingSoon}</Badge>}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t.admin.settings[section.descriptionKey]}
                    </p>
                  </div>
                </div>

                <Switch
                  checked={enabled}
                  disabled={savingKey === section.key}
                  onCheckedChange={(checked) => handleToggle(section.key, checked)}
                  aria-label={t.admin.settings.sectionLiveAria.replace("{section}", label)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {Object.keys(flags).length === 0
          ? t.admin.settings.flagsUnreachable
          : t.admin.settings.effectNote}
      </p>
    </div>
  );
}
