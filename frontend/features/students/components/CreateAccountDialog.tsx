"use client";

import { CreateAccountDialog as SharedCreateAccountDialog } from "../../../components/shared";
import { useCreateStudentAccount } from "../hooks";

export function CreateAccountDialog({ studentId, onClose }: Readonly<{ studentId: string; onClose: () => void }>) {
  const account = useCreateStudentAccount();
  return <SharedCreateAccountDialog
    personType="student"
    onClose={onClose}
    isPending={account.isPending}
    createAccount={(input) => account.createAccount({ id: studentId, input })}
  />;
}
