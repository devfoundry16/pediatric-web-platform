"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";

export function RegisterForm() {
  const { dictionary: t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className="mt-8 flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">{t.auth.fullName}</Label>
        <Input id="fullName" type="text" placeholder="John Doe" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="regEmail">{t.common.email}</Label>
        <Input
          id="regEmail"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{t.auth.phoneNumber}</Label>
        <Input id="phone" type="tel" placeholder="+971 XX XXX XXXX" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="role">{t.auth.roleSelect}</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder={t.auth.roleSelect} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="parent">{t.auth.parent}</SelectItem>
            <SelectItem value="doctor">{t.auth.doctor}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="regPassword">{t.common.password}</Label>
        <div className="relative">
          <Input
            id="regPassword"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>

      <div className="flex items-start gap-2">
        <Checkbox id="terms" className="mt-0.5" />
        <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground">
          {t.auth.agreeTerms}
        </Label>
      </div>

      <Button type="submit" className="w-full">
        {t.auth.signUp}
      </Button>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t.auth.orContinueWith}
          </span>
        </div>
      </div>

      <Button type="button" variant="outline" className="w-full bg-transparent">
        Google
      </Button>
    </form>
  );
}
