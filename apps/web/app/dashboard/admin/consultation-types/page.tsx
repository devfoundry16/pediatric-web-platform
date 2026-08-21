"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { adminApi, type ConsultationType } from "@/lib/api/admin";
import { useI18n } from "@/lib/i18n/i18n-context";

type FormData = Omit<ConsultationType, "id" | "created_at" | "updated_at">;

const EMPTY_FORM: FormData = {
  slug: "",
  name: "",
  description: "",
  duration_minutes: 30,
  price_aed: 0,
  is_active: true,
};

export default function AdminConsultationTypesPage() {
  const { dictionary: t } = useI18n();
  const [types, setTypes] = useState<ConsultationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.listConsultationTypes()
      .then(({ consultationTypes }) => setTypes(consultationTypes))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (t: ConsultationType) => {
    setEditingId(t.id);
    setForm({
      slug: t.slug,
      name: t.name,
      description: t.description ?? "",
      duration_minutes: t.duration_minutes,
      price_aed: t.price_aed,
      is_active: t.is_active,
    });
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    if (!form.slug || !form.name || !form.duration_minutes || form.price_aed === undefined) {
      setError(t.admin.consultationTypes.validationError);
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await adminApi.updateConsultationType(editingId, form);
      } else {
        await adminApi.createConsultationType(form);
      }
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.admin.consultationTypes.saveError;
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (t: ConsultationType) => {
    await adminApi.updateConsultationType(t.id, { is_active: !t.is_active });
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.consultationTypes.title}</h1>
          <p className="text-sm text-muted-foreground">{t.admin.consultationTypes.subtitle}</p>
        </div>
        <Button className="gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t.admin.consultationTypes.newType}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.admin.consultationTypes.listTitle.replace("{count}", String(types.length))}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : types.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">{t.admin.consultationTypes.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.consultationTypes.colSlug}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.name}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.duration}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.courses.priceAed}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.status}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {types.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.slug}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 text-foreground">{row.duration_minutes} {t.appointments.minSuffix}</td>
                      <td className="px-4 py-3 text-foreground">{row.price_aed}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(row)}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${row.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                        >
                          {row.is_active ? t.admin.common.active : t.admin.common.inactive}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t.admin.consultationTypes.editTitle : t.admin.consultationTypes.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t.admin.consultationTypes.colSlug}</label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder={t.admin.consultationTypes.slugPlaceholder}
                  disabled={!!editingId}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t.common.name}</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t.admin.consultationTypes.namePlaceholder}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t.admin.consultationTypes.descriptionLabel}</label>
              <Input
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t.admin.consultationTypes.descriptionPlaceholder}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t.admin.consultationTypes.durationLabel}</label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                  min={5}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t.courses.priceAed}</label>
                <Input
                  type="number"
                  value={form.price_aed}
                  onChange={(e) => setForm((f) => ({ ...f, price_aed: Number(e.target.value) }))}
                  min={0}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded"
              />
              <span className="font-medium text-foreground">{t.admin.consultationTypes.activeCheckbox}</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? t.admin.consultationTypes.saveChanges : t.admin.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
