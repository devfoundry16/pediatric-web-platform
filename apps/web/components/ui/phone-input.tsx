"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import * as RPNInput from "react-phone-number-input"
import flags from "react-phone-number-input/flags"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useI18n } from "@/lib/i18n/i18n-context"

type PhoneInputProps = Omit<
  React.ComponentProps<typeof RPNInput.default>,
  "onChange"
> & {
  onChange?: (value: RPNInput.Value) => void
  searchPlaceholder?: string
  emptyText?: string
}

/**
 * International phone number input with a searchable country-code selector.
 * Stores the value in E.164 format (e.g. "+971501234567").
 */
const PhoneInput = React.forwardRef<
  React.ElementRef<typeof RPNInput.default>,
  PhoneInputProps
>(({ className, onChange, searchPlaceholder, emptyText, ...props }, ref) => {
  return (
    <RPNInput.default
      ref={ref}
      className={cn("flex", className)}
      flagComponent={FlagComponent}
      countrySelectComponent={(selectProps) => (
        <CountrySelect
          {...selectProps}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
        />
      )}
      inputComponent={InputComponent}
      smartCaret={false}
      onChange={(value) => onChange?.((value || "") as RPNInput.Value)}
      {...props}
    />
  )
})
PhoneInput.displayName = "PhoneInput"

const InputComponent = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(
  ({ className, ...props }, ref) => (
    <Input
      className={cn("rounded-s-none rtl:rounded-e-none rtl:rounded-s-md", className)}
      {...props}
      ref={ref}
    />
  )
)
InputComponent.displayName = "PhoneInputInput"

type CountrySelectOption = { label: string; value: RPNInput.Country }

type CountrySelectProps = {
  disabled?: boolean
  value: RPNInput.Country
  onChange: (value: RPNInput.Country) => void
  options: CountrySelectOption[]
  searchPlaceholder?: string
  emptyText?: string
}

function CountrySelect({
  disabled,
  value,
  onChange,
  options,
  searchPlaceholder,
  emptyText,
}: CountrySelectProps) {
  const { dictionary: t } = useI18n()
  const [open, setOpen] = React.useState(false)
  const resolvedSearchPlaceholder =
    searchPlaceholder ?? t.common.searchCountry
  const resolvedEmptyText = emptyText ?? t.common.noCountryFound

  const handleSelect = React.useCallback(
    (country: RPNInput.Country) => {
      onChange(country)
      setOpen(false)
    },
    [onChange]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "flex gap-1 rounded-e-none rtl:rounded-s-none rtl:rounded-e-md border-r-0 rtl:border-r rtl:border-l-0 px-3 focus:z-10"
          )}
          disabled={disabled}
        >
          <FlagComponent
            country={value}
            countryName={value}
          />
          <ChevronsUpDownIcon
            className={cn(
              "-mr-1 size-4 opacity-50",
              disabled ? "hidden" : "opacity-100"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder={resolvedSearchPlaceholder} />
          <CommandList>
            <ScrollArea className="h-72">
              <CommandEmpty>{resolvedEmptyText}</CommandEmpty>
              <CommandGroup>
                {options
                  .filter((x) => x.value)
                  .map((option) => (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.value} +${RPNInput.getCountryCallingCode(option.value)}`}
                      onSelect={() => handleSelect(option.value)}
                    >
                      <FlagComponent
                        country={option.value}
                        countryName={option.label}
                      />
                      <span className="flex-1 text-sm">{option.label}</span>
                      <span className="text-muted-foreground text-sm">
                        {`+${RPNInput.getCountryCallingCode(option.value)}`}
                      </span>
                      <CheckIcon
                        className={cn(
                          "ml-auto size-4",
                          option.value === value ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function FlagComponent({ country, countryName }: RPNInput.FlagProps) {
  const Flag = flags[country]

  return (
    <span className="bg-foreground/20 flex h-4 w-6 shrink-0 items-center justify-center overflow-hidden rounded-sm">
      {Flag && <Flag title={countryName} />}
    </span>
  )
}

export { PhoneInput }
export type { Value as PhoneInputValue } from "react-phone-number-input"
export { isValidPhoneNumber } from "react-phone-number-input"
