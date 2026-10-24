"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ellipsis, KeyRound, LockKeyhole, LogOut, Mail, ShieldCheck, Unlock, UserPlus, UserRound } from "lucide-react";
import { ApiError } from "../../../lib/api";
import { createAdminUser, resetUserPassword } from "../api";
import { useUrlState } from "../../../hooks/useUrlState";
import { useAuth } from "../../../providers/AuthProvider";
import { ConfirmDialog, DataTablePagination, EmptyState, ErrorState, Modal, SortableHeader, StatusBadge, TableSkeleton, TemporaryPasswordPanel } from "../../../components/shared";
import { useChangeUserEmail, useForceLogoutUser, useUnlockUser, useUpdateUserStatus, useUsers, userKeys } from "../hooks";
import type { ManagedUser, UsersParams } from "../types";

const defaults = { page: "1", pageSize: "25", sortBy: "createdAt", order: "desc" };
const sortKeys = ["email", "createdAt", "lastLoginAt"] as const;
const emailSchema = z.object({ email: z.string().trim().email("Enter a valid email").transform((email) => email.toLowerCase()) });
const adminSchema = emailSchema.extend({ temporaryPassword: z.string().max(128, "Password is too long").optional() });
const tempPasswordSchema = z.object({ temporaryPassword: z.string().max(128, "Password is too long").optional() });
type EmailValues = z.infer<typeof emailSchema>;
type AdminValues = z.infer<typeof adminSchema>;
type TempValues = z.infer<typeof tempPasswordSchema>;
type DialogState =
  | { type: "add" }
  | { type: "reset"; user: ManagedUser }
  | { type: "email"; user: ManagedUser }
  | { type: "status"; user: ManagedUser; activate: boolean }
  | { type: "unlock" | "force"; user: ManagedUser }
  | null;

function relativeTime(value: string | null): string {
  if (!value) return "Never";
  const delta = new Date(value).getTime() - Date.now();
  const minutes = Math.round(delta / 60_000);
  if (Math.abs(minutes) < 60) return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(hours, "hour");
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(hours / 24), "day");
}

function asParams(values: Record<string, string | undefined>): UsersParams {
  const sortBy = sortKeys.includes(values.sortBy as typeof sortKeys[number]) ? values.sortBy as UsersParams["sortBy"] : "createdAt";
  const order = values.order === "asc" ? "asc" : "desc";
  return {
    page: Math.max(1, Number(values.page) || 1),
    pageSize: [10, 25, 50, 100].includes(Number(values.pageSize)) ? Number(values.pageSize) : 25,
    sortBy,
    order,
    ...(values.search ? { search: values.search } : {}),
    ...(values.role === "ADMIN" || values.role === "TEACHER" || values.role === "STUDENT" ? { role: values.role } : {}),
    ...(values.isActive === "true" || values.isActive === "false" ? { isActive: values.isActive } : {}),
    ...(values.state === "locked" || values.state === "mustChange" ? { state: values.state } : {}),
  };
}

function apiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function FormError({ id, children }: Readonly<{ id: string; children?: string }>) {
  return children ? <p id={id} role="alert" className="mt-1 text-sm text-rose-700">{children}</p> : null;
}

