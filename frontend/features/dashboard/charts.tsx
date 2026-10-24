"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDisplayDate } from "../../lib/dates";
import type { AdminDashboardData, TeacherDashboardData } from "../../types/dashboard";
import { ChartCard } from "./components";

const COLORS = ["#4338ca", "#0e7490", "#b45309", "#be123c", "#15803d", "#6d28d9"];
const gridColor = "#cbd5e1";
const axisColor = "#64748b";
const tooltipStyle = { backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, color: "#0f172a" };

export function EnrollmentChart({ data }: Readonly<{ data: AdminDashboardData["enrollmentByGrade"] }>) {
  const rows = data.map((item) => ({ grade: `Grade ${item.gradeLevel}`, sections: item.sections, students: item.students }));
  return (
    <ChartCard
      title="Enrollment by grade level"
      description="Enrolled students and section counts"
      columns={[{ key: "grade", label: "Grade" }, { key: "sections", label: "Sections" }, { key: "students", label: "Students" }]}
      rows={rows}
      rowHref={() => "/admin/students"}
      action={<Link href="/admin/students" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">View students</Link>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 18, right: 12, left: -15, bottom: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="grade" tick={{ fill: axisColor, fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="students" name="Students" fill={COLORS[0]} radius={[5, 5, 0, 0]}>
            <LabelList dataKey="students" position="top" fill={axisColor} fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AttendanceTrendChart({ data }: Readonly<{ data: AdminDashboardData["attendanceTrend"] }>) {
  const rows = data.map((item) => ({ ...item, day: formatDisplayDate(item.date) }));
  return (
    <ChartCard
      title="Attendance, last recorded days"
      description="School-wide rate; days with no records are omitted"
      columns={[{ key: "day", label: "Date" }, { key: "present", label: "Present" }, { key: "absent", label: "Absent" }, { key: "late", label: "Late" }, { key: "excused", label: "Excused" }, { key: "rate", label: "Rate (%)" }]}
      rows={rows.map((row) => ({ ...row, rate: row.rate ?? "N/A" }))}
      rowHref={() => "/admin/sections"}
      action={<Link href="/admin/sections" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">View sections</Link>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 18, right: 12, left: -15, bottom: 34 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="day" angle={-25} textAnchor="end" interval="preserveStartEnd" height={55} tick={{ fill: axisColor, fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fill: axisColor, fontSize: 11 }} tickFormatter={(value: number) => `${value}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value ?? "N/A"}%`, "Rate"]} />
          <Line type="monotone" dataKey="rate" name="Attendance rate" stroke={COLORS[1]} strokeWidth={3} strokeDasharray="6 3" connectNulls={false} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SectionSizesChart({ data }: Readonly<{ data: AdminDashboardData["sectionSizes"] }>) {
  const rows = data.map((item) => ({ sectionId: item.sectionId, section: item.label, students: item.students, adviser: item.adviserName ?? "Not assigned" }));
  return (
    <ChartCard
      title="Section sizes"
      description="Enrolled students per section"
      columns={[{ key: "section", label: "Section" }, { key: "students", label: "Students" }, { key: "adviser", label: "Adviser" }]}
      rows={rows}
      rowHref={(row) => typeof row.sectionId === "string" ? `/admin/sections/${encodeURIComponent(row.sectionId)}` : "/admin/sections"}
      action={<Link href="/admin/sections" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">View sections</Link>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 16, bottom: 4 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} />
          <YAxis type="category" dataKey="section" width={130} tick={{ fill: axisColor, fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="students" name="Students" fill={COLORS[2]} radius={[0, 5, 5, 0]}>
            <LabelList dataKey="students" position="right" fill={axisColor} fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

const GRADE_BUCKETS: { key: keyof TeacherDashboardData["gradeDistribution"]; label: string }[] = [
  { key: "90-100", label: "90-100" },
  { key: "85-89", label: "85-89" },
  { key: "80-84", label: "80-84" },
  { key: "75-79", label: "75-79" },
  { key: "below75", label: "Below 75" },
];

export function GradeDistributionChart({ data }: Readonly<{ data: TeacherDashboardData["gradeDistribution"] }>) {
  const rows = GRADE_BUCKETS.map((bucket) => ({ range: bucket.label, count: data[bucket.key] }));
  return (
    <ChartCard
      title="Grade distribution (current term)"
      description="Counts of grades across your classes; no student ranking"
      columns={[{ key: "range", label: "Score range" }, { key: "count", label: "Entries" }]}
      rows={rows}
      rowHref={() => "/teacher/grades"}
      action={<Link href="/teacher/grades" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">View grades</Link>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 18, right: 12, left: -15, bottom: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="range" tick={{ fill: axisColor, fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Grade entries" radius={[5, 5, 0, 0]}>
            {rows.map((row, index) => <Cell key={row.range} fill={COLORS[index]} />)}
            <LabelList dataKey="count" position="top" fill={axisColor} fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
