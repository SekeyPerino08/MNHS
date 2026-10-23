import { ProtectedComingSoon } from "../../../../components/ProtectedComingSoon";

export default function AdminStudentsPage() {
  return <ProtectedComingSoon role="ADMIN" section="Students" />;
}
