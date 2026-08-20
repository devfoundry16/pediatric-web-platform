import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { removeMedicalFile, signMedicalFiles } from "../lib/medical-storage";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getUserRole(userId: string | undefined): Promise<string | null> {
  if (!supabaseAdmin || !userId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role ?? null;
}

async function getDoctorId(userId: string | undefined): Promise<string | null> {
  if (!supabaseAdmin || !userId) return null;
  const { data } = await supabaseAdmin
    .from("doctors")
    .select("id")
    .eq("profile_id", userId)
    .single();
  return data?.id ?? null;
}

async function getParentChildIds(parentId: string | undefined): Promise<string[]> {
  if (!supabaseAdmin || !parentId) return [];
  const { data } = await supabaseAdmin
    .from("child_profiles")
    .select("id")
    .eq("parent_id", parentId);
  return (data ?? []).map((r) => r.id);
}

// ─── List files ───────────────────────────────────────────────────────────────

export async function listMedicalFiles(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const role = await getUserRole(req.userId);
  const { childId, recordId } = req.query;

  let query = supabaseAdmin
    .from("medical_files")
    .select(`
      id,
      file_name,
      file_type,
      file_url,
      storage_path,
      file_size_bytes,
      created_at,
      child_id,
      record_id,
      appointment_id,
      uploaded_by,
      child_profiles!medical_files_child_id_fkey (
        id,
        first_name,
        last_name
      )
    `)
    .order("created_at", { ascending: false });

  if (role === "parent") {
    const childIds = await getParentChildIds(req.userId);
    if (childIds.length === 0) {
      res.json({ files: [] });
      return;
    }
    query = query.in("child_id", childIds);
    if (childId) query = query.eq("child_id", childId as string);
  } else if (role === "doctor") {
    const doctorId = await getDoctorId(req.userId);
    if (!doctorId) {
      res.status(403).json({ error: "Doctor profile not found" });
      return;
    }
    // Doctor sees files for children they have records for
    const { data: recordRows } = await supabaseAdmin
      .from("medical_records")
      .select("child_id")
      .eq("doctor_id", doctorId);
    const childIds = [...new Set((recordRows ?? []).map((r) => r.child_id))];
    if (childIds.length === 0) {
      res.json({ files: [] });
      return;
    }
    query = query.in("child_id", childIds);
    if (childId) query = query.eq("child_id", childId as string);
  } else {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (recordId) query = query.eq("record_id", recordId as string);

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ files: await signMedicalFiles(data ?? []) });
}

// ─── Save file metadata (file already uploaded to Supabase Storage by client) ─

export async function createMedicalFile(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const role = await getUserRole(req.userId);
  if (!role || role === "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { childId, recordId, appointmentId, fileName, fileType, fileUrl, storagePath, fileSizeBytes } =
    req.body;

  if (!childId || !fileName || !fileType || !fileUrl) {
    res.status(400).json({ error: "childId, fileName, fileType, and fileUrl are required" });
    return;
  }

  // For parents: verify child belongs to them
  if (role === "parent") {
    const childIds = await getParentChildIds(req.userId);
    if (!childIds.includes(childId)) {
      res.status(403).json({ error: "Child not found or not owned by this user" });
      return;
    }
  }

  // For doctors: verify the child is one of their patients (has an appointment with this doctor)
  if (role === "doctor") {
    const doctorId = await getDoctorId(req.userId);
    if (!doctorId) {
      res.status(403).json({ error: "Doctor profile not found" });
      return;
    }
    const { data: appt } = await supabaseAdmin!
      .from("appointments")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("child_id", childId)
      .not("status", "in", '("cancelled","rescheduled")')
      .limit(1)
      .maybeSingle();
    if (!appt) {
      res.status(403).json({ error: "Child is not one of your patients" });
      return;
    }
  }

  const { data: file, error } = await supabaseAdmin
    .from("medical_files")
    .insert({
      child_id: childId,
      record_id: recordId ?? null,
      appointment_id: appointmentId ?? null,
      file_name: fileName,
      file_type: fileType,
      file_url: fileUrl,
      // The bucket is private, so the path — not the URL — is what makes the
      // file reachable later, via a short-lived signed URL.
      storage_path: storagePath ?? null,
      file_size_bytes: fileSizeBytes ?? null,
      uploaded_by: req.userId,
    })
    .select(`
      id,
      file_name,
      file_type,
      file_url,
      storage_path,
      file_size_bytes,
      created_at,
      child_id,
      record_id,
      appointment_id,
      uploaded_by,
      child_profiles!medical_files_child_id_fkey (
        id,
        first_name,
        last_name
      )
    `)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const [signed] = await signMedicalFiles(file ? [file] : []);
  res.status(201).json({ file: signed ?? file });
}

// ─── Delete file (uploader only) ─────────────────────────────────────────────

export async function deleteMedicalFile(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;

  const { data: existing } = await supabaseAdmin
    .from("medical_files")
    .select("id, uploaded_by, storage_path")
    .eq("id", id)
    .single();

  if (!existing) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  if (existing.uploaded_by !== req.userId) {
    res.status(403).json({ error: "You can only delete files you uploaded" });
    return;
  }

  const { error } = await supabaseAdmin.from("medical_files").delete().eq("id", id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Row gone, object gone: otherwise the bucket keeps patient documents that
  // nothing references and nobody can find to delete.
  await removeMedicalFile(existing.storage_path as string | null);

  res.status(204).send();
}
