import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";

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

// ─── List records ─────────────────────────────────────────────────────────────

export async function listMedicalRecords(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const role = await getUserRole(req.userId);
  const { childId } = req.query;

  let query = supabaseAdmin
    .from("medical_records")
    .select(`
      id,
      record_type,
      title,
      notes,
      diagnosis,
      prescription,
      vitals,
      created_at,
      updated_at,
      appointment_id,
      child_id,
      child_profiles!medical_records_child_id_fkey (
        id,
        first_name,
        last_name,
        date_of_birth
      ),
      doctors!medical_records_doctor_id_fkey (
        id,
        full_name,
        specialty
      )
    `)
    .order("created_at", { ascending: false });

  if (role === "parent") {
    const childIds = await getParentChildIds(req.userId);
    if (childIds.length === 0) {
      res.json({ records: [] });
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
    query = query.eq("doctor_id", doctorId);
    if (childId) query = query.eq("child_id", childId as string);
  } else {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ records: data });
}

// ─── Get single record ────────────────────────────────────────────────────────

export async function getMedicalRecord(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;
  const role = await getUserRole(req.userId);

  const { data: record, error } = await supabaseAdmin
    .from("medical_records")
    .select(`
      id,
      record_type,
      title,
      notes,
      diagnosis,
      prescription,
      vitals,
      created_at,
      updated_at,
      appointment_id,
      child_id,
      child_profiles!medical_records_child_id_fkey (
        id,
        first_name,
        last_name,
        date_of_birth
      ),
      doctors!medical_records_doctor_id_fkey (
        id,
        full_name,
        specialty
      )
    `)
    .eq("id", id)
    .single();

  if (error || !record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  // Access check
  if (role === "parent") {
    const childIds = await getParentChildIds(req.userId);
    if (!childIds.includes(record.child_id)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } else if (role === "doctor") {
    const doctorId = await getDoctorId(req.userId);
    if ((record as { doctor_id?: string | null }).doctor_id !== doctorId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } else {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({ record });
}

// ─── Create record (doctor only) ─────────────────────────────────────────────

export async function createMedicalRecord(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const role = await getUserRole(req.userId);
  if (role !== "doctor") {
    res.status(403).json({ error: "Only doctors can create medical records" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Doctor profile not found" });
    return;
  }

  const { childId, appointmentId, recordType, title, notes, diagnosis, prescription, vitals } =
    req.body;

  if (!childId || !recordType || !title) {
    res.status(400).json({ error: "childId, recordType, and title are required" });
    return;
  }

  const validTypes = ["consultation_note", "prescription", "diagnosis", "vitals", "other"];
  if (!validTypes.includes(recordType)) {
    res.status(400).json({ error: `recordType must be one of: ${validTypes.join(", ")}` });
    return;
  }

  // Verify the child is actually one of this doctor's patients (has a
  // non-cancelled appointment with them). Without this a doctor could write
  // medical records for any child in the system by guessing child ids.
  const { data: patientAppt } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("child_id", childId)
    .not("status", "in", '("cancelled","rescheduled")')
    .limit(1)
    .maybeSingle();
  if (!patientAppt) {
    res.status(403).json({ error: "Child is not one of your patients" });
    return;
  }

  const { data: record, error } = await supabaseAdmin
    .from("medical_records")
    .insert({
      child_id: childId,
      doctor_id: doctorId,
      appointment_id: appointmentId ?? null,
      record_type: recordType,
      title,
      notes: notes ?? null,
      diagnosis: diagnosis ?? null,
      prescription: prescription ?? null,
      vitals: vitals ?? null,
      created_by: req.userId,
    })
    .select(`
      id,
      record_type,
      title,
      notes,
      diagnosis,
      prescription,
      vitals,
      created_at,
      updated_at,
      appointment_id,
      child_id,
      child_profiles!medical_records_child_id_fkey (
        id,
        first_name,
        last_name,
        date_of_birth
      ),
      doctors!medical_records_doctor_id_fkey (
        id,
        full_name,
        specialty
      )
    `)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ record });
}

// ─── Update record (doctor who created it) ───────────────────────────────────

export async function updateMedicalRecord(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;
  const role = await getUserRole(req.userId);
  if (role !== "doctor") {
    res.status(403).json({ error: "Only doctors can update medical records" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Doctor profile not found" });
    return;
  }

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from("medical_records")
    .select("id, doctor_id")
    .eq("id", id)
    .single();

  if (!existing) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  if (existing.doctor_id !== doctorId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { title, notes, diagnosis, prescription, vitals, recordType } = req.body;

  const patch: Record<string, unknown> = {};
  if (title !== undefined) patch.title = title;
  if (notes !== undefined) patch.notes = notes;
  if (diagnosis !== undefined) patch.diagnosis = diagnosis;
  if (prescription !== undefined) patch.prescription = prescription;
  if (vitals !== undefined) patch.vitals = vitals;
  if (recordType !== undefined) patch.record_type = recordType;

  const { data: record, error } = await supabaseAdmin
    .from("medical_records")
    .update(patch)
    .eq("id", id)
    .select(`
      id,
      record_type,
      title,
      notes,
      diagnosis,
      prescription,
      vitals,
      created_at,
      updated_at,
      appointment_id,
      child_id,
      child_profiles!medical_records_child_id_fkey (
        id,
        first_name,
        last_name,
        date_of_birth
      ),
      doctors!medical_records_doctor_id_fkey (
        id,
        full_name,
        specialty
      )
    `)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ record });
}

// ─── Delete record (doctor who created it) ───────────────────────────────────

export async function deleteMedicalRecord(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;
  const role = await getUserRole(req.userId);
  if (role !== "doctor") {
    res.status(403).json({ error: "Only doctors can delete medical records" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Doctor profile not found" });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("medical_records")
    .select("id, doctor_id")
    .eq("id", id)
    .single();

  if (!existing) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  if (existing.doctor_id !== doctorId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { error } = await supabaseAdmin.from("medical_records").delete().eq("id", id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(204).send();
}
