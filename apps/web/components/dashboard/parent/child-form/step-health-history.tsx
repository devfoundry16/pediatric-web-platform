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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection } from "@/components/forms/form-section";
import { YesNoField } from "@/components/forms/yes-no-field";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { ChildProfileFormValues } from "@/types/child";

interface StepHealthHistoryProps {
  control: Control<ChildProfileFormValues>;
}

export function StepHealthHistory({ control }: StepHealthHistoryProps) {
  const { dictionary: t } = useI18n();

  return (
    <div className="flex flex-col gap-6">
      <FormSection
        title={t.childForm.sectionHealth}
        badge="required"
        description={t.patient.healthHistory}
      >
        <YesNoField
          control={control}
          namePresent="healthBackground.allergiesPresent"
          nameDetails="healthBackground.allergiesDetails"
          label={t.patient.allergies}
          detailsLabel={t.patient.allergies}
        />
        <YesNoField
          control={control}
          namePresent="healthBackground.chronicConditionsPresent"
          nameDetails="healthBackground.chronicConditionsDetails"
          label={t.patient.chronicConditions}
          detailsLabel={t.patient.chronicConditions}
        />
        <YesNoField
          control={control}
          namePresent="healthBackground.surgeriesPresent"
          nameDetails="healthBackground.surgeriesDetails"
          label={t.patient.surgeries}
          detailsLabel={t.patient.surgeries}
        />
        <YesNoField
          control={control}
          namePresent="healthBackground.medicationsPresent"
          nameDetails="healthBackground.medicationsDetails"
          label={t.patient.medications}
          detailsLabel={t.patient.medications}
        />
        <FormField
          control={control}
          name="healthBackground.vaccinationStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.patient.vaccinationStatus}</FormLabel>
              <Select
                value={field.value ?? "__none__"}
                onValueChange={(v) =>
                  field.onChange(v === "__none__" ? null : v)
                }
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t.childForm.notSpecified}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t.childForm.notSpecified}
                  </SelectItem>
                  <SelectItem value="up_to_date">
                    {t.patient.upToDate}
                  </SelectItem>
                  <SelectItem value="partial">{t.patient.partial}</SelectItem>
                  <SelectItem value="not_sure">{t.patient.notSure}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="healthBackground.familyMedicalHistory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.patient.familyHistory}</FormLabel>
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
      </FormSection>

      <FormSection
        title={t.childForm.sectionLifestyle}
        badge="optional"
        description={t.childForm.sectionLifestyle}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="lifestyle.schoolNurseryName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.childForm.schoolNursery}</FormLabel>
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
            name="lifestyle.gradeAgeGroup"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.childForm.gradeAgeGroup}</FormLabel>
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
        </div>
        <FormField
          control={control}
          name="lifestyle.smokingExposureHome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.childForm.smokingExposure}</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={(v) =>
                    field.onChange(
                      v === "unknown" ? null : v === "yes"
                    )
                  }
                  value={
                    field.value === true
                      ? "yes"
                      : field.value === false
                        ? "no"
                        : "unknown"
                  }
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="smoke-yes" />
                    <Label htmlFor="smoke-yes" className="font-normal">
                      {t.childForm.yes}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="smoke-no" />
                    <Label htmlFor="smoke-no" className="font-normal">
                      {t.childForm.no}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="unknown" id="smoke-unk" />
                    <Label htmlFor="smoke-unk" className="font-normal">
                      {t.childForm.notSpecified}
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="lifestyle.screenTimeHoursPerDay"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.childForm.screenTime}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.25"
                  min={0}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v === "" ? null : Number(v));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="lifestyle.physicalActivityLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.childForm.physicalActivity}</FormLabel>
              <Select
                value={field.value ?? "__none__"}
                onValueChange={(v) =>
                  field.onChange(v === "__none__" ? null : v)
                }
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t.childForm.notSpecified}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t.childForm.notSpecified}
                  </SelectItem>
                  <SelectItem value="low">{t.childForm.activityLow}</SelectItem>
                  <SelectItem value="moderate">
                    {t.childForm.activityModerate}
                  </SelectItem>
                  <SelectItem value="high">
                    {t.childForm.activityHigh}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSection>
    </div>
  );
}
