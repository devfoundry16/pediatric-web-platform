"use client";

import type { Control } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { FormSection } from "@/components/forms/form-section";
import { SelectField } from "@/components/forms/select-field";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { ChildProfileFormValues } from "@/types/child";

interface StepGuardianInfoProps {
  control: Control<ChildProfileFormValues>;
}

export function StepGuardianInfo({ control }: StepGuardianInfoProps) {
  const { dictionary: t } = useI18n();

  return (
    <FormSection
      title={t.childForm.sectionGuardian}
      badge="required"
      description={t.patient.guardianInfo}
    >
      <FormField
        control={control}
        name="guardianInfo.guardianName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t.patient.guardianName}</FormLabel>
            <FormControl>
              <Input {...field} autoComplete="name" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <SelectField
        control={control}
        name="guardianInfo.guardianRelationship"
        label={t.patient.relationship}
        options={[
          { value: "mother", label: t.patient.mother },
          { value: "father", label: t.patient.father },
          { value: "guardian", label: t.patient.guardian },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="guardianInfo.guardianMobile"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.patient.mobileNumber}</FormLabel>
              <FormControl>
                <PhoneInput
                  {...field}
                  defaultCountry="AE"
                  autoComplete="tel"
                  searchPlaceholder={t.common.search}
                  emptyText={t.common.noResults}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="guardianInfo.guardianEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.common.email}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name="guardianInfo.secondaryContactPhone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t.childForm.secondaryContact}</FormLabel>
            <FormControl>
              <PhoneInput
                value={field.value ?? ""}
                onChange={(value: string) => field.onChange(value || null)}
                defaultCountry="AE"
                searchPlaceholder={t.common.search}
                emptyText={t.common.noResults}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="guardianInfo.emergencyContactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.patient.emergencyContact}</FormLabel>
              <FormControl>
                <Input
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value || null)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="guardianInfo.emergencyContactPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.patient.emergencyPhone}</FormLabel>
              <FormControl>
                <PhoneInput
                  value={field.value ?? ""}
                  onChange={(value: string) => field.onChange(value || null)}
                  defaultCountry="AE"
                  searchPlaceholder={t.common.search}
                  emptyText={t.common.noResults}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormSection>
  );
}
