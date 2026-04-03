"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LayoutDashboard, LogOut, UserCircle } from "lucide-react";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(user: User): string {
  const name = user.user_metadata?.full_name as string | undefined;
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (
        parts[0]![0]! + parts[parts.length - 1]![0]!
      ).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const email = user.email ?? "?";
  return email.slice(0, 2).toUpperCase();
}

function getAvatarSrc(user: User): string | undefined {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const url =
    (meta?.avatar_url as string | undefined) ??
    (meta?.picture as string | undefined);
  return typeof url === "string" && url.length > 0 ? url : undefined;
}

export function UserNavMenu({ user }: { user: User }) {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const isSigningOut = useAuthStore((s) => s.isLoading);

  const dashboardHref =
    user.user_metadata?.role === "doctor"
      ? "/dashboard/doctor"
      : "/dashboard/parent";

  const profileHref =
    user.user_metadata?.role === "doctor"
      ? "/dashboard/doctor/profile"
      : "/dashboard/parent/profile";

  const fullName = (
    user.user_metadata?.full_name as string | undefined
  )?.trim();

  const handleSignOut = async () => {
    await signOut();
    if (!useAuthStore.getState().error) {
      router.push("/");
      router.refresh();
    }
  };

  const avatarSrc = getAvatarSrc(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full p-0"
          aria-label={t.common.accountMenu}
        >
          <Avatar className="h-9 w-9">
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            {fullName ? (
              <p className="truncate text-sm font-medium leading-none">
                {fullName}
              </p>
            ) : null}
            <p
              className={
                fullName
                  ? "truncate text-xs text-muted-foreground"
                  : "truncate text-sm leading-none"
              }
            >
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={dashboardHref} className="cursor-pointer">
            <LayoutDashboard className="size-4" />
            {t.common.dashboard}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={profileHref} className="cursor-pointer">
            <UserCircle className="size-4" />
            {t.profile.title}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
        >
          <LogOut className="size-4" />
          {isSigningOut ? t.common.loading : t.common.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
