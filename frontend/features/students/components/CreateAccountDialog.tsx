"use client";

import { useState } from "react";
import { Check, Copy, LoaderCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../../../lib/api";
import { useCreateStudentAccount } from "../hooks";
import { Modal } from "./Modal";

export function CreateAccountDialog({
  studentId,
  onClose,
}: Readonly<{ studentId: string; onClose: () => void }>) {
  const createAccount = useCreateStudentAccount();
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [passwordOnce, setPasswordOnce] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const account = await createAccount.createAccount({
        id: studentId,
        input: { email, ...(temporaryPassword ? { temporaryPassword } : {}) },
      });
      setPasswordOnce(account.temporaryPassword);
      toast.success("Student account created");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not create the account");
    }
  }

  async function copyPassword() {
    if (!passwordOnce) return;
    try {
      await navigator.clipboard.writeText(passwordOnce);
      setCopied(true);
      toast.success("Temporary password copied");
    } catch {
      toast.error("Could not copy the password");
    }
  }

  return (
    <Modal
      title={passwordOnce ? "Account created" : "Create login account"}
      description={passwordOnce ? "Copy and share the credentials securely." : "Create a student login account."}
      onClose={onClose}
      disableClose={createAccount.isPending || passwordOnce !== null}
      size="max-w-md"
    >
      {passwordOnce ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex gap-3 text-sm font-semibold text-amber-950">
              <ShieldAlert className="shrink-0" size={19} />
              This password is shown only once. Share it securely and ask the student to change it.
            </div>
            <div className="mt-4 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-slate-900">{passwordOnce}</code>
              <button type="button" onClick={() => void copyPassword()} aria-label="Copy temporary password" className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-600">Login email: {email.trim().toLowerCase()}</p>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="account-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
            <input id="account-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="account-password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Temporary password <span className="font-normal text-slate-400">(leave blank to generate)</span>
            </label>
            <input id="account-password" type="password" minLength={8} maxLength={128} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" disabled={createAccount.isPending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={createAccount.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {createAccount.isPending && <LoaderCircle size={16} className="animate-spin" />}
              {createAccount.isPending ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
