"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildTimezoneOptions, formatTimezoneLabel, isValidTimezone } from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface TimezoneSelectProps {
  value: string;
  onChange: (timezone: string) => void;
  /**
   * Extra zones to guarantee are present — typically the viewer's detected zone
   * and the doctor's configured one. Anything outside the curated list is
   * surfaced in a "Detected" group so it is selectable and labelled rather than
   * rendering as a blank trigger.
   */
  pinned?: (string | undefined | null)[];
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function TimezoneSelect({
  value,
  onChange,
  pinned = [],
  disabled,
  id,
  className,
}: TimezoneSelectProps) {
  // Labels embed the zone's current UTC offset, which changes with DST — but
  // recomputing per render would churn ~90 Intl formats on every keystroke
  // elsewhere in the form, and an offset that is one render stale is harmless.
  const groups = useMemo(
    () => buildTimezoneOptions([...pinned, value]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, pinned.join("|")]
  );

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full max-w-xs", className)}>
        <SelectValue>{isValidTimezone(value) ? formatTimezoneLabel(value) : value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectGroup key={group.region}>
            <SelectLabel>{group.region}</SelectLabel>
            {group.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
