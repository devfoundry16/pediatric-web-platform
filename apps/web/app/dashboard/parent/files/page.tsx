"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  FileImage,
  Upload,
  Trash2,
  Loader2,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { medicalFilesApi } from "@/lib/api/medical-files";
import { childrenApi } from "@/lib/api/children";
import type { MedicalFile } from "@/types/medical-record";
import type { ChildProfile } from "@/types/child";
import { formatDateDisplayDubai } from "@/lib/timezone";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-8 w-8 text-blue-500" />;
  }
  return <FileText className="h-8 w-8 text-muted-foreground" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ALL_TAB = "__all__";
const MAX_FILE_SIZE_MB = 10;

export default function ParentFilesPage() {
  const { dictionary: t, dateLocale } = useI18n();
  const mr = t.medicalRecords;

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [files, setFiles] = useState<MedicalFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChild, setActiveChild] = useState<string>(ALL_TAB);

  // Upload state
  const [selectedChildForUpload, setSelectedChildForUpload] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(() => {
    setIsLoading(true);
    Promise.all([childrenApi.list(), medicalFilesApi.list()])
      .then(([kids, f]) => {
        setChildren(kids);
        setFiles(f);
        // Pre-select first child for upload
        if (kids.length > 0 && !selectedChildForUpload) {
          setSelectedChildForUpload(kids[0].id);
        }
      })
      .catch(() => toast.error(mr.loadError))
      .finally(() => setIsLoading(false));
  }, [mr.loadError, selectedChildForUpload]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredFiles =
    activeChild === ALL_TAB ? files : files.filter((f) => f.child_id === activeChild);

  // ─── Upload handler ──────────────────────────────────────────────────────

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(mr.fileTooLarge.replace("{max}", String(MAX_FILE_SIZE_MB)));
      return;
    }

    const childId = selectedChildForUpload || (children[0]?.id ?? "");
    if (!childId) {
      toast.error(mr.selectChildBeforeUpload);
      return;
    }

    setIsUploading(true);
    try {
      const saved = await medicalFilesApi.upload(file, childId);
      setFiles((prev) => [saved, ...prev]);
      toast.success(mr.uploadSuccess);
    } catch {
      toast.error(mr.uploadError);
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be re-uploaded after deletion
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ─── Delete handler ──────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await medicalFilesApi.delete(deleteId);
      setFiles((prev) => prev.filter((f) => f.id !== deleteId));
      toast.success(mr.deleteFileSuccess);
      setDeleteId(null);
    } catch {
      toast.error(mr.deleteFileError);
    } finally {
      setIsDeleting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="parent">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{mr.filesTitle}</h1>
            <p className="text-muted-foreground">{mr.filesSubtitle}</p>
          </div>

          {/* Upload controls */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {children.length > 1 && (
              <Select
                value={selectedChildForUpload}
                onValueChange={setSelectedChildForUpload}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={mr.selectChild} />
                </SelectTrigger>
                <SelectContent>
                  {children.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.personalInfo.firstName} {c.personalInfo.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || children.length === 0}
              className="gap-2"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {mr.uploadFile}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleFileSelected}
            />
          </div>
        </div>

        {/* Child filter tabs */}
        {!isLoading && children.length > 1 && (
          <Tabs value={activeChild} onValueChange={setActiveChild}>
            <TabsList>
              <TabsTrigger value={ALL_TAB}>{mr.allChildren}</TabsTrigger>
              {children.map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.personalInfo.firstName} {c.personalInfo.lastName}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Files grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <Paperclip className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">{mr.noFiles}</p>
              <p className="text-sm text-muted-foreground/70">{mr.noFilesHint}</p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={children.length === 0}
              >
                <Upload className="h-4 w-4" />
                {mr.uploadFile}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFiles.map((file) => {
              const childName = file.child_profiles
                ? `${file.child_profiles.first_name} ${file.child_profiles.last_name}`
                : "—";

              return (
                <Card
                  key={file.id}
                  className="group transition-shadow hover:shadow-sm"
                >
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <FileIcon mimeType={file.file_type} />
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={file.signed_url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={mr.openFile}
                        >
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(file.id)}
                          title={mr.deleteFile}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p
                        className="text-sm font-medium text-foreground truncate"
                        title={file.file_name}
                      >
                        {file.file_name}
                      </p>
                      {children.length > 1 && (
                        <p className="text-xs text-muted-foreground">{childName}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>{formatFileSize(file.file_size_bytes)}</span>
                        <span>{formatDateDisplayDubai(file.created_at, dateLocale)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mr.deleteFile}</AlertDialogTitle>
            <AlertDialogDescription>{mr.deleteFileConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mr.deleteFile}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
