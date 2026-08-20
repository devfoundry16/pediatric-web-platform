"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { appointmentsApi, type AppointmentFile } from "@/lib/api/appointments";

/**
 * Documents the parent attached when booking.
 *
 * Fetched on demand rather than with the appointment list: the links are
 * short-lived signed URLs (the bucket is private), so they are worth minting
 * only when someone actually opens the booking.
 */
export function AppointmentDocuments({ appointmentId }: { appointmentId: string }) {
  const { dictionary: t } = useI18n();
  const [files, setFiles] = useState<AppointmentFile[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // No setLoading(true) here: the initial state already covers it, and the
    // caller remounts this via `key` when a different appointment is opened.
    appointmentsApi
      .listFiles(appointmentId)
      .then((result) => active && setFiles(result))
      .catch(() => active && setFiles([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [appointmentId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.common.loading}
      </div>
    );
  }

  if (!files || files.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-foreground">{t.booking.attachmentsLabel}</h3>
      <ul className="flex flex-col gap-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm text-foreground">{file.file_name}</span>
            </div>
            {file.signed_url ? (
              <a
                href={file.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                {t.booking.attachmentsOpen}
              </a>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">—</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
