"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, GraduationCap } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { HealthStatus } from "../../components/HealthStatus";
import { ApiError } from "../../lib/api";
import { dashboardPath } from "../../lib/auth";
import { useAuth } from "../../providers/AuthProvider";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (redirecting) return;
    if (!loading && user) {
      window.location.replace(user.mustChangePassword ? "/change-password" : dashboardPath(user.role));
    }
  }, [loading, redirecting, user]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try {
      const loggedInUser = await login(values);
      setRedirecting(true);
      window.location.assign(loggedInUser.mustChangePassword ? "/change-password" : dashboardPath(loggedInUser.role));
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Unable to sign in. Please try again.");
    }
  });

  if (loading || user || redirecting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" aria-label="Loading" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-slate-100 to-slate-100" />
      <div className="relative w-full max-w-md">
        <section className="rounded-3xl border border-white/80 bg-white p-8 shadow-xl shadow-slate-900/5 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
              <GraduationCap size={28} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              School Management System
            </h1>
            <p className="mt-2 text-sm text-slate-500">Sign in to continue</p>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                {...register("email")}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 aria-[invalid=true]:border-rose-500"
                placeholder="you@school.edu"
              />
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-sm text-rose-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password")}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 aria-[invalid=true]:border-rose-500"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-sm text-rose-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || redirecting}
              className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
          <HealthStatus />
        </section>
        <p className="mt-6 text-center text-xs text-slate-400">
          Secure access for students, teachers, and administrators
        </p>
      </div>
    </main>
  );
}
