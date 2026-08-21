"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import axios from "axios";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { StepIndicator } from "@/components/forms/step-indicator";
import { setZodErrors } from "@/lib/forms/set-zod-errors";
import { childrenApi } from "@/lib/api/children";
import { useI18n } from "@/lib/i18n/i18n-context";
import {
  createChildProfileFormSchema,
  createChildFormStepSchemas,
  formValuesToCreateInput,
  getDefaultChildFormValues,
  type ChildProfileFormValues,
} from "@/types/child";
import { StepPersonalInfo } from "./step-personal-info";
import { StepHealthHistory } from "./step-health-history";
import { StepGuardianInfo } from "./step-guardian-info";
import { StepConsent } from "./step-consent";

interface ChildFormProps {
  mode: "add" | "edit";
  childId?: string;
  /** When editing, pass loaded profile as form defaults */
  defaultValues?: ChildProfileFormValues;
}

export function ChildForm({
  mode,
  childId,
  defaultValues: defaultValuesProp,
}: ChildFormProps) {
  const router = useRouter();
  const { dictionary: t } = useI18n();
  const [step, setStep] = useState(0);

  const schema = useMemo(() => createChildProfileFormSchema(t), [t]);
  const stepSchemas = useMemo(() => createChildFormStepSchemas(t), [t]);

  const form = useForm<ChildProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValuesProp ?? getDefaultChildFormValues(),
    mode: "onTouched",
  });

  useEffect(() => {
    if (defaultValuesProp) {
      form.reset(defaultValuesProp);
    }
  }, [defaultValuesProp, form]);

  const steps = [
    { id: "personal", label: t.childForm.step1Title },
    { id: "health", label: t.childForm.step2Title },
    { id: "guardian", label: t.childForm.step3Title },
    { id: "consent", label: t.childForm.step4Title },
  ];

  const handleNext = () => {
    const stepSchema = stepSchemas[step];
    const parsed = stepSchema.safeParse(form.getValues());
    if (!parsed.success) {
      setZodErrors(form.setError, parsed.error);
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = async (values: ChildProfileFormValues) => {
    const body = formValuesToCreateInput(values);
    try {
      if (mode === "add") {
        await childrenApi.create(body);
      } else {
        if (!childId) {
          toast.error(t.childForm.missingChildId);
          return;
        }
        await childrenApi.update(childId, body);
      }
      toast.success(t.childForm.saved);
      router.push("/dashboard/parent/children");
      router.refresh();
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        const err = e.response?.data as { error?: string } | undefined;
        toast.error(err?.error ?? e.message ?? t.childForm.requestFailed);
      } else {
        toast.error(t.childForm.requestFailed);
      }
    }
  };

  const isLast = step === steps.length - 1;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-8"
      >
        <StepIndicator steps={steps} currentStep={step} />

        <div className="min-h-[320px]">
          {step === 0 ? <StepPersonalInfo control={form.control} /> : null}
          {step === 1 ? <StepHealthHistory control={form.control} /> : null}
          {step === 2 ? <StepGuardianInfo control={form.control} /> : null}
          {step === 3 ? <StepConsent control={form.control} /> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <Button type="button" variant="ghost" asChild>
            <Link href="/dashboard/parent/children">{t.common.cancel}</Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={handleBack}>
                {t.common.previous}
              </Button>
            ) : null}
            {!isLast ? (
              <Button type="button" onClick={handleNext}>
                {t.common.next}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t.childForm.saving}
                  </>
                ) : (
                  t.childForm.submit
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
