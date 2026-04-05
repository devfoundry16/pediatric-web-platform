"use client";

import type { Control } from "react-hook-form";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormSection } from "@/components/forms/form-section";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { ChildProfileFormValues } from "@/types/child";

interface StepConsentProps {
  control: Control<ChildProfileFormValues>;
}

export function StepConsent({ control }: StepConsentProps) {
  const { dictionary: t } = useI18n();

  return (
    <FormSection
      title={t.childForm.sectionConsent}
      badge="required"
      description={t.patient.consent}
    >
      <div className="flex flex-col gap-4">
        <FormField
          control={control}
          name="consent.consentLegalGuardian"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(c) =>
                    field.onChange(c === true)
                  }
                  id="consent-guardian"
                  className="mt-0.5"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="consent-guardian"
                  className="text-sm font-normal leading-snug"
                >
                  {t.patient.legalGuardianConfirm}
                </Label>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="consent.consentDataStorage"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(c) =>
                    field.onChange(c === true)
                  }
                  id="consent-data"
                  className="mt-0.5"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="consent-data"
                  className="text-sm font-normal leading-snug"
                >
                  {t.patient.consentDataStorage}
                </Label>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="consent.consentTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(c) =>
                    field.onChange(c === true)
                  }
                  id="consent-terms"
                  className="mt-0.5"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="consent-terms"
                  className="text-sm font-normal leading-snug"
                >
                  {t.patient.agreeTermsPrivacy}
                </Label>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
      </div>
    </FormSection>
  );
}
