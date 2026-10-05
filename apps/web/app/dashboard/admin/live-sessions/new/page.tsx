"use client";

import { NewLiveSession } from "@/components/dashboard/live-sessions/new-live-session";

// The admin creating the session hosts it; the API records them as its host.
export default function AdminNewLiveSessionPage() {
  return <NewLiveSession basePath="/dashboard/admin/live-sessions" />;
}
