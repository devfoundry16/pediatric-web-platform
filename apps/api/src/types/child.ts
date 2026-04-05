/** API response shape (nested). Matches web `ChildProfile`. */

export type Gender = "male" | "female" | "prefer_not_to_say";
export type GuardianRelationship = "mother" | "father" | "guardian";
export type DeliveryType = "normal" | "c_section";
export type VaccinationStatus = "up_to_date" | "partial" | "not_sure";
export type PhysicalActivityLevel = "low" | "moderate" | "high";

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  nationality: string | null;
  emiratesIdPassport: string | null;
}

export interface PhysicalInfo {
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
  bloodType: string | null;
}

export interface BirthHistory {
  placeOfBirth: string | null;
  prematureBirth: boolean | null;
  birthWeightKg: number | null;
  deliveryType: DeliveryType | null;
  nicuStay: boolean | null;
  nicuDuration: string | null;
}

export interface HealthBackground {
  allergiesPresent: boolean;
  allergiesDetails: string | null;
  chronicConditionsPresent: boolean;
  chronicConditionsDetails: string | null;
  surgeriesPresent: boolean;
  surgeriesDetails: string | null;
  medicationsPresent: boolean;
  medicationsDetails: string | null;
  vaccinationStatus: VaccinationStatus | null;
  familyMedicalHistory: string | null;
}

export interface GuardianInfo {
  guardianName: string;
  guardianRelationship: GuardianRelationship;
  guardianMobile: string;
  guardianEmail: string;
  secondaryContactPhone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export interface LifestyleInfo {
  schoolNurseryName: string | null;
  gradeAgeGroup: string | null;
  smokingExposureHome: boolean | null;
  screenTimeHoursPerDay: number | null;
  physicalActivityLevel: PhysicalActivityLevel | null;
}

export interface ConsentInfo {
  consentLegalGuardian: boolean;
  consentDataStorage: boolean;
  consentTerms: boolean;
}

export interface ChildProfile {
  id: string;
  parentId: string;
  personalInfo: PersonalInfo;
  physicalInfo: PhysicalInfo;
  birthHistory: BirthHistory;
  healthBackground: HealthBackground;
  guardianInfo: GuardianInfo;
  lifestyle: LifestyleInfo;
  consent: ConsentInfo;
  createdAt: string;
  updatedAt: string;
}

/** Request body for create / full replace update */
export interface CreateChildInput {
  personalInfo: PersonalInfo;
  physicalInfo: PhysicalInfo;
  birthHistory: BirthHistory;
  healthBackground: HealthBackground;
  guardianInfo: GuardianInfo;
  lifestyle: LifestyleInfo;
  consent: ConsentInfo;
}

/** Database row (snake_case) from Supabase */
export interface ChildProfileRow {
  id: string;
  parent_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: Gender;
  nationality: string | null;
  emirates_id_passport: string | null;
  weight_kg: string | number | null;
  height_cm: string | number | null;
  head_circumference_cm: string | number | null;
  blood_type: string | null;
  place_of_birth: string | null;
  premature_birth: boolean | null;
  birth_weight_kg: string | number | null;
  delivery_type: DeliveryType | null;
  nicu_stay: boolean | null;
  nicu_duration: string | null;
  allergies_present: boolean;
  allergies_details: string | null;
  chronic_conditions_present: boolean;
  chronic_conditions_details: string | null;
  surgeries_present: boolean;
  surgeries_details: string | null;
  medications_present: boolean;
  medications_details: string | null;
  vaccination_status: VaccinationStatus | null;
  family_medical_history: string | null;
  school_nursery_name: string | null;
  grade_age_group: string | null;
  smoking_exposure_home: boolean | null;
  screen_time_hours_per_day: string | number | null;
  physical_activity_level: PhysicalActivityLevel | null;
  guardian_name: string;
  guardian_relationship: GuardianRelationship;
  guardian_mobile: string;
  guardian_email: string;
  secondary_contact_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  consent_legal_guardian: boolean;
  consent_data_storage: boolean;
  consent_terms: boolean;
  created_at: string;
  updated_at: string;
}
