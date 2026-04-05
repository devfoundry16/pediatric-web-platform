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
import { FormSection } from "@/components/forms/form-section";
import { SelectField } from "@/components/forms/select-field";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { ChildProfileFormValues } from "@/types/child";
import { useWatch } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StepPersonalInfoProps {
  control: Control<ChildProfileFormValues>;
}

export function StepPersonalInfo({ control }: StepPersonalInfoProps) {
  const { dictionary: t } = useI18n();
  const nicuStay = useWatch({ control, name: "birthHistory.nicuStay" });

  return (
    <div className="flex flex-col gap-6">
      <FormSection
        title={t.childForm.sectionPersonal}
        badge="required"
        description={t.patient.personalInfo}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="personalInfo.firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.patient.firstName}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="given-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="personalInfo.lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.patient.lastName}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="family-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={control}
          name="personalInfo.dateOfBirth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.patient.dateOfBirth}</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <SelectField
          control={control}
          name="personalInfo.gender"
          label={t.patient.gender}
          options={[
            { value: "male", label: t.patient.male },
            { value: "female", label: t.patient.female },
            {
              value: "prefer_not_to_say",
              label: t.patient.preferNotToSay,
            },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="personalInfo.nationality"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.patient.nationality}</FormLabel>
                <FormControl>
                  <Input
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value || null)
                    }
                    placeholder="—"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="personalInfo.emiratesIdPassport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.patient.emiratesId}</FormLabel>
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
      </FormSection>

      <FormSection
        title={t.childForm.sectionPhysical}
        badge="recommended"
        description={t.patient.personalInfo}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="physicalInfo.weightKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.patient.weight}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
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
            name="physicalInfo.heightCm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.patient.height}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
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
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="physicalInfo.headCircumferenceCm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.patient.headCircumference}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
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
            name="physicalInfo.bloodType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.patient.bloodType}</FormLabel>
                <FormControl>
                  <Input
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value || null)
                    }
                    placeholder="A+, O-, …"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </FormSection>

      <FormSection
        title={t.childForm.sectionBirth}
        badge="optional"
        description={t.patient.healthHistory}
      >
        <FormField
          control={control}
          name="birthHistory.placeOfBirth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.childForm.placeOfBirth}</FormLabel>
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
          name="birthHistory.prematureBirth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.childForm.prematureBirth}</FormLabel>
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
                    <RadioGroupItem value="yes" id="prem-yes" />
                    <Label htmlFor="prem-yes" className="font-normal">
                      {t.childForm.yes}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="prem-no" />
                    <Label htmlFor="prem-no" className="font-normal">
                      {t.childForm.no}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="unknown" id="prem-unk" />
                    <Label htmlFor="prem-unk" className="font-normal">
                      {t.childForm.notSpecified}
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="birthHistory.birthWeightKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.childForm.birthWeight}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
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
            name="birthHistory.deliveryType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.childForm.deliveryType}</FormLabel>
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
                    <SelectItem value="normal">
                      {t.childForm.deliveryNormal}
                    </SelectItem>
                    <SelectItem value="c_section">
                      {t.childForm.deliveryCsection}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={control}
          name="birthHistory.nicuStay"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.childForm.nicuStay}</FormLabel>
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
                    <RadioGroupItem value="yes" id="nicu-yes" />
                    <Label htmlFor="nicu-yes" className="font-normal">
                      {t.childForm.yes}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="nicu-no" />
                    <Label htmlFor="nicu-no" className="font-normal">
                      {t.childForm.no}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="unknown" id="nicu-unk" />
                    <Label htmlFor="nicu-unk" className="font-normal">
                      {t.childForm.notSpecified}
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {nicuStay === true ? (
          <FormField
            control={control}
            name="birthHistory.nicuDuration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.childForm.nicuDuration}</FormLabel>
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
        ) : null}
      </FormSection>
    </div>
  );
}
