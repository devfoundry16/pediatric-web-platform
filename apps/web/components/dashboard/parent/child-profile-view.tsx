"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { childrenApi } from "@/lib/api/children";
import type { ChildProfile } from "@/types/child";
import { Pencil, Trash2 } from "lucide-react";

interface ChildProfileViewProps {
  profile: ChildProfile;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid gap-1 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function ChildProfileView({ profile }: ChildProfileViewProps) {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const p = profile.personalInfo;
  const ph = profile.physicalInfo;
  const b = profile.birthHistory;
  const h = profile.healthBackground;
  const g = profile.guardianInfo;
  const l = profile.lifestyle;

  const handleDelete = async () => {
    try {
      await childrenApi.remove(profile.id);
      toast.success(t.childForm.deleted);
      router.push("/dashboard/parent/children");
      router.refresh();
    } catch {
      toast.error(t.childForm.loadError);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          {p.firstName} {p.lastName}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/parent/children/${profile.id}/edit`}>
              <Pencil className="me-2 h-4 w-4" />
              {t.childForm.editProfile}
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="me-2 h-4 w-4" />
                {t.childForm.deleteChild}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t.childForm.deleteConfirmTitle}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t.childForm.deleteConfirmDesc}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  {t.childForm.deleteChild}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.childForm.sectionPersonal}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Row label={t.patient.firstName} value={p.firstName} />
          <Row label={t.patient.lastName} value={p.lastName} />
          <Row label={t.patient.dateOfBirth} value={p.dateOfBirth} />
          <Row
            label={t.patient.gender}
            value={
              p.gender === "male"
                ? t.patient.male
                : p.gender === "female"
                  ? t.patient.female
                  : t.patient.preferNotToSay
            }
          />
          <Row label={t.patient.nationality} value={p.nationality ?? undefined} />
          <Row label={t.patient.emiratesId} value={p.emiratesIdPassport ?? undefined} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.childForm.sectionPhysical}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Row
            label={t.patient.weight}
            value={ph.weightKg != null ? String(ph.weightKg) : null}
          />
          <Row
            label={t.patient.height}
            value={ph.heightCm != null ? String(ph.heightCm) : null}
          />
          <Row
            label={t.patient.headCircumference}
            value={
              ph.headCircumferenceCm != null
                ? String(ph.headCircumferenceCm)
                : null
            }
          />
          <Row label={t.patient.bloodType} value={ph.bloodType} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.childForm.sectionBirth}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Row label={t.childForm.placeOfBirth} value={b.placeOfBirth} />
          <Row
            label={t.childForm.prematureBirth}
            value={
              b.prematureBirth === null
                ? t.childForm.notSpecified
                : b.prematureBirth
                  ? t.childForm.yes
                  : t.childForm.no
            }
          />
          <Row
            label={t.childForm.birthWeight}
            value={b.birthWeightKg != null ? String(b.birthWeightKg) : null}
          />
          <Row
            label={t.childForm.deliveryType}
            value={
              b.deliveryType === "normal"
                ? t.childForm.deliveryNormal
                : b.deliveryType === "c_section"
                  ? t.childForm.deliveryCsection
                  : null
            }
          />
          <Row
            label={t.childForm.nicuStay}
            value={
              b.nicuStay === null
                ? t.childForm.notSpecified
                : b.nicuStay
                  ? t.childForm.yes
                  : t.childForm.no
            }
          />
          <Row label={t.childForm.nicuDuration} value={b.nicuDuration} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.childForm.sectionHealth}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Row
            label={t.patient.allergies}
            value={
              h.allergiesPresent
                ? h.allergiesDetails ?? t.childForm.yes
                : t.childForm.no
            }
          />
          <Row
            label={t.patient.chronicConditions}
            value={
              h.chronicConditionsPresent
                ? h.chronicConditionsDetails ?? t.childForm.yes
                : t.childForm.no
            }
          />
          <Row
            label={t.patient.surgeries}
            value={
              h.surgeriesPresent
                ? h.surgeriesDetails ?? t.childForm.yes
                : t.childForm.no
            }
          />
          <Row
            label={t.patient.medications}
            value={
              h.medicationsPresent
                ? h.medicationsDetails ?? t.childForm.yes
                : t.childForm.no
            }
          />
          <Row
            label={t.patient.vaccinationStatus}
            value={
              h.vaccinationStatus === "up_to_date"
                ? t.patient.upToDate
                : h.vaccinationStatus === "partial"
                  ? t.patient.partial
                  : h.vaccinationStatus === "not_sure"
                    ? t.patient.notSure
                    : null
            }
          />
          <Row label={t.patient.familyHistory} value={h.familyMedicalHistory} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.childForm.sectionLifestyle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Row label={t.childForm.schoolNursery} value={l.schoolNurseryName} />
          <Row label={t.childForm.gradeAgeGroup} value={l.gradeAgeGroup} />
          <Row
            label={t.childForm.smokingExposure}
            value={
              l.smokingExposureHome === null
                ? t.childForm.notSpecified
                : l.smokingExposureHome
                  ? t.childForm.yes
                  : t.childForm.no
            }
          />
          <Row
            label={t.childForm.screenTime}
            value={
              l.screenTimeHoursPerDay != null
                ? String(l.screenTimeHoursPerDay)
                : null
            }
          />
          <Row
            label={t.childForm.physicalActivity}
            value={
              l.physicalActivityLevel === "low"
                ? t.childForm.activityLow
                : l.physicalActivityLevel === "moderate"
                  ? t.childForm.activityModerate
                  : l.physicalActivityLevel === "high"
                    ? t.childForm.activityHigh
                    : null
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.childForm.sectionGuardian}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Row label={t.patient.guardianName} value={g.guardianName} />
          <Row
            label={t.patient.relationship}
            value={
              g.guardianRelationship === "mother"
                ? t.patient.mother
                : g.guardianRelationship === "father"
                  ? t.patient.father
                  : t.patient.guardian
            }
          />
          <Row label={t.patient.mobileNumber} value={g.guardianMobile} />
          <Row label={t.common.email} value={g.guardianEmail} />
          <Row
            label={t.childForm.secondaryContact}
            value={g.secondaryContactPhone}
          />
          <Row label={t.patient.emergencyContact} value={g.emergencyContactName} />
          <Row label={t.patient.emergencyPhone} value={g.emergencyContactPhone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.childForm.sectionConsent}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            {profile.consent.consentLegalGuardian ? "✓" : "—"}{" "}
            {t.patient.legalGuardianConfirm}
          </p>
          <p>
            {profile.consent.consentDataStorage ? "✓" : "—"}{" "}
            {t.patient.consentDataStorage}
          </p>
          <p>
            {profile.consent.consentTerms ? "✓" : "—"}{" "}
            {t.patient.agreeTermsPrivacy}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
