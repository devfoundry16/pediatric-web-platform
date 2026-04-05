"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

interface YesNoFieldProps<T extends FieldValues> {
  control: Control<T>;
  namePresent: FieldPath<T>;
  nameDetails: FieldPath<T>;
  label: string;
  detailsLabel?: string;
  detailsPlaceholder?: string;
  className?: string;
}

/**
 * Yes/No for `*Present` boolean + optional details when Yes.
 */
export function YesNoField<T extends FieldValues>({
  control,
  namePresent,
  nameDetails,
  label,
  detailsLabel = "Details",
  detailsPlaceholder,
  className,
}: YesNoFieldProps<T>) {
  const present = useWatch({ control, name: namePresent });

  return (
    <div className={cn("space-y-3", className)}>
      <FormField
        control={control}
        name={namePresent}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={(v) => field.onChange(v === "yes")}
                value={
                  field.value === true
                    ? "yes"
                    : field.value === false
                      ? "no"
                      : ""
                }
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="yes"
                    id={`${String(namePresent)}-yes`}
                  />
                  <Label
                    htmlFor={`${String(namePresent)}-yes`}
                    className="font-normal"
                  >
                    Yes
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id={`${String(namePresent)}-no`} />
                  <Label
                    htmlFor={`${String(namePresent)}-no`}
                    className="font-normal"
                  >
                    No
                  </Label>
                </div>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {present === true ? (
        <FormField
          control={control}
          name={nameDetails}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{detailsLabel}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={detailsPlaceholder}
                  className="min-h-[80px] resize-y"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
    </div>
  );
}
