import { ProtectedComingSoon } from "../../../../components/ProtectedComingSoon";

export default function AdminSubjectsPage() {
  return <ProtectedComingSoon role="ADMIN" section="Subjects" />;
}
