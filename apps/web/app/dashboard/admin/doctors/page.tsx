"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { DEFAULT_TIMEZONE, formatTimezoneLabel } from "@/lib/timezone";
import { Plus, Loader2, Pencil, KeyRound, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import {
  adminApi,
  type AdminDoctorRow,
  type CreateDoctorPayload,
} from "@/lib/api/admin";
import { useI18n } from "@/lib/i18n/i18n-context";

/** Shape shared by the create and edit dialogs. */
interface DoctorForm {
  full_name: string;
  specialty: string;
  bio: string;
  email: string;
  timezone: string;
  account_email: string;
  account_password: string;
}

const emptyForm = (): DoctorForm => ({
  full_name: "",
  specialty: "",
  bio: "",
  email: "",
  timezone: DEFAULT_TIMEZONE,
  account_email: "",
  account_password: "",
});

function apiError(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
  );
}

export default function AdminDoctorsPage() {
  const { dictionary: t } = useI18n();
  // `load` must stay referentially stable across locale changes (re-creating
  // it would refetch the list and re-show skeletons on a language toggle), so
  // its toast copy is read through a ref that always holds the current
  // dictionary.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [doctors, setDoctors] = useState<AdminDoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<DoctorForm>(emptyForm());

  const [editing, setEditing] = useState<AdminDoctorRow | null>(null);
  const [editForm, setEditForm] = useState<DoctorForm>(emptyForm());

  const [linking, setLinking] = useState<AdminDoctorRow | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { doctors: rows } = await adminApi.listDoctors();
      setDoctors(rows);
    } catch {
      toast.error(tRef.current.admin.common.loadDoctorsError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const payload: CreateDoctorPayload = {
        full_name: createForm.full_name.trim(),
        specialty: createForm.specialty.trim() || undefined,
        bio: createForm.bio.trim() || undefined,
        email: createForm.email.trim() || undefined,
        timezone: createForm.timezone,
      };
      // Only send credentials when an address was given, so a doctor added
      // without a login stays login-less rather than getting an empty account.
      if (createForm.account_email.trim()) {
        payload.account_email = createForm.account_email.trim();
        payload.account_password = createForm.account_password || undefined;
      }
      await adminApi.createDoctor(payload);
      toast.success(t.admin.doctors.addSuccess);
      setCreating(false);
      setCreateForm(emptyForm());
      await load();
    } catch (err) {
      toast.error(apiError(err, t.admin.doctors.addError));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.updateDoctor(editing.id, {
        full_name: editForm.full_name.trim(),
        specialty: editForm.specialty.trim(),
        bio: editForm.bio.trim(),
        email: editForm.email.trim(),
        timezone: editForm.timezone,
      });
      toast.success(t.admin.doctors.updateSuccess);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, t.admin.doctors.updateError));
    } finally {
      setSaving(false);
    }
  };

  const handleLink = async () => {
    if (!linking) return;
    setSaving(true);
    try {
      const { created } = await adminApi.linkDoctorAccount(linking.id, {
        account_email: linkEmail.trim(),
        account_password: linkPassword || undefined,
      });
      toast.success(created ? t.admin.doctors.linkCreated : t.admin.doctors.linkLinked);
      setLinking(null);
      setLinkEmail("");
      setLinkPassword("");
      await load();
    } catch (err) {
      toast.error(apiError(err, t.admin.doctors.linkError));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (doctor: AdminDoctorRow) => {
    try {
      await adminApi.updateDoctor(doctor.id, { is_active: !doctor.is_active });
      toast.success(doctor.is_active ? t.admin.doctors.deactivated : t.admin.doctors.activated);
      await load();
    } catch (err) {
      toast.error(apiError(err, t.admin.doctors.toggleError));
    }
  };

  const openEdit = (doctor: AdminDoctorRow) => {
    setEditForm({
      ...emptyForm(),
      full_name: doctor.full_name,
      specialty: doctor.specialty ?? "",
      bio: doctor.bio ?? "",
      email: doctor.email ?? "",
      timezone: doctor.timezone || DEFAULT_TIMEZONE,
    });
    setEditing(doctor);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.doctors.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.admin.doctors.subtitle}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {t.admin.doctors.addDoctor}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.admin.doctors.listTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Stethoscope className="h-8 w-8 opacity-40" />
              <p className="text-sm">{t.admin.doctors.empty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t.common.name}</th>
                    <th className="pb-2 font-medium">{t.doctorDashboard.specialty}</th>
                    <th className="pb-2 font-medium">{t.admin.doctors.colNotifications}</th>
                    <th className="pb-2 font-medium">{t.doctorDashboard.timezoneLabel}</th>
                    <th className="pb-2 font-medium">{t.common.login}</th>
                    <th className="pb-2 font-medium">{t.admin.doctors.colBookable}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-medium text-foreground">{d.full_name}</td>
                      <td className="py-3 text-muted-foreground">{d.specialty ?? "—"}</td>
                      <td className="py-3 text-muted-foreground">
                        {d.email ?? <span className="text-amber-600">{t.admin.doctors.notSet}</span>}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatTimezoneLabel(d.timezone || DEFAULT_TIMEZONE)}
                      </td>
                      <td className="py-3">
                        {d.profile_id ? (
                          <Badge variant="secondary">{t.childForm.yes}</Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => {
                              setLinkEmail("");
                              setLinkPassword("");
                              setLinking(d);
                            }}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            {t.admin.doctors.setUp}
                          </Button>
                        )}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => toggleActive(d)}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                            d.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {d.is_active ? t.admin.common.active : t.admin.common.off}
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(d)}
                        >
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

      {/* Create */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.admin.doctors.addDoctor}</DialogTitle>
          </DialogHeader>
          <DoctorFields form={createForm} onChange={setCreateForm} />

          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4">
            <p className="text-sm font-medium text-foreground">{t.admin.doctors.loginOptional}</p>
            <p className="text-xs text-muted-foreground">
              {t.admin.doctors.loginOptionalHint}
            </p>
            <Input
              type="email"
              placeholder={t.admin.doctors.signInEmail}
              value={createForm.account_email}
              onChange={(e) =>
                setCreateForm({ ...createForm, account_email: e.target.value })
              }
            />
            <Input
              type="password"
              placeholder={t.admin.doctors.tempPasswordPlaceholder}
              value={createForm.account_password}
              onChange={(e) =>
                setCreateForm({ ...createForm, account_password: e.target.value })
              }
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!createForm.full_name.trim() || saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.admin.doctors.addDoctor}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.admin.doctors.editTitle.replace("{name}", editing?.full_name ?? "")}</DialogTitle>
          </DialogHeader>
          <DoctorFields form={editForm} onChange={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!editForm.full_name.trim() || saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link / create login */}
      <Dialog open={!!linking} onOpenChange={() => setLinking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.admin.doctors.linkTitle.replace("{name}", linking?.full_name ?? "")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t.admin.doctors.linkHint}
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t.admin.doctors.signInEmail}</label>
              <Input
                type="email"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                placeholder={t.admin.doctors.emailPlaceholder}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {t.admin.common.tempPassword}
              </label>
              <Input
                type="password"
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                placeholder={t.admin.doctors.linkPasswordPlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinking(null)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleLink}
              disabled={!linkEmail.trim() || saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.admin.doctors.setUpLogin}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DoctorFields({
  form,
  onChange,
}: {
  form: DoctorForm;
  onChange: (next: DoctorForm) => void;
}) {
  const { dictionary: t } = useI18n();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t.admin.common.fullName}</label>
        <Input
          value={form.full_name}
          onChange={(e) => onChange({ ...form, full_name: e.target.value })}
          placeholder={t.admin.doctors.fullNamePlaceholder}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t.doctorDashboard.specialty}</label>
        <Input
          value={form.specialty}
          onChange={(e) => onChange({ ...form, specialty: e.target.value })}
          placeholder={t.admin.doctors.specialtyPlaceholder}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t.admin.doctors.bioLabel}</label>
        <Textarea
          rows={3}
          value={form.bio}
          onChange={(e) => onChange({ ...form, bio: e.target.value })}
          placeholder={t.admin.doctors.bioPlaceholder}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t.doctorDashboard.notificationEmail}</label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
          placeholder={t.admin.doctors.emailPlaceholder}
        />
        <p className="text-xs text-muted-foreground">
          {t.admin.doctors.notificationEmailHint}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t.doctorDashboard.timezoneLabel}</label>
        <TimezoneSelect
          value={form.timezone}
          onChange={(timezone) => onChange({ ...form, timezone })}
          className="w-full max-w-none"
        />
        <p className="text-xs text-muted-foreground">
          {t.admin.doctors.timezoneHint}
        </p>
      </div>
    </div>
  );
}
