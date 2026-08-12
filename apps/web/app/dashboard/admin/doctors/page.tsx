"use client";

import { useCallback, useEffect, useState } from "react";
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
      toast.error("Could not load doctors");
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
      toast.success("Doctor added");
      setCreating(false);
      setCreateForm(emptyForm());
      await load();
    } catch (err) {
      toast.error(apiError(err, "Could not add doctor"));
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
      toast.success("Doctor updated");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, "Could not update doctor"));
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
      toast.success(created ? "Login created" : "Existing account linked");
      setLinking(null);
      setLinkEmail("");
      setLinkPassword("");
      await load();
    } catch (err) {
      toast.error(apiError(err, "Could not set up the login"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (doctor: AdminDoctorRow) => {
    try {
      await adminApi.updateDoctor(doctor.id, { is_active: !doctor.is_active });
      toast.success(doctor.is_active ? "Doctor deactivated" : "Doctor activated");
      await load();
    } catch (err) {
      toast.error(apiError(err, "Could not change availability"));
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
          <h1 className="text-2xl font-bold text-foreground">Doctors</h1>
          <p className="text-sm text-muted-foreground">
            Add doctors, set their working timezone, and control whether they can be booked
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Add doctor
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All doctors</CardTitle>
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
              <p className="text-sm">No doctors yet. Add one to make bookings possible.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Specialty</th>
                    <th className="pb-2 font-medium">Notifications</th>
                    <th className="pb-2 font-medium">Timezone</th>
                    <th className="pb-2 font-medium">Login</th>
                    <th className="pb-2 font-medium">Bookable</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-medium text-foreground">{d.full_name}</td>
                      <td className="py-3 text-muted-foreground">{d.specialty ?? "—"}</td>
                      <td className="py-3 text-muted-foreground">
                        {d.email ?? <span className="text-amber-600">Not set</span>}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatTimezoneLabel(d.timezone || DEFAULT_TIMEZONE)}
                      </td>
                      <td className="py-3">
                        {d.profile_id ? (
                          <Badge variant="secondary">Yes</Badge>
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
                            Set up
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
                          {d.is_active ? "Active" : "Off"}
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
            <DialogTitle>Add doctor</DialogTitle>
          </DialogHeader>
          <DoctorFields form={createForm} onChange={setCreateForm} />

          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4">
            <p className="text-sm font-medium text-foreground">Login (optional)</p>
            <p className="text-xs text-muted-foreground">
              Leave empty to add a doctor who can be booked but cannot sign in. You can set
              this up later. If the address already has an account, it is linked instead of
              created.
            </p>
            <Input
              type="email"
              placeholder="Sign-in email"
              value={createForm.account_email}
              onChange={(e) =>
                setCreateForm({ ...createForm, account_email: e.target.value })
              }
            />
            <Input
              type="password"
              placeholder="Temporary password (min 6 characters)"
              value={createForm.account_password}
              onChange={(e) =>
                setCreateForm({ ...createForm, account_password: e.target.value })
              }
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!createForm.full_name.trim() || saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editing?.full_name}</DialogTitle>
          </DialogHeader>
          <DoctorFields form={editForm} onChange={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!editForm.full_name.trim() || saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link / create login */}
      <Dialog open={!!linking} onOpenChange={() => setLinking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set up login for {linking?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Gives this doctor access to the doctor dashboard. An address that already has
              an account is linked; otherwise a new one is created with the password below.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Sign-in email</label>
              <Input
                type="email"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                placeholder="doctor@clinic.ae"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Temporary password
              </label>
              <Input
                type="password"
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                placeholder="Only needed for a new account"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinking(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleLink}
              disabled={!linkEmail.trim() || saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Set up login
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
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Full name</label>
        <Input
          value={form.full_name}
          onChange={(e) => onChange({ ...form, full_name: e.target.value })}
          placeholder="Dr. Sahar"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Specialty</label>
        <Input
          value={form.specialty}
          onChange={(e) => onChange({ ...form, specialty: e.target.value })}
          placeholder="General Pediatrics"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Bio</label>
        <Textarea
          rows={3}
          value={form.bio}
          onChange={(e) => onChange({ ...form, bio: e.target.value })}
          placeholder="Shown to parents when booking"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Notification email</label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
          placeholder="doctor@clinic.ae"
        />
        <p className="text-xs text-muted-foreground">
          Where new booking notifications go. Separate from the sign-in address; leave empty
          to send none.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Timezone</label>
        <TimezoneSelect
          value={form.timezone}
          onChange={(timezone) => onChange({ ...form, timezone })}
          className="w-full max-w-none"
        />
        <p className="text-xs text-muted-foreground">
          Their working hours are expressed in this zone. Patients see times converted to
          their own.
        </p>
      </div>
    </div>
  );
}