export function UsersPage() {
  const url = useUrlState(defaults);
  const params = asParams(url.values);
  const users = useUsers(params);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const changeEmail = useChangeUserEmail();
  const updateStatus = useUpdateUserStatus();
  const unlock = useUnlockUser();
  const forceLogout = useForceLogoutUser();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [passwordOnce, setPasswordOnce] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<{ message: string; href?: string } | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const adminForm = useForm<AdminValues>({ resolver: zodResolver(adminSchema) });
  const emailForm = useForm<EmailValues>({ resolver: zodResolver(emailSchema) });
  const resetForm = useForm<TempValues>({ resolver: zodResolver(tempPasswordSchema) });

  function closeDialog() {
    setDialog(null);
    setPasswordOnce(null);
    setEmailError("");
    setReason("");
    setActionError(null);
    adminForm.reset();
    emailForm.reset();
    resetForm.reset();
  }

  function openDialog(next: DialogState) {
    setEmailError("");
    setActionError(null);
    setReason("");
    setPasswordOnce(null);
    adminForm.reset();
    emailForm.reset();
    resetForm.reset();
    setDialog(next);
  }

  async function submitAdmin(values: AdminValues) {
    setEmailError("");
    try {
      setCreatePending(true);
      const created = await createAdminUser({
        email: values.email,
        ...(values.temporaryPassword ? { temporaryPassword: values.temporaryPassword } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
      setPasswordOnce(created.temporaryPassword);
      toast.success("Admin account created");
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_TAKEN") {
        setEmailError("This email is already in use.");
        adminForm.setError("email", { message: "This email is already in use." });
      } else adminForm.setError("root.server", { message: apiMessage(error, "Could not create the admin account.") });
    } finally { setCreatePending(false); }
  }

  async function submitReset(values: TempValues) {
    if (dialog?.type !== "reset") return;
    try {
      setResetPending(true);
      const result = await resetUserPassword(dialog.user.id, values.temporaryPassword);
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
      setPasswordOnce(result.temporaryPassword);
      toast.success("Password reset");
    } catch (error) {
      resetForm.setError("root.server", { message: error instanceof ApiError && error.code === "USE_CHANGE_PASSWORD" ? "Use the profile password form to change your own password." : apiMessage(error, "Could not reset the password.") });
    } finally { setResetPending(false); }
  }

  async function submitEmail(values: EmailValues) {
    if (dialog?.type !== "email") return;
    setEmailError("");
    try {
      await changeEmail.mutateAsync({ id: dialog.user.id, email: values.email });
      toast.success("Email address updated");
      closeDialog();
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_TAKEN") {
        setEmailError("This email is already in use.");
        emailForm.setError("email", { message: "This email is already in use." });
      } else emailForm.setError("root.server", { message: apiMessage(error, "Could not change the email address.") });
    }
  }

  async function confirmStatus() {
    if (dialog?.type !== "status") return;
    try {
      await updateStatus.mutateAsync({
        id: dialog.user.id,
        isActive: dialog.activate,
        ...(!dialog.activate && reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast.success(dialog.activate ? "Account activated" : "Account deactivated");
      closeDialog();
    } catch (error) {
      if (error instanceof ApiError && error.code === "CANNOT_DEACTIVATE_SELF") {
        setActionError({ message: "You cannot deactivate your own account." });
      } else if (error instanceof ApiError && error.code === "LAST_ADMIN") {
        setActionError({ message: "This is the last active admin account. Add or activate another admin first." });
      } else if (error instanceof ApiError && error.code === "PERSON_NOT_ACTIVE") {
        const person = dialog.user.person;
        const href = person ? `/admin/${person.type === "STUDENT" ? "students" : "teachers"}/${encodeURIComponent(person.id)}` : undefined;
        setActionError({ message: "Update the linked person's status from their page before activating this account.", href });
      } else setActionError({ message: apiMessage(error, "Could not update this account.") });
    }
  }

  async function confirmSimpleAction() {
    if (dialog?.type !== "unlock" && dialog?.type !== "force") return;
    try {
      if (dialog.type === "unlock") {
        await unlock.mutateAsync(dialog.user.id);
        toast.success("Account unlocked");
      } else {
        await forceLogout.mutateAsync(dialog.user.id);
        toast.success("User signed out everywhere");
      }
      closeDialog();
    } catch (error) {
      toast.error(apiMessage(error, "Could not complete the account action."));
    }
  }

  const pending = createPending || resetPending || changeEmail.isPending || updateStatus.isPending || unlock.isPending || forceLogout.isPending;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">Manage login accounts, access, and account security.</p></div>
      <button type="button" onClick={() => openDialog({ type: "add" })} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"><UserPlus size={17} /> Add admin</button>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium text-slate-700">Search
          <input aria-label="Search users" value={url.values.search ?? ""} onChange={(event) => url.updateSearch(event.target.value)} placeholder="Email, name, or number" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">Role
          <select value={url.values.role ?? ""} onChange={(event) => url.update({ role: event.target.value || null })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">All roles</option><option value="ADMIN">Admin</option><option value="TEACHER">Teacher</option><option value="STUDENT">Student</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Status
          <select value={url.values.isActive ?? ""} onChange={(event) => url.update({ isActive: event.target.value || null })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">State
          <select value={url.values.state ?? ""} onChange={(event) => url.update({ state: event.target.value || null })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">All states</option><option value="locked">Locked</option><option value="mustChange">Must change password</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Sort by
          <select value={params.sortBy} onChange={(event) => url.update({ sortBy: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="email">Email</option><option value="createdAt">Created at</option><option value="lastLoginAt">Last login</option>
          </select>
        </label>
        <button type="button" onClick={() => url.update({ order: params.order === "asc" ? "desc" : "asc" }, false)} className="self-end rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" aria-label={`Sort ${params.order === "asc" ? "descending" : "ascending"}`}>
          Order: {params.order === "asc" ? "Ascending" : "Descending"}
        </button>
        <div className="flex items-end"><button type="button" onClick={url.clear} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear filters</button></div>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {users.isError ? <ErrorState title="Could not load users" error={users.error} retry={() => void users.refetch()} /> : users.isLoading ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><TableSkeleton columns={7} /></table></div> : !users.data?.data.length ? <EmptyState title="No user accounts found" description="Adjust your filters or create an admin account." /> : <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <SortableHeader label="Email" sortKey="email" current={params.sortBy} order={params.order} onSort={(key) => url.update({ sortBy: key, order: params.order === "asc" ? "desc" : "asc" })} />
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Role</th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Linked person</th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Status</th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Flags</th>
                <SortableHeader label="Last login" sortKey="lastLoginAt" current={params.sortBy} order={params.order} onSort={(key) => url.update({ sortBy: key, order: params.order === "asc" ? "desc" : "asc" })} />
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.data.data.map((entry) => <tr key={entry.id} className="align-top">
                <td className="px-4 py-4 font-medium text-slate-900">{entry.email}</td>
                <td className="px-4 py-4"><StatusBadge label={entry.role} color="indigo" /></td>
                <td className="px-4 py-4">{entry.person ? <Link href={`/admin/${entry.person.type === "STUDENT" ? "students" : "teachers"}/${encodeURIComponent(entry.person.id)}`} className="inline-flex items-start gap-2 text-indigo-700 hover:underline"><UserRound size={16} className="mt-0.5" /><span>{entry.person.name}<span className="block text-xs text-slate-500">{entry.person.number}</span></span></Link> : <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-4"><StatusBadge label={entry.isActive ? "Active" : "Inactive"} color={entry.isActive ? "green" : "gray"} /></td>
                <td className="max-w-64 px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {entry.isLocked && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900"><LockKeyhole size={13} />{entry.lockedUntil ? <time dateTime={entry.lockedUntil} title={new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(entry.lockedUntil))}>Locked until {relativeTime(entry.lockedUntil)}</time> : "Locked"}</span>}
                    {entry.mustChangePassword && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-900"><ShieldCheck size={13} />Must change password</span>}
                    {!entry.isLocked && !entry.mustChangePassword && <span className="text-slate-400">—</span>}
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-600">{entry.lastLoginAt ? <time dateTime={entry.lastLoginAt} title={new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(entry.lastLoginAt))}>{relativeTime(entry.lastLoginAt)}</time> : "Never"}</td>
                <td className="px-4 py-3"><details className="relative">
                  <summary aria-label={`Actions for ${entry.email}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden"><Ellipsis size={19} /></summary>
                  <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    <ActionButton icon={KeyRound} label="Reset password" disabled={entry.id === currentUser?.id} title={entry.id === currentUser?.id ? "Use your profile to change your password" : undefined} onClick={() => openDialog({ type: "reset", user: entry })} />
                    <ActionButton icon={Mail} label="Change email" onClick={() => { openDialog({ type: "email", user: entry }); emailForm.setValue("email", entry.email); }} />
                    {entry.isLocked && <ActionButton icon={Unlock} label="Unlock account" onClick={() => openDialog({ type: "unlock", user: entry })} />}
                    <ActionButton icon={LogOut} label="Force logout" onClick={() => openDialog({ type: "force", user: entry })} />
                    <ActionButton icon={entry.isActive ? LockKeyhole : ShieldCheck} label={entry.isActive ? "Deactivate" : "Activate"} disabled={entry.isActive && entry.id === currentUser?.id} title={entry.isActive && entry.id === currentUser?.id ? "You cannot deactivate your own account" : undefined} destructive={entry.isActive} onClick={() => openDialog({ type: "status", user: entry, activate: !entry.isActive })} />
                  </div>
                </details></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <DataTablePagination page={users.data.meta.page} pageSize={users.data.meta.pageSize} total={users.data.meta.total} totalPages={users.data.meta.totalPages}
          onPage={(page) => url.update({ page }, false)} onPageSize={(pageSize) => url.update({ pageSize, page: 1 }, false)} />
      </>}
    </section>

    {dialog?.type === "add" && <Modal title={passwordOnce ? "Admin account created" : "Add admin account"} onClose={closeDialog} disableClose={pending || passwordOnce !== null} size="max-w-md">
      {passwordOnce ? <TemporaryPasswordPanel password={passwordOnce} email={adminForm.getValues("email")} personType="admin" onDismiss={closeDialog} /> :
        <form onSubmit={adminForm.handleSubmit((values) => void submitAdmin(values))} className="space-y-4" noValidate>
          <FormField label="Email address" name="admin-email" errorId="admin-email-error" error={emailError || adminForm.formState.errors.email?.message}><input id="admin-email" type="email" autoComplete="email" aria-invalid={Boolean(emailError || adminForm.formState.errors.email)} aria-describedby={emailError || adminForm.formState.errors.email ? "admin-email-error" : undefined} {...adminForm.register("email")} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></FormField>
          <FormField label="Temporary password (optional; blank generates one)" name="admin-password" errorId="admin-password-error" error={adminForm.formState.errors.temporaryPassword?.message}><input id="admin-password" type="password" autoComplete="new-password" aria-describedby={adminForm.formState.errors.temporaryPassword ? "admin-password-error" : undefined} {...adminForm.register("temporaryPassword")} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></FormField>
          {adminForm.formState.errors.root?.server && <p role="alert" className="text-sm text-rose-700">{adminForm.formState.errors.root.server.message}</p>}
          <DialogActions busy={createPending} submitLabel="Create admin" onCancel={closeDialog} />
        </form>}
    </Modal>}

    {dialog?.type === "reset" && <Modal title={passwordOnce ? "Password reset" : "Reset password"} onClose={closeDialog} disableClose={pending || passwordOnce !== null} size="max-w-md">
      {passwordOnce ? <TemporaryPasswordPanel password={passwordOnce} email={dialog.user.email} personType="admin" onDismiss={closeDialog} /> :
        <form onSubmit={resetForm.handleSubmit((values) => void submitReset(values))} className="space-y-4" noValidate>
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">The user will be signed out everywhere and must choose a new password at next login.</p>
          <FormField label="Temporary password (optional; blank generates one)" name="reset-password" errorId="reset-password-error" error={resetForm.formState.errors.temporaryPassword?.message}><input id="reset-password" type="password" autoComplete="new-password" aria-describedby={resetForm.formState.errors.temporaryPassword ? "reset-password-error" : undefined} {...resetForm.register("temporaryPassword")} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></FormField>
          {resetForm.formState.errors.root?.server && <p role="alert" className="text-sm text-rose-700">{resetForm.formState.errors.root.server.message}</p>}
          <DialogActions busy={resetPending} submitLabel="Reset password" onCancel={closeDialog} />
        </form>}
    </Modal>}

    {dialog?.type === "email" && <Modal title="Change email address" onClose={closeDialog} disableClose={changeEmail.isPending} size="max-w-md">
      <form onSubmit={emailForm.handleSubmit((values) => void submitEmail(values))} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600">The user must use the new email address to log in.</p>
        <FormField label="New email address" name="change-email" errorId="change-email-error" error={emailError || emailForm.formState.errors.email?.message}><input id="change-email" type="email" autoComplete="email" aria-invalid={Boolean(emailError || emailForm.formState.errors.email)} aria-describedby={emailError || emailForm.formState.errors.email ? "change-email-error" : undefined} {...emailForm.register("email")} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></FormField>
        {emailForm.formState.errors.root?.server && <p role="alert" className="text-sm text-rose-700">{emailForm.formState.errors.root.server.message}</p>}
        <DialogActions busy={changeEmail.isPending} submitLabel="Save email" onCancel={closeDialog} />
      </form>
    </Modal>}

    {dialog?.type === "status" && <ConfirmDialog title={dialog.activate ? "Activate account" : "Deactivate account"}
      description={<div className="space-y-3"><p>{dialog.activate ? "This enables the user to sign in again." : "The user will be signed out immediately and will no longer be able to sign in."}</p>
        {!dialog.activate && <label className="block text-sm font-medium text-slate-700">Reason (optional)<textarea rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>}
        {actionError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{actionError.message} {actionError.href && <Link className="font-semibold underline" href={actionError.href}>Open linked person&apos;s page</Link>}</p>}
      </div>}
      onClose={closeDialog} onConfirm={() => void confirmStatus()} destructive={!dialog.activate} loading={updateStatus.isPending} confirmLabel={dialog.activate ? "Activate" : "Deactivate"} />}

    {(dialog?.type === "unlock" || dialog?.type === "force") && <ConfirmDialog title={dialog.type === "unlock" ? "Unlock account" : "Force sign out"}
      description={dialog.type === "unlock" ? `Clear the login lock for ${dialog.user.email}?` : `End all active sessions for ${dialog.user.email}?`}
      onClose={closeDialog} onConfirm={() => void confirmSimpleAction()} loading={unlock.isPending || forceLogout.isPending} confirmLabel={dialog.type === "unlock" ? "Unlock" : "Force logout"} />}
  </div>;
}

function FormField({ label, name, errorId, error, children }: Readonly<{ label: string; name: string; errorId: string; error?: string; children: React.ReactNode }>) {
  return <div><label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>{children}<FormError id={errorId}>{error}</FormError></div>;
}

function DialogActions({ busy, submitLabel, onCancel }: Readonly<{ busy: boolean; submitLabel: string; onCancel: () => void }>) {
  return <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
    <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
    <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Please wait…" : submitLabel}</button>
  </div>;
}

function ActionButton({ icon: Icon, label, onClick, disabled = false, title, destructive = false }: Readonly<{ icon: typeof KeyRound; label: string; onClick: () => void; disabled?: boolean; title?: string; destructive?: boolean }>) {
  return <button type="button" title={title} disabled={disabled} onClick={(event) => {
    const menu = event.currentTarget.closest("details");
    if (menu) menu.open = false;
    onClick();
  }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${destructive ? "text-rose-700 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"}`}>
    <Icon size={15} aria-hidden="true" />{label}{disabled && title && <span className="sr-only">{title}</span>}
  </button>;
}
