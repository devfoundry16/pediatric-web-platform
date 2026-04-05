import { z } from "zod";

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

export type CreateChildInput = {
  personalInfo: PersonalInfo;
  physicalInfo: PhysicalInfo;
  birthHistory: BirthHistory;
  healthBackground: HealthBackground;
  guardianInfo: GuardianInfo;
  lifestyle: LifestyleInfo;
  consent: ConsentInfo;
};

const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "prefer_not_to_say"]),
  nationality: z.string().nullable(),
  emiratesIdPassport: z.string().nullable(),
});

const physicalInfoSchema = z.object({
  weightKg: z.number().nullable(),
  heightCm: z.number().nullable(),
  headCircumferenceCm: z.number().nullable(),
  bloodType: z.string().nullable(),
});

const birthHistorySchema = z.object({
  placeOfBirth: z.string().nullable(),
  prematureBirth: z.boolean().nullable(),
  birthWeightKg: z.number().nullable(),
  deliveryType: z.enum(["normal", "c_section"]).nullable(),
  nicuStay: z.boolean().nullable(),
  nicuDuration: z.string().nullable(),
});

const healthBackgroundSchema = z
  .object({
    allergiesPresent: z.boolean(),
    allergiesDetails: z.string().nullable(),
    chronicConditionsPresent: z.boolean(),
    chronicConditionsDetails: z.string().nullable(),
    surgeriesPresent: z.boolean(),
    surgeriesDetails: z.string().nullable(),
    medicationsPresent: z.boolean(),
    medicationsDetails: z.string().nullable(),
    vaccinationStatus: z
      .enum(["up_to_date", "partial", "not_sure"])
      .nullable(),
    familyMedicalHistory: z.string().nullable(),
  })
  .superRefine((data, ctx) => {
    const checks: Array<{
      present: boolean;
      details: string | null;
      path: (string | number)[];
    }> = [
      {
        present: data.allergiesPresent,
        details: data.allergiesDetails,
        path: ["allergiesDetails"],
      },
      {
        present: data.chronicConditionsPresent,
        details: data.chronicConditionsDetails,
        path: ["chronicConditionsDetails"],
      },
      {
        present: data.surgeriesPresent,
        details: data.surgeriesDetails,
        path: ["surgeriesDetails"],
      },
      {
        present: data.medicationsPresent,
        details: data.medicationsDetails,
        path: ["medicationsDetails"],
      },
    ];
    for (const { present, details, path } of checks) {
      if (present && !(details?.trim().length)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide details",
          path,
        });
      }
    }
  });

const uaeMobileRegex = /^(\+971|00971|0)?[0-9]{9,10}$/;

const guardianInfoSchema = z.object({
  guardianName: z.string().min(1, "Guardian name is required"),
  guardianRelationship: z.enum(["mother", "father", "guardian"]),
  guardianMobile: z
    .string()
    .min(1, "Mobile number is required")
    .refine((v) => uaeMobileRegex.test(v.replace(/\s/g, "")), {
      message: "Enter a valid UAE mobile number",
    }),
  guardianEmail: z
    .string()
    .min(1, "Email is required")
    .pipe(z.email("Enter a valid email")),
  secondaryContactPhone: z.string().nullable(),
  emergencyContactName: z.string().nullable(),
  emergencyContactPhone: z.string().nullable(),
});

const lifestyleSchema = z.object({
  schoolNurseryName: z.string().nullable(),
  gradeAgeGroup: z.string().nullable(),
  smokingExposureHome: z.boolean().nullable(),
  screenTimeHoursPerDay: z.number().nullable(),
  physicalActivityLevel: z
    .enum(["low", "moderate", "high"])
    .nullable(),
});

const consentSchema = z.object({
  consentLegalGuardian: z.boolean().refine((v) => v === true, {
    message: "You must confirm legal guardianship",
  }),
  consentDataStorage: z.boolean().refine((v) => v === true, {
    message: "You must consent to data storage",
  }),
  consentTerms: z.boolean().refine((v) => v === true, {
    message: "You must agree to Terms & Privacy",
  }),
});

export const childProfileFormSchema = z.object({
  personalInfo: personalInfoSchema,
  physicalInfo: physicalInfoSchema,
  birthHistory: birthHistorySchema,
  healthBackground: healthBackgroundSchema,
  guardianInfo: guardianInfoSchema,
  lifestyle: lifestyleSchema,
  consent: consentSchema,
});

export type ChildProfileFormValues = z.infer<typeof childProfileFormSchema>;

/** Per-step validation (multi-step form next button) */
export const childFormStepSchemas = [
  childProfileFormSchema.pick({
    personalInfo: true,
    physicalInfo: true,
    birthHistory: true,
  }),
  childProfileFormSchema.pick({
    healthBackground: true,
    lifestyle: true,
  }),
  childProfileFormSchema.pick({
    guardianInfo: true,
  }),
  childProfileFormSchema.pick({
    consent: true,
  }),
] as const;

/** Default empty shape for "add child" form */
export function getDefaultChildFormValues(): ChildProfileFormValues {
  return {
    personalInfo: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "prefer_not_to_say",
      nationality: null,
      emiratesIdPassport: null,
    },
    physicalInfo: {
      weightKg: null,
      heightCm: null,
      headCircumferenceCm: null,
      bloodType: null,
    },
    birthHistory: {
      placeOfBirth: null,
      prematureBirth: null,
      birthWeightKg: null,
      deliveryType: null,
      nicuStay: null,
      nicuDuration: null,
    },
    healthBackground: {
      allergiesPresent: false,
      allergiesDetails: null,
      chronicConditionsPresent: false,
      chronicConditionsDetails: null,
      surgeriesPresent: false,
      surgeriesDetails: null,
      medicationsPresent: false,
      medicationsDetails: null,
      vaccinationStatus: null,
      familyMedicalHistory: null,
    },
    guardianInfo: {
      guardianName: "",
      guardianRelationship: "mother",
      guardianMobile: "",
      guardianEmail: "",
      secondaryContactPhone: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
    },
    lifestyle: {
      schoolNurseryName: null,
      gradeAgeGroup: null,
      smokingExposureHome: null,
      screenTimeHoursPerDay: null,
      physicalActivityLevel: null,
    },
    consent: {
      consentLegalGuardian: false,
      consentDataStorage: false,
      consentTerms: false,
    },
  };
}

export function profileToFormValues(
  profile: ChildProfile
): ChildProfileFormValues {
  return {
    personalInfo: { ...profile.personalInfo },
    physicalInfo: { ...profile.physicalInfo },
    birthHistory: { ...profile.birthHistory },
    healthBackground: { ...profile.healthBackground },
    guardianInfo: { ...profile.guardianInfo },
    lifestyle: { ...profile.lifestyle },
    consent: {
      consentLegalGuardian: profile.consent.consentLegalGuardian,
      consentDataStorage: profile.consent.consentDataStorage,
      consentTerms: profile.consent.consentTerms,
    },
  };
}

export function formValuesToCreateInput(
  values: ChildProfileFormValues
): CreateChildInput {
  return {
    personalInfo: values.personalInfo,
    physicalInfo: values.physicalInfo,
    birthHistory: values.birthHistory,
    healthBackground: values.healthBackground,
    guardianInfo: values.guardianInfo,
    lifestyle: values.lifestyle,
    consent: {
      consentLegalGuardian: values.consent.consentLegalGuardian,
      consentDataStorage: values.consent.consentDataStorage,
      consentTerms: values.consent.consentTerms,
    },
  };
}

