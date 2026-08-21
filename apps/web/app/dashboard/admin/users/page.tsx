"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MoreHorizontal,
  UserCheck,
  UserX,
  Pencil,
  Trash2,
  UserPlus,
  Loader2,
} from "lucide-react";
import { adminApi, type AdminUser } from "@/lib/api/admin";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone } from "@/lib/timezone";

const ROLE_TABS = ["all", "parent", "doctor", "admin"] as const;
type RoleTab = (typeof ROLE_TABS)[number];

const ROLES = ["parent", "doctor", "admin"] as const;
type Role = (typeof ROLES)[number];

// Surface the backend's guard messages (e.g. "At least one active admin must
// remain.") instead of a generic failure.
function extractError(e: unknown, fallback: string): string {
  const resp = (e as { response?: { data?: { error?: string } } })?.response;
  return resp?.data?.error ?? fallback;
}

export default function AdminUsersPage() {
  const { dictionary: t, dateLocale } = useI18n();
  const { timezone } = useViewerTimezone();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<RoleTab>("all");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Edit dialog
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<Role>("parent");
  const [isSaving, setIsSaving] = useState(false);

  // Create dialog
  const [creating, setCreating] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createRole, setCreateRole] = useState<Role>("parent");
  const [isCreating, setIsCreating] = useState(false);

  // Delete dialog
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.listUsers({
      role: activeTab === "all" ? undefined : activeTab,
      search: search || undefined,
      page,
      limit: LIMIT,
    })
      .then(({ users: u, total: t }) => { setUsers(u); setTotal(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeTab, search, page]);

  useEffect(() => { load(); }, [load]);

  const roleLabel = (role: string) =>
    role === "parent" ? t.admin.common.roleParent
      : role === "doctor" ? t.admin.common.roleDoctor
      : role === "admin" ? t.admin.common.roleAdmin
      : role;

  // These sentences embed styled words ({admin}/{doctor} role names, the user
  // being deleted); splitting on the placeholders keeps the <span> styling
  // while leaving the translation free to reorder around them.
  const roleHintParts = t.admin.users.roleHint.split(/\{admin\}|\{doctor\}/);
  const deleteBodyParts = t.admin.users.deleteBody.split("{name}");

  const handleToggleActive = async (user: AdminUser) => {
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active });
      load();
    } catch (e) {
      toast.error(extractError(e, t.admin.users.updateError));
    }
  };

  const openEdit = (user: AdminUser) => {
    setEditing(user);
    setEditName(user.full_name ?? "");
    setEditPhone(user.phone ?? "");
    setEditRole(user.role);
  };

  const handleSave = async () => {
    if (!editing) return;
    setIsSaving(true);
    try {
      const { notice } = await adminApi.updateUser(editing.id, {
        full_name: editName,
        phone: editPhone,
        role: editRole,
      });
      toast.success(t.admin.users.updateSuccess);
      // A role change can create or retire their doctor record; say so rather
      // than leaving the admin to discover it under Doctors.
      if (notice) {
        toast[notice.ok ? "info" : "warning"](notice.text, { duration: 10000 });
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error(extractError(e, t.admin.users.updateError));
    } finally {
      setIsSaving(false);
    }
  };

  const openCreate = () => {
    setCreateEmail("");
    setCreatePassword("");
    setCreateName("");
    setCreatePhone("");
    setCreateRole("parent");
    setCreating(true);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const { notice } = await adminApi.createUser({
        email: createEmail.trim(),
        password: createPassword,
        full_name: createName.trim() || undefined,
        phone: createPhone.trim() || undefined,
        role: createRole,
      });
      toast.success(t.admin.users.createSuccess);
      if (notice) {
        toast[notice.ok ? "info" : "warning"](notice.text, { duration: 10000 });
      }
      setCreating(false);
      load();
    } catch (e) {
      toast.error(extractError(e, t.admin.users.createError));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await adminApi.deleteUser(deleting.id);
      toast.success(t.admin.users.deleteSuccess);
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(extractError(e, t.admin.users.deleteError));
    } finally {
      setIsDeleting(false);
    }
  };

  const createValid = createEmail.trim().length > 0 && createPassword.length >= 6;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.users.title}</h1>
          <p className="text-sm text-muted-foreground">{t.admin.users.subtitle}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t.admin.users.createUser}
        </Button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab === "all" ? t.admin.common.all : roleLabel(tab)}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.admin.common.searchByName}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.admin.users.listTitle.replace("{count}", String(total))}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">{t.admin.users.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.name}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.email}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.role}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.status}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.users.colJoined}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{u.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role === "admin" ? "default" : "outline"} className="capitalize">{roleLabel(u.role)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {u.is_active ? t.admin.common.active : t.admin.common.inactive}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateInTimezone(u.created_at, timezone, dateLocale)}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(u)}>
                              <Pencil className="mr-2 h-4 w-4" /> {t.admin.users.editInfo}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(u)}>
                              {u.is_active ? (
                                <><UserX className="mr-2 h-4 w-4" /> {t.admin.users.deactivate}</>
                              ) : (
                                <><UserCheck className="mr-2 h-4 w-4" /> {t.admin.users.activate}</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleting(u)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> {t.admin.users.delete}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t.admin.common.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              {t.common.previous}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              {t.common.next}
            </Button>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.admin.users.editTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t.admin.common.fullName}</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t.common.phone}</label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t.admin.common.role}</label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {roleHintParts[0]}<span className="font-medium">{t.admin.common.roleAdmin}</span>
                {roleHintParts[1]}<span className="font-medium">{t.admin.common.roleDoctor}</span>
                {roleHintParts[2]}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.admin.users.createUser}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t.common.email}</label>
              <Input type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder={t.admin.users.emailPlaceholder} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t.admin.common.tempPassword}</label>
              <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder={t.admin.users.tempPasswordPlaceholder} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t.admin.common.fullName}</label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t.common.phone}</label>
              <Input value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t.admin.common.role}</label>
              <Select value={createRole} onValueChange={(v) => setCreateRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>{t.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={!createValid || isCreating} className="gap-2">
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.admin.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.admin.users.deleteTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteBodyParts[0]}
            <span className="font-medium text-foreground">
              {deleting?.full_name ?? deleting?.email ?? t.admin.users.deleteFallbackName}
            </span>
            {deleteBodyParts[1]}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="gap-2">
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.admin.users.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
