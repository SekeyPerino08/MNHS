import { RoleGuard } from "../../../../components/RoleGuard";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { TeacherClassesView } from "../../../../features/class-offerings/components/TeacherClassesView";

export default function TeacherClassesPage() {
  return <RoleGuard allowedRoles={["TEACHER"]}><DashboardLayout><TeacherClassesView /></DashboardLayout></RoleGuard>;
}
