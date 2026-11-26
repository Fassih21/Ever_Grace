import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function PatientGenderSelect({
  className,
  emptyLabel = "Not specified",
  ...props
}: Omit<ComponentProps<"select">, "children"> & { emptyLabel?: string }) {
  return (
    <select
      aria-label="Gender"
      className={cn(
        "h-9 rounded-md border border-input bg-background px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    >
      <option value="">{emptyLabel}</option>
      <option value="female">Female</option>
      <option value="male">Male</option>
      <option value="other">Other</option>
    </select>
  );
}
