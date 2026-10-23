import { ProtectedComingSoon } from "../../../../components/ProtectedComingSoon";

export default function AdminTeachersPage() {
  return <ProtectedComingSoon role="ADMIN" section="Teachers" />;
}
