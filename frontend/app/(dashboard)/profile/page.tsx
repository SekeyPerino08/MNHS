"use client";

import { useState } from "react";
import { CalendarDays, KeyRound, ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ErrorState, StatusBadge } from "../../../components/shared";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { RoleGuard } from "../../../components/RoleGuard";
import { ChangePasswordForm } from "../../../features/profile/ChangePasswordForm";
import { useMyProfile } from "../../../features/profile/hooks";
import { useAuth } from "../../../providers/AuthProvider";

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function ProfileContent() {
  const profile = useMyProfile();
  const { logoutAll } = useAuth();
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  async function signOutAll() {
    setLogoutPending(true);
    try {
      await logoutAll();
      toast.success("Signed out of all devices");
    } catch {
      toast.error("Could not sign out of all devices. Please try again.");
    } finally {
      setLogoutPending(false);
      setConfirmLogoutAll(false);
    }
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Your account</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">Profile</h1>
      <p className="mt-1 text-sm text-slate-500">Review your account details and security settings.</p>
    </header>
    {profile.isLoading ? <div className="grid gap-5 md:grid-cols-2">
      {[0, 1, 2].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-slate-200" />)}
    </div> : profile.isError ? <ErrorState title="Could not load your profile" error={profile.error} retry={() => void profile.refetch()} />
      : profile.data && <>
        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><UserRound size={19} className="text-indigo-700" /><h2 className="font-semibold text-slate-900">Account</h2></div>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-slate-500">Email</dt><dd className="break-all font-medium text-slate-900">{profile.data.user.email}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-500">Role</dt><dd><StatusBadge label={profile.data.user.role} color="indigo" /></dd></div>
              <div><dt className="text-slate-500">Member since</dt><dd className="font-medium text-slate-900">{formatTimestamp(profile.data.user.createdAt)}</dd></div>
              <div><dt className="text-slate-500">Last login</dt><dd className="font-medium text-slate-900">{formatTimestamp(profile.data.user.lastLoginAt)}</dd></div>
              <div><dt className="text-slate-500">Password last changed</dt><dd className="font-medium text-slate-900">{formatTimestamp(profile.data.user.passwordChangedAt)}</dd></div>
            </dl>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><CalendarDays size={19} className="text-indigo-700" /><h2 className="font-semibold text-slate-900">Personal information</h2></div>
            {profile.data.person ? <dl className="mt-4 space-y-3 text-sm">
              {profile.data.person.type === "STUDENT" ? <>
                <ProfileField label="Student number" value={profile.data.person.studentNo} />
                <ProfileField label="Name" value={profile.data.person.fullName} />
                <ProfileField label="Current section" value={profile.data.person.currentSection ?? "Not enrolled"} />
              </> : <>
                <ProfileField label="Employee number" value={profile.data.person.employeeNo} />
                <ProfileField label="Name" value={profile.data.person.fullName} />
                <ProfileField label="Department" value={profile.data.person.department ?? "Not set"} />
                <ProfileField label="Contact number" value={profile.data.person.contactNo ?? "Not set"} />
              </>}
            </dl> : <p className="mt-4 text-sm text-slate-500">No linked personal information is available for this administrator account.</p>}
            <p className="mt-5 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">Read-only. To correct personal details or your email, contact an administrator.</p>
          </section>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><KeyRound size={19} className="text-indigo-700" /><h2 className="font-semibold text-slate-900">Security</h2></div>
          <div className="mt-5 max-w-xl"><ChangePasswordForm /></div>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="font-medium text-slate-900">Sign out of all devices</h3>
            <p className="mt-1 text-sm text-slate-500">This ends every active session, including this one.</p>
            <button type="button" onClick={() => setConfirmLogoutAll(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50">
              <ShieldAlert size={16} aria-hidden="true" /> Sign out everywhere
            </button>
          </div>
        </section>
      </>}
    {confirmLogoutAll && <ConfirmDialog title="Sign out of all devices"
      description="Every session, including this one, will end immediately. You will need to sign in again."
      onClose={() => setConfirmLogoutAll(false)} onConfirm={() => void signOutAll()}
      confirmLabel="Sign out everywhere" destructive loading={logoutPending} />}
  </div>;
}

function ProfileField({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-900">{value}</dd></div>;
}

export default function ProfilePage() {
  return <RoleGuard allowedRoles={["ADMIN", "TEACHER", "STUDENT"]}><DashboardLayout><ProfileContent /></DashboardLayout></RoleGuard>;
}
