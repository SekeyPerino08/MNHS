"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ApiError, apiFetch } from "../../lib/api";
import { dashboardPath } from "../../lib/auth";
import { useAuth } from "../../providers/AuthProvider";

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Use at least 8 characters")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
  confirmPassword: z.string().min(1, "Confirm your new password"),
}).superRefine((values, context) => {
  if (values.newPassword === values.currentPassword) {
    context.addIssue({ code: "custom", path: ["newPassword"], message: "New password must differ from your current password" });
  }
  if (values.newPassword !== values.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
  }
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;
const weakPasswords = new Set(["password1", "12345678a", "qwerty123", "school123", "admin1234"]);

function passwordErrorField(error: unknown): "currentPassword" | "newPassword" | "root.server" {
  if (!(error instanceof ApiError)) return "root.server";
  if (error.message.toLowerCase().includes("current password")) return "currentPassword";
  if (
    error.message.toLowerCase().includes("password") ||
    error.message.toLowerCase().includes("email")
  ) return "newPassword";
  return "root.server";
}

export function ChangePasswordForm({ forced = false }: Readonly<{ forced?: boolean }>) {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const { control, register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting } } =
    useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema), mode: "onChange" });
  const currentPassword = useWatch({ control, name: "currentPassword" }) ?? "";
  const newPassword = useWatch({ control, name: "newPassword" }) ?? "";
  const confirmPassword = useWatch({ control, name: "confirmPassword" }) ?? "";
  const emailName = user?.email.split("@")[0]?.toLowerCase() ?? "";
  const checks = [
    { label: "At least 8 characters", valid: newPassword.length >= 8 },
    { label: "Contains a letter", valid: /[A-Za-z]/.test(newPassword) },
    { label: "Contains a number", valid: /\d/.test(newPassword) },
    { label: "Differs from current password", valid: Boolean(newPassword) && newPassword !== currentPassword },
    { label: "Does not contain your email name", valid: !emailName || !newPassword.toLowerCase().includes(emailName) },
    { label: "Is not a commonly used password", valid: Boolean(newPassword) && !weakPasswords.has(newPassword.toLowerCase()) },
    { label: "Confirmation matches", valid: Boolean(confirmPassword) && newPassword === confirmPassword },
  ];

  const submit = handleSubmit(async ({ currentPassword: current, newPassword: next }) => {
    clearErrors();
    try {
      await apiFetch<void>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      toast.success("Password changed successfully");
      const updated = await refresh();
      if (forced && updated) router.replace(dashboardPath(updated.role));
    } catch (error) {
      const field = passwordErrorField(error);
      setError(field, {
        type: "server",
        message: error instanceof ApiError ? error.message : "Could not change password. Please try again.",
      });
    }
  });

  function passwordInput(name: "currentPassword" | "newPassword" | "confirmPassword", label: string, autoComplete: string) {
    const error = errors[name];
    const isVisible = visible[name] ?? false;
    const registerField = register(name);
    return (
      <div>
        <label htmlFor={`password-${name}`} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
        <div className="relative">
          <input
            id={`password-${name}`}
            type={isVisible ? "text" : "password"}
            autoComplete={autoComplete}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `password-${name}-error` : undefined}
            {...registerField}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-11 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 aria-[invalid=true]:border-rose-500"
          />
          <button
            type="button"
            aria-label={`${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            onClick={() => setVisible((state) => ({ ...state, [name]: !isVisible }))}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500"
          >{isVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        {error?.message && <p id={`password-${name}-error`} role="alert" className="mt-1 text-sm text-rose-700">{error.message}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
      {forced && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950">
        For your security, please choose a new password before continuing.
      </div>}
      {passwordInput("currentPassword", "Current password", "current-password")}
      {passwordInput("newPassword", "New password", "new-password")}
      <ul aria-label="New password requirements" className="grid gap-1 text-sm sm:grid-cols-2">
        {checks.map((check) => <li key={check.label} className="flex items-center gap-2 text-slate-700">
          {check.valid ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
          <span>{check.label}</span><span className="sr-only">{check.valid ? "met" : "not met"}</span>
        </li>)}
      </ul>
      {passwordInput("confirmPassword", "Confirm new password", "new-password")}
      {errors.root?.server && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{errors.root.server.message}</p>}
      <button type="submit" disabled={isSubmitting || checks.some((check) => !check.valid)}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "Updating password…" : "Change password"}
      </button>
    </form>
  );
}
