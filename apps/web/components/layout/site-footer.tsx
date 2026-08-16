"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useFeatureFlag } from "@/lib/feature-flags/feature-flags-context";
import { Heart } from "lucide-react";

export function SiteFooter() {
  const { dictionary: t } = useI18n();
  const coursesEnabled = useFeatureFlag("courses");

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Heart className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">
                {t.common.appName}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t.landing.footerDesc}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t.landing.quickLinks}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              <li>
                <Link
                  href="/"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.common.home}
                </Link>
              </li>
              <li>
                <Link
                  href="/#services"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.common.services}
                </Link>
              </li>
              <li>
                <Link
                  href="/#packages"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.common.packages}
                </Link>
              </li>
              {coursesEnabled && (
                <li>
                  <Link
                    href="/courses"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t.common.courses}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t.common.services}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              <li>
                <Link
                  href="/booking"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.landing.service1Title}
                </Link>
              </li>
              <li>
                <Link
                  href="/live-sessions"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.common.liveSessions}
                </Link>
              </li>
              {coursesEnabled && (
                <li>
                  <Link
                    href="/courses"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t.landing.service5Title}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t.landing.support}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              <li>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.landing.helpCenter}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.common.contactUs}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.common.privacyPolicy}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.common.termsOfService}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {t.common.appName}.{" "}
            {t.landing.allRightsReserved}
          </p>
        </div>
      </div>
    </footer>
  );
}
