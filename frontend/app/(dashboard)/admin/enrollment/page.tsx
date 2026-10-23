import { ProtectedComingSoon } from "../../../../components/ProtectedComingSoon";

export default function AdminEnrollmentPage() {
  return <ProtectedComingSoon role="ADMIN" section="Enrollment" />;
}
