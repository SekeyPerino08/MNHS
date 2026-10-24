import { RoleGuard } from "../../../../components/RoleGuard";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { EnrollmentPage } from "../../../../features/enrollment/components/EnrollmentPage";

export default function AdminEnrollmentPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><EnrollmentPage /></DashboardLayout></RoleGuard>;
}
