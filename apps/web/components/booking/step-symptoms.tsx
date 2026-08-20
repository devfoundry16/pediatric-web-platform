"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES,
  describeFileSize,
  discardBookingAttachment,
  rejectionReason,
  uploadBookingAttachment,
  type BookingAttachment,
} from "@/lib/booking-attachments";

interface StepSymptomsProps {
  value: string;
  onChange: (value: string) => void;
  /** Needed to namespace uploads; the step is only reachable once it is set. */
  childId: string;
  attachments: BookingAttachment[];
  onAttachmentsChange: (attachments: BookingAttachment[]) => void;
}

export function StepSymptoms({
  value,
  onChange,
  childId,
  attachments,
  onAttachmentsChange,
}: StepSymptomsProps) {
  const { dictionary: t } = useI18n();
  const b = t.booking;
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atLimit = attachments.length >= MAX_FILES;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const room = MAX_FILES - attachments.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setError(b.attachmentsTooMany.replace("{max}", String(MAX_FILES)));

    setUploading(true);
    const uploaded: BookingAttachment[] = [];
    try {
      for (const file of chosen) {
        const reason = rejectionReason(file);
        if (reason === "type") {
          setError(b.attachmentsBadType.replace("{name}", file.name));
          continue;
        }
        if (reason === "size") {
          setError(b.attachmentsTooLarge.replace("{name}", file.name));
          continue;
        }
        uploaded.push(await uploadBookingAttachment(file, childId));
      }
      if (uploaded.length > 0) onAttachmentsChange([...attachments, ...uploaded]);
    } catch {
      setError(b.attachmentsFailed);
    } finally {
      setUploading(false);
      // Let the same file be picked again after a removal.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove(attachment: BookingAttachment) {
    onAttachmentsChange(attachments.filter((a) => a.storagePath !== attachment.storagePath));
    // Best effort: the row was never created, so a leftover object is the only
    // trace and it is not worth blocking the booking over.
    await discardBookingAttachment(attachment.storagePath).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-foreground">{b.enterSymptoms}</h2>

      <div className="flex flex-col gap-2">
        <Label htmlFor="symptoms">{b.enterSymptoms}</Label>
        <Textarea
          id="symptoms"
          placeholder={b.symptomsPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={7}
          className="resize-none"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label>{b.attachmentsLabel}</Label>
          <p className="text-xs text-muted-foreground">{b.attachmentsHint}</p>
        </div>

        {attachments.length > 0 && (
          <ul className="flex flex-col gap-2">
            {attachments.map((file) => (
              <li
                key={file.storagePath}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm text-foreground">{file.fileName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {describeFileSize(file.fileSizeBytes)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(file)}
                  aria-label={`${b.attachmentsRemove} ${file.fileName}`}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <Button
          type="button"
          variant="outline"
          className="w-fit gap-2"
          disabled={uploading || atLimit}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          {uploading ? t.common.loading : b.attachmentsAdd}
        </Button>

        {atLimit && (
          <p className="text-xs text-muted-foreground">
            {b.attachmentsTooMany.replace("{max}", String(MAX_FILES))}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
