"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
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
  MoreHorizontal,
  CheckCircle,
  XCircle,
  CalendarClock,
  UserMinus,
  Loader2,
} from "lucide-react";
import { adminApi, type AdminAppointment, type AdminDoctorRow } from "@/lib/api/admin";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
  rescheduled: "bg-purple-100 text-purple-700",
};

const STATUSES = ["", "pending", "confirmed", "completed", "cancelled", "rescheduled"] as const;

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Filters
  const [filterDate, setFilterDate] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Action dialog state
  const [actionAppt, setActionAppt] = useState<AdminAppointment | null>(null);
  const [actionType, setActionType] = useState<"cancel" | "reschedule" | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.listAppointments({
        date: filterDate || undefined,
        doctorId: filterDoctor || undefined,
        status: filterStatus || undefined,
        page,
        limit: LIMIT,
      }),
      doctors.length === 0 ? adminApi.listDoctors() : Promise.resolve({ doctors }),
    ])
      .then(([{ appointments: a, total: t }, { doctors: d }]) => {
        setAppointments(a);
        setTotal(t);
        if (d) setDoctors(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterDate, filterDoctor, filterStatus, page]);

  useEffect(() => { load(); }, [load]);

  const quickAction = async (id: string, action: string) => {
    await adminApi.updateAppointment(id, action);
    load();
  };

  const handleAction = async () => {
    if (!actionAppt || !actionType) return;
    setIsActing(true);
    try {
      if (actionType === "cancel") {
        await adminApi.updateAppointment(actionAppt.id, "cancel", { cancellationReason: cancelReason || undefined });
      } else if (actionType === "reschedule") {
        await adminApi.updateAppointment(actionAppt.id, "reschedule", { newDate: rescheduleDate, newTime: rescheduleTime });
      }
      setActionAppt(null);
      setActionType(null);
      load();
    } finally {
      setIsActing(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
        <p className="text-sm text-muted-foreground">View and manage all appointments across the platform</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          type="date"
          value={filterDate}
          onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
          className="w-40"
          placeholder="Filter by date"
        />
        <Select value={filterDoctor || "all"} onValueChange={(v) => { setFilterDoctor(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All doctors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus || "all"} onValueChange={(v) => { setFilterStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s || "all"} value={s || "all"}>{s || "All statuses"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterDate || filterDoctor || filterStatus) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterDate(""); setFilterDoctor(""); setFilterStatus(""); setPage(1); }}>
            Clear filters
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Appointments ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : appointments.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No appointments found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date & Time</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{a.scheduled_date}</div>
                        <div className="text-xs text-muted-foreground">{a.scheduled_time}</div>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {a.child_profiles ? `${a.child_profiles.first_name} ${a.child_profiles.last_name}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground">{a.doctors?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{a.consultation_type}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {a.price_aed > 0 ? `AED ${a.price_aed}` : <Badge variant="outline" className="text-xs">Package</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Consultation rooms are private and joinable only
                                by the parent and the assigned doctor; admins do
                                not join live sessions. */}
                            {!["completed", "cancelled"].includes(a.status) && (
                              <>
                                <DropdownMenuItem onClick={() => quickAction(a.id, "complete")}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Mark completed
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => quickAction(a.id, "no_show")}>
                                  <UserMinus className="mr-2 h-4 w-4 text-orange-500" /> Mark no-show
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setActionAppt(a); setActionType("reschedule"); setRescheduleDate(""); setRescheduleTime(""); }}>
                                  <CalendarClock className="mr-2 h-4 w-4" /> Reschedule
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setActionAppt(a); setActionType("cancel"); setCancelReason(""); }} className="text-destructive">
                                  <XCircle className="mr-2 h-4 w-4" /> Cancel
                                </DropdownMenuItem>
                              </>
                            )}
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
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}

      {/* Cancel dialog */}
      <Dialog open={actionType === "cancel" && !!actionAppt} onOpenChange={() => { setActionAppt(null); setActionType(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Cancellation reason (optional)</label>
            <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Enter reason…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionAppt(null); setActionType(null); }}>Back</Button>
            <Button variant="destructive" onClick={handleAction} disabled={isActing} className="gap-2">
              {isActing && <Loader2 className="h-4 w-4 animate-spin" />} Cancel appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={actionType === "reschedule" && !!actionAppt} onOpenChange={() => { setActionAppt(null); setActionType(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">New date</label>
              <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">New time (HH:MM)</label>
              <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionAppt(null); setActionType(null); }}>Back</Button>
            <Button onClick={handleAction} disabled={isActing || !rescheduleDate || !rescheduleTime} className="gap-2">
              {isActing && <Loader2 className="h-4 w-4 animate-spin" />} Confirm reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
