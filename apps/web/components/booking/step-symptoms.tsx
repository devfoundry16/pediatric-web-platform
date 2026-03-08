"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StepSymptomsProps {
  value: string;
  onChange: (value: string) => void;
}

export function StepSymptoms({ value, onChange }: StepSymptomsProps) {
  const { dictionary: t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t.booking.enterSymptoms}
      </h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="symptoms">{t.booking.enterSymptoms}</Label>
        <Textarea
          id="symptoms"
          placeholder={t.booking.symptomsPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          className="resize-none"
        />
      </div>
    </div>
  );
}
