import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import type {
  ChildProfile,
  ChildProfileRow,
  CreateChildInput,
} from "../types/child";

function num(
  v: string | number | null | undefined
): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function rowToProfile(row: ChildProfileRow): ChildProfile {
  return {
    id: row.id,
    parentId: row.parent_id,
    personalInfo: {
      firstName: row.first_name,
      lastName: row.last_name,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      nationality: row.nationality,
      emiratesIdPassport: row.emirates_id_passport,
    },
    physicalInfo: {
      weightKg: num(row.weight_kg),
      heightCm: num(row.height_cm),
      headCircumferenceCm: num(row.head_circumference_cm),
      bloodType: row.blood_type,
    },
    birthHistory: {
      placeOfBirth: row.place_of_birth,
      prematureBirth: row.premature_birth,
      birthWeightKg: num(row.birth_weight_kg),
      deliveryType: row.delivery_type,
      nicuStay: row.nicu_stay,
      nicuDuration: row.nicu_duration,
    },
    healthBackground: {
      allergiesPresent: row.allergies_present,
      allergiesDetails: row.allergies_details,
      chronicConditionsPresent: row.chronic_conditions_present,
      chronicConditionsDetails: row.chronic_conditions_details,
      surgeriesPresent: row.surgeries_present,
      surgeriesDetails: row.surgeries_details,
      medicationsPresent: row.medications_present,
      medicationsDetails: row.medications_details,
      vaccinationStatus: row.vaccination_status,
      familyMedicalHistory: row.family_medical_history,
    },
    guardianInfo: {
      guardianName: row.guardian_name,
      guardianRelationship: row.guardian_relationship,
      guardianMobile: row.guardian_mobile,
      guardianEmail: row.guardian_email,
      secondaryContactPhone: row.secondary_contact_phone,
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
    },
    lifestyle: {
      schoolNurseryName: row.school_nursery_name,
      gradeAgeGroup: row.grade_age_group,
      smokingExposureHome: row.smoking_exposure_home,
      screenTimeHoursPerDay: num(row.screen_time_hours_per_day),
      physicalActivityLevel: row.physical_activity_level,
    },
    consent: {
      consentLegalGuardian: row.consent_legal_guardian,
      consentDataStorage: row.consent_data_storage,
      consentTerms: row.consent_terms,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function inputToInsert(parentId: string, input: CreateChildInput) {
  const p = input.personalInfo;
  const ph = input.physicalInfo;
  const b = input.birthHistory;
  const h = input.healthBackground;
  const g = input.guardianInfo;
  const l = input.lifestyle;
  const c = input.consent;

  return {
    parent_id: parentId,
    first_name: p.firstName,
    last_name: p.lastName,
    date_of_birth: p.dateOfBirth,
    gender: p.gender,
    nationality: p.nationality ?? null,
    emirates_id_passport: p.emiratesIdPassport ?? null,
    weight_kg: ph.weightKg,
    height_cm: ph.heightCm,
    head_circumference_cm: ph.headCircumferenceCm,
    blood_type: ph.bloodType ?? null,
    place_of_birth: b.placeOfBirth ?? null,
    premature_birth: b.prematureBirth,
    birth_weight_kg: b.birthWeightKg,
    delivery_type: b.deliveryType,
    nicu_stay: b.nicuStay,
    nicu_duration: b.nicuDuration ?? null,
    allergies_present: h.allergiesPresent,
    allergies_details: h.allergiesDetails ?? null,
    chronic_conditions_present: h.chronicConditionsPresent,
    chronic_conditions_details: h.chronicConditionsDetails ?? null,
    surgeries_present: h.surgeriesPresent,
    surgeries_details: h.surgeriesDetails ?? null,
    medications_present: h.medicationsPresent,
    medications_details: h.medicationsDetails ?? null,
    vaccination_status: h.vaccinationStatus,
    family_medical_history: h.familyMedicalHistory ?? null,
    school_nursery_name: l.schoolNurseryName ?? null,
    grade_age_group: l.gradeAgeGroup ?? null,
    smoking_exposure_home: l.smokingExposureHome,
    screen_time_hours_per_day: l.screenTimeHoursPerDay,
    physical_activity_level: l.physicalActivityLevel,
    guardian_name: g.guardianName,
    guardian_relationship: g.guardianRelationship,
    guardian_mobile: g.guardianMobile,
    guardian_email: g.guardianEmail,
    secondary_contact_phone: g.secondaryContactPhone ?? null,
    emergency_contact_name: g.emergencyContactName ?? null,
    emergency_contact_phone: g.emergencyContactPhone ?? null,
    consent_legal_guardian: c.consentLegalGuardian,
    consent_data_storage: c.consentDataStorage,
    consent_terms: c.consentTerms,
  };
}

function isCreateChildInput(body: unknown): body is CreateChildInput {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  return (
    typeof o.personalInfo === "object" &&
    o.personalInfo !== null &&
    typeof o.physicalInfo === "object" &&
    o.physicalInfo !== null &&
    typeof o.birthHistory === "object" &&
    o.birthHistory !== null &&
    typeof o.healthBackground === "object" &&
    o.healthBackground !== null &&
    typeof o.guardianInfo === "object" &&
    o.guardianInfo !== null &&
    typeof o.lifestyle === "object" &&
    o.lifestyle !== null &&
    typeof o.consent === "object" &&
    o.consent !== null
  );
}

/**
 * Backstop validation for date of birth (the client also enforces this via the
 * date picker's `max` and the Zod schema, but those can be bypassed). Returns
 * an error string, or null if valid. A 1-day tolerance beyond "now" absorbs
 * timezone differences so a legitimate newborn registered around midnight is
 * never falsely rejected, while clearly-future dates are blocked.
 */
function validateDateOfBirth(input: CreateChildInput): string | null {
  const dob = input.personalInfo?.dateOfBirth;
  if (!dob) return "Date of birth is required";
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return "Date of birth is invalid";
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  if (parsed.getTime() - Date.now() > ONE_DAY_MS) {
    return "Date of birth cannot be in the future";
  }
  return null;
}

export async function listChildren(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }
  const parentId = req.userId!;
  const { data, error } = await supabaseAdmin
    .from("child_profiles")
    .select("*")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = (data ?? []) as ChildProfileRow[];
  res.json(rows.map(rowToProfile));
}

export async function createChild(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }
  const parentId = req.userId!;

  if (!isCreateChildInput(req.body)) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const dobError = validateDateOfBirth(req.body);
  if (dobError) {
    res.status(400).json({ error: dobError });
    return;
  }

  const insert = inputToInsert(parentId, req.body);

  const { data, error } = await supabaseAdmin
    .from("child_profiles")
    .insert(insert)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json(rowToProfile(data as ChildProfileRow));
}

export async function getChild(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }
  const parentId = req.userId!;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("child_profiles")
    .select("*")
    .eq("id", id)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Child profile not found" });
    return;
  }

  res.json(rowToProfile(data as ChildProfileRow));
}

export async function updateChild(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }
  const parentId = req.userId!;
  const { id } = req.params;

  if (!isCreateChildInput(req.body)) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const dobError = validateDateOfBirth(req.body);
  if (dobError) {
    res.status(400).json({ error: dobError });
    return;
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("child_profiles")
    .select("id")
    .eq("id", id)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (fetchErr) {
    res.status(500).json({ error: fetchErr.message });
    return;
  }
  if (!existing) {
    res.status(404).json({ error: "Child profile not found" });
    return;
  }

  const row = inputToInsert(parentId, req.body);
  const { parent_id: _parentId, ...updateFields } = row;

  const { data, error } = await supabaseAdmin
    .from("child_profiles")
    .update(updateFields)
    .eq("id", id)
    .eq("parent_id", parentId)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json(rowToProfile(data as ChildProfileRow));
}

export async function deleteChild(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }
  const parentId = req.userId!;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("child_profiles")
    .delete()
    .eq("id", id)
    .eq("parent_id", parentId)
    .select("id");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data || data.length === 0) {
    res.status(404).json({ error: "Child profile not found" });
    return;
  }

  res.status(204).send();
}
