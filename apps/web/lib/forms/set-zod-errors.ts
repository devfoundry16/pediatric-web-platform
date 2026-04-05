import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import type { ZodError } from "zod";

/** Map Zod issues to react-hook-form field errors (nested paths with dots). */
export function setZodErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  zodError: ZodError
): void {
  for (const issue of zodError.issues) {
    const path = issue.path.join(".") as FieldPath<T>;
    setError(path, { type: "manual", message: issue.message });
  }
}
