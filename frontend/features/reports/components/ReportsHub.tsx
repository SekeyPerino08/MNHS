"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { AlertTriangle, Download, FileSpreadsheet, LockKeyhole, LoaderCircle } from "lucide-react";
import { Modal } from "../../../components/shared";
import { useAuth } from "../../../providers/AuthProvider";
import { useSchoolYears } from "../../school-years/hooks";
import { useSections } from "../../sections/hooks";
import { useClassOfferings, useMyClasses } from "../../class-offerings/hooks";
import { manilaToday } from "../../../lib/dates";
import { ApiError } from "../../../lib/api";
import type { ReportDefinition, ReportFilters } from "../../../types/reports";
import { useReportCatalog, useReportPreview, reportKeys } from "../hooks";
import { useQueryClient } from "@tanstack/react-query";
import { downloadReport } from "../download";
import { friendlyReportMessage } from "../api-messages";
import { useAuditFacets } from "../../audit/hooks";

const formSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));
const reportNamesWithPersonalData = new Set(["students-masterlist", "teachers-list", "audit-log"]);
const grades = [7, 8, 9, 10, 11, 12];
const booleanFilterNames = new Set(["includeContact", "includeUnreleased", "isActive"]);

export function ReportsHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const catalog = useReportCatalog();
  const { user } = useAuth();
  const selectedReportKey = searchParams.get("report");
  const selectedReport = catalog.data?.find((item) => item.key === selectedReportKey) ?? null;
  const [filters, setFilters] = useState<ReportFilters>(() => filtersFromSearchParams(searchParams));
  const [acknowledgeContact, setAcknowledgeContact] = useState(() => searchParams.get("ackContact") === "true");
  const [downloaded, setDownloaded] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);
  const years = useSchoolYears();
  const currentYear = years.data?.data.find((year) => year.isCurrent) ?? years.data?.data[0];
  const yearId = typeof filters.schoolYearId === "string" ? filters.schoolYearId : currentYear?.id;
  const teacherRole = user?.role === "TEACHER";
  const needsSections = Boolean(selectedReportKey && ["students-masterlist", "section-class-list", "section-grades"].includes(selectedReportKey))
    || Boolean(selectedReportKey && ["class-roster", "class-attendance", "class-grades"].includes(selectedReportKey));
  const sections = useSections({ page: 1, pageSize: 100, schoolYearId: yearId }, user?.role === "ADMIN" && needsSections);
  const selectedSectionId = typeof filters.sectionId === "string" ? filters.sectionId : undefined;
  const usesClassOffering = Boolean(selectedReportKey && ["class-roster", "class-attendance", "class-grades"].includes(selectedReportKey));
  const classes = useClassOfferings(
    { page: 1, pageSize: 100, schoolYearId: yearId, sectionId: selectedSectionId },
    user?.role === "ADMIN" && usesClassOffering && Boolean(selectedSectionId),
  );
  const myClasses = useMyClasses(yearId, teacherRole);
  const advisory = myClasses.data?.advisedSection;
  const sectionOptions = teacherRole
    ? advisory ? [{ ...advisory, schoolYearId: advisory.schoolYear?.id ?? yearId ?? "" }] : []
    : sections.data?.data ?? [];
  const auditFacets = useAuditFacets(user?.role === "ADMIN" && selectedReportKey === "audit-log");

  const updateUrl = useCallback((reportKey: string | null, values: ReportFilters, locks?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of [...next.keys()]) {
      if (key === "report" || key === "lock" || key === "ackContact" || key === "schoolYearId"
        || key === "sectionId" || key === "classOfferingId" || key === "termId" || key === "gradeLevel"
        || key === "status" || key === "enrollment" || key === "includeContact" || key === "includeUnreleased"
        || key === "from" || key === "to" || key === "layout" || key === "isActive" || key === "action" || key === "entity") {
        next.delete(key);
      }
    }
    if (reportKey) next.set("report", reportKey);
    if (locks) next.set("lock", locks);
    for (const [key, value] of Object.entries(values)) {
      if (value !== "" && value !== false) next.set(key, String(value));
    }
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const closePanel = useCallback(() => {
    queryClient.removeQueries({ queryKey: [...reportKeys.all, "preview"] });
    setFilters({});
    setAcknowledgeContact(false);
    setDownloaded(false);
    const next = new URLSearchParams(searchParams.toString());
    for (const key of [...next.keys()]) {
      if (key === "report" || key === "lock" || key === "ackContact" || [
        "schoolYearId", "sectionId", "classOfferingId", "termId", "gradeLevel", "status", "enrollment",
        "includeContact", "includeUnreleased", "from", "to", "layout", "isActive", "action", "entity",
      ].includes(key)) next.delete(key);
    }
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
  }, [pathname, queryClient, router, searchParams]);

  function openReport(key: string) {
    setAcknowledgeContact(false);
    setDownloaded(false);
    updateUrl(key, {});
  }

  const filterSchema = useMemo(() => formSchema.superRefine((value, context) => {
    if (!selectedReport) return;
    for (const field of selectedReport.filters) {
      if (field.required && (value[field.name] === undefined || value[field.name] === "")) {
        context.addIssue({ code: "custom", path: [field.name], message: "This field is required." });
      }
    }
    const today = manilaToday();
    const from = typeof value.from === "string" ? value.from : "";
    const to = typeof value.to === "string" ? value.to : "";
    for (const key of ["from", "to"] as const) {
      const date = typeof value[key] === "string" ? value[key] as string : "";
      if (date && !isDate(date)) {
        context.addIssue({ code: "custom", path: [key], message: "Enter a valid calendar date." });
      }
    }
    if (from && to && from > to) {
      context.addIssue({ code: "custom", path: ["from"], message: "The start date must be on or before the end date." });
    }
    if (selectedReport.key === "audit-log" && from && to && dayDifference(from, to) > 30) {
      context.addIssue({ code: "custom", path: ["to"], message: "The date range cannot exceed 31 days." });
    }
    if (selectedReport.key === "class-attendance" && to && to > today) {
      context.addIssue({ code: "custom", path: ["to"], message: "The end date cannot be in the future." });
    }
    if (selectedReport.key === "class-attendance" && from && to) {
      const year = schoolYearForFilters(value, years.data?.data ?? []);
      if (year && (from < year.startDate.slice(0, 10) || to > year.endDate.slice(0, 10))) {
        context.addIssue({ code: "custom", path: ["from"], message: "Choose dates within the class school year." });
      }
    }
  }), [selectedReport, years.data]);

  const form = useForm<ReportFilters>({ defaultValues: filters, mode: "onChange" });
  useEffect(() => { form.reset(filters); }, [filters, form]);
  const watchedValues = useWatch({ control: form.control });
  const defaults = useMemo(() => reportDefaults(selectedReport, yearId, years.data?.data ?? []), [selectedReport, yearId, years.data]);
  const currentFilters = useMemo<ReportFilters>(() => ({
    ...defaults,
    ...filters,
    ...Object.fromEntries(Object.entries(watchedValues ?? {}).filter((entry): entry is [string, string | boolean] => entry[1] !== undefined)),
  }), [defaults, filters, watchedValues]);
  const validation = filterSchema.safeParse(currentFilters);

  const [debouncedFilters, setDebouncedFilters] = useState<ReportFilters>(currentFilters);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilters(currentFilters), 350);
    return () => window.clearTimeout(timer);
  }, [currentFilters]);

  const filtersSettled = sameFilters(debouncedFilters, currentFilters);
  const previewQuery = useReportPreview(selectedReport?.key ?? "", debouncedFilters, Boolean(selectedReport && validation.success && filtersSettled));
  const isLocked = (name: string) => (searchParams.get("lock") ?? "").split(",").includes(name);
  const hasContact = selectedReport?.key === "students-masterlist" && currentFilters.includeContact === true;

  function changeFilter(name: string, value: string | boolean) {
    const next = { ...currentFilters, [name]: value };
    if (name === "schoolYearId" || name === "sectionId") {
      delete next.sectionId;
      if (name === "sectionId") next.sectionId = value;
      delete next.classOfferingId;
      delete next.termId;
      if (name === "schoolYearId") {
        delete next.from;
        delete next.to;
      }
    }
    setFilters(next);
    if (name === "includeContact" && value === false) setAcknowledgeContact(false);
    form.setValue(name, value, { shouldValidate: true, shouldDirty: true });
    setDownloaded(false);
    updateUrl(selectedReport?.key ?? null, next, searchParams.get("lock") ?? undefined);
  }

  async function handleDownload() {
    if (!selectedReport || !validation.success || !previewQuery.data || previewQuery.data.total < 1) return;
    setDownloadPending(true);
    try {
      await downloadReport(selectedReport.key, currentFilters);
      setDownloaded(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        form.setError("root.server", { message: error.message });
      }
    } finally {
      setDownloadPending(false);
    }
  }

  const currentYearObject = schoolYearForFilters(currentFilters, years.data?.data ?? []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Reports</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Reports and exports</h1>
        <p className="mt-2 text-sm text-slate-600">Exports follow the same access rules as the screens. Files open correctly in Excel (UTF-8).</p>
      </header>

      {catalog.isError ? (
        <div className="rounded-xl border border-rose-200 bg-white p-5 text-sm text-rose-800">
          <p>{friendlyReportMessage(catalog.error)}</p>
          <button type="button" onClick={() => void catalog.refetch()} className="mt-3 font-semibold underline">Try again</button>
        </div>
      ) : catalog.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading reports">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      ) : catalog.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.data.map((report) => (
            <article key={report.key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><FileSpreadsheet size={20} aria-hidden="true" /></span>
                <div className="min-w-0"><h2 className="font-semibold text-slate-900">{report.title}</h2><p className="mt-1 text-sm leading-5 text-slate-600">{report.description}</p></div>
              </div>
              {reportNamesWithPersonalData.has(report.key) && <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-amber-800"><LockKeyhole size={14} aria-hidden="true" />Contains personal information</p>}
              <button type="button" onClick={() => openReport(report.key)} className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                Configure and export
              </button>
            </article>
          ))}
        </div>
      ) : <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No reports are available for this account.</p>}

      {selectedReport && <Modal
        title={`Configure ${selectedReport.title}`}
        description="Choose filters, review a sample, then download the CSV."
        onClose={closePanel}
        size="max-w-6xl"
      >
        <form onSubmit={(event) => { event.preventDefault(); void handleDownload(); }} className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1.1fr)]">
            <section className="space-y-4" aria-label="Report filters">
              {user?.role === "ADMIN"
                && !selectedReport.filters.some((field) => field.name === "schoolYearId")
                && (selectedReport.filters.some((field) => field.name === "sectionId") || usesClassOffering)
                && <FilterField
                  field={{ name: "schoolYearId", type: "schoolYear", required: false }}
                  value={currentFilters.schoolYearId ?? yearId}
                  error={fieldError("schoolYearId", validation)}
                  disabled={isLocked("schoolYearId")}
                  years={years.data?.data ?? []}
                  sections={sectionOptions}
                  offerings={classes.data?.data ?? []}
                  teacherClasses={myClasses.data?.data ?? []}
                  selectedYearId={yearId}
                  selectedSectionId={selectedSectionId}
                  teacherRole={teacherRole}
                  includeUnreleased={currentFilters.includeUnreleased === true}
                  actionOptions={auditFacets.data?.actions ?? []}
                  entityOptions={auditFacets.data?.entities ?? []}
                  onChange={changeFilter}
                />}
              {selectedReport.filters.some((field) => field.name === "classOfferingId") && !teacherRole && <FilterField
                field={{ name: "sectionId", type: "section", required: true }}
                value={currentFilters.sectionId}
                error={fieldError("sectionId", validation)}
                disabled={false}
                years={years.data?.data ?? []}
                sections={sectionOptions}
                offerings={classes.data?.data ?? []}
                teacherClasses={myClasses.data?.data ?? []}
                selectedYearId={yearId}
                selectedSectionId={selectedSectionId}
                teacherRole={teacherRole}
                includeUnreleased={currentFilters.includeUnreleased === true}
                actionOptions={auditFacets.data?.actions ?? []}
                entityOptions={auditFacets.data?.entities ?? []}
                onChange={changeFilter}
              />}
              {selectedReport.filters.map((field) => (
                <FilterField
                  key={field.name}
                  field={field}
                  value={currentFilters[field.name]}
                  error={fieldError(field.name, validation)}
                  disabled={isLocked(field.name)}
                  years={years.data?.data ?? []}
                  sections={sectionOptions}
                  offerings={classes.data?.data ?? []}
                  teacherClasses={myClasses.data?.data ?? []}
                  selectedYearId={yearId}
                  selectedSectionId={selectedSectionId}
                  teacherRole={teacherRole}
                  includeUnreleased={currentFilters.includeUnreleased === true}
                  actionOptions={auditFacets.data?.actions ?? []}
                  entityOptions={auditFacets.data?.entities ?? []}
                  onChange={changeFilter}
                />
              ))}
              {selectedReport.key === "students-masterlist" && hasContact && <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="flex gap-2 text-sm font-semibold text-amber-950"><AlertTriangle size={18} className="shrink-0" aria-hidden="true" />This file will contain personal contact information. Handle it securely.</p>
                <label className="flex items-start gap-2 text-sm text-amber-950">
                  <input type="checkbox" checked={acknowledgeContact} onChange={(event) => {
                    setAcknowledgeContact(event.target.checked);
                    updateUrl(selectedReport.key, currentFilters, searchParams.get("lock") ?? undefined);
                    const params = new URLSearchParams(window.location.search);
                    if (event.target.checked) params.set("ackContact", "true"); else params.delete("ackContact");
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                  }} className="mt-1 size-4 accent-amber-700" />
                  I understand this export contains sensitive contact details.
                </label>
              </div>}
              {selectedReport.key === "section-grades" && teacherRole && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Only released terms are available for export.</p>}
              {selectedReport.key === "section-grades" && user?.role === "ADMIN" && currentFilters.includeUnreleased === true && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">The file name will be marked DRAFT. Do not share it as official grades.</p>}
              {selectedReport.key === "class-attendance" && currentYearObject && <p className="text-xs text-slate-500">Dates must be within {currentYearObject.name} and cannot include future dates.</p>}
              {selectedReport.key === "audit-log" && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Exporting the audit log is itself recorded in the audit log.</p>}
              {form.formState.errors.root?.server?.message && <p role="alert" className="text-sm text-rose-700">{form.formState.errors.root.server.message}</p>}
            </section>

            <section aria-label="Report preview" className="min-w-0 rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">Preview</h3>
                {previewQuery.data && <p className="mt-1 text-sm text-slate-600">{previewQuery.data.total} rows will be exported</p>}
              </div>
              {!filtersSettled || previewQuery.isFetching ? <div className="space-y-3 p-4" aria-label="Loading preview">{Array.from({ length: 5 }, (_, row) => <div key={row} className="h-8 animate-pulse rounded bg-slate-100" />)}</div>
                : previewQuery.isError ? <div role="alert" className="p-4 text-sm text-rose-700">{friendlyReportMessage(previewQuery.error)}</div>
                  : !validation.success ? <p className="p-4 text-sm text-slate-500">Complete the filters to preview this export.</p>
                    : !previewQuery.data?.total ? <p className="p-4 text-sm text-slate-600">No rows match these filters.</p>
                      : <div className="overflow-x-auto">
                        <table className="w-full min-w-max text-left text-xs">
                          <caption className="sr-only">{selectedReport.title} preview, first 10 rows</caption>
                          <thead className="bg-slate-50 text-slate-600"><tr>{previewQuery.data.columns.map((column) => <th key={column.key} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{column.label}</th>)}</tr></thead>
                          <tbody className="divide-y divide-slate-100">{previewQuery.data.rows.map((row, index) => <tr key={index}>{previewQuery.data.columns.map((column) => <td key={column.key} className="max-w-48 truncate whitespace-nowrap px-3 py-2 text-slate-700">{plainText(row[column.key])}</td>)}</tr>)}</tbody>
                        </table>
                      </div>}
            </section>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div aria-live="polite" className="min-h-5 text-xs text-slate-500">
              {downloadPending ? "Preparing download" : downloaded ? "Download started. This export was recorded in the audit log." : ""}
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closePanel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={!validation.success || !filtersSettled || !previewQuery.data?.total || downloadPending || (hasContact && !acknowledgeContact)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                {downloadPending ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} aria-hidden="true" />}
                {downloadPending ? "Preparing…" : "Download CSV"}
              </button>
            </div>
          </div>
        </form>
      </Modal>}
    </div>
  );
}

function FilterField({ field, value, error, disabled, years, sections, offerings, teacherClasses, selectedYearId, selectedSectionId, teacherRole, includeUnreleased, actionOptions, entityOptions, onChange }: Readonly<{
  field: ReportDefinition["filters"][number];
  value: string | boolean | undefined;
  error?: string;
  disabled: boolean;
  years: Array<{ id: string; name: string; startDate: string; endDate: string; isCurrent: boolean; terms: Array<{ id: string; name: string; termNumber: number; gradesLocked?: boolean }> }>;
  sections: Array<{ id: string; name: string; gradeLevel: number; schoolYearId: string }>;
  offerings: Array<{ id: string; subject: { code: string; name: string }; section: { name: string; gradeLevel: number } }>;
  teacherClasses: Array<{ id: string; subject: { code: string; name: string }; section: { name: string; gradeLevel: number } }>;
  selectedYearId?: string;
  selectedSectionId?: string;
  teacherRole: boolean;
  includeUnreleased: boolean;
  actionOptions: string[];
  entityOptions: string[];
  onChange: (name: string, value: string | boolean) => void;
}>) {
  const inputId = `report-filter-${field.name}`;
  const errorId = `${inputId}-error`;
  const fieldClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:bg-slate-100";
  const describe = error ? errorId : undefined;
  if (field.type === "boolean") {
    return <label htmlFor={inputId} className="flex items-start gap-2 text-sm font-medium text-slate-700">
      <input id={inputId} type="checkbox" checked={value === true} disabled={disabled} aria-describedby={describe} onChange={(event) => onChange(field.name, event.target.checked)} className="mt-0.5 size-4 rounded accent-indigo-600" />
      <span>{booleanLabel(field.name)}</span>{error && <span id={errorId} className="sr-only">{error}</span>}
    </label>;
  }
  let control;
  if (field.name === "schoolYearId") {
    control = <select id={inputId} value={stringValue(value)} disabled={disabled} aria-describedby={describe} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClass}>
      <option value="">Select school year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " (Current)" : ""}</option>)}
    </select>;
  } else if (field.name === "gradeLevel") {
    control = <select id={inputId} value={stringValue(value)} disabled={disabled} aria-describedby={describe} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClass}>
      <option value="">All grade levels</option>{grades.map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
    </select>;
  } else if (field.name === "sectionId") {
    const scoped = sections.filter((section) => !selectedYearId || section.schoolYearId === selectedYearId);
    control = <select id={inputId} value={stringValue(value)} disabled={disabled} aria-describedby={describe} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClass}>
      <option value="">Select section</option>{grades.map((grade) => {
        const group = scoped.filter((section) => section.gradeLevel === grade);
        return group.length ? <optgroup key={grade} label={`Grade ${grade}`}>{group.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</optgroup> : null;
      })}
    </select>;
  } else if (field.name === "classOfferingId") {
    const list = teacherRole ? teacherClasses : offerings;
    control = <select id={inputId} value={stringValue(value)} disabled={disabled || (!teacherRole && !selectedSectionId)} aria-describedby={describe} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClass}>
      <option value="">Select class</option>{list.map((item) => <option key={item.id} value={item.id}>Grade {item.section.gradeLevel} · {item.section.name} · {item.subject.code} — {item.subject.name}</option>)}
    </select>;
  } else if (field.name === "termId") {
    const selectedYear = years.find((year) => year.id === selectedYearId) ?? years.find((year) => year.isCurrent);
    const terms = (selectedYear?.terms ?? years.flatMap((year) => year.terms))
      .filter((term) => !teacherRole || term.gradesLocked === true);
    control = <select id={inputId} value={stringValue(value)} disabled={disabled} aria-describedby={describe} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClass}>
      <option value="">Select term</option>{terms.map((term) => {
        const released = term.gradesLocked === true;
        return <option key={term.id} value={term.id} disabled={!released && (teacherRole || !includeUnreleased)}>{term.name} — {released ? "Released" : "Not released"}</option>;
      })}
    </select>;
  } else if (field.name === "from" || field.name === "to") {
    control = <input id={inputId} type="date" value={stringValue(value)} disabled={disabled} aria-describedby={describe} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClass} />;
  } else if (field.name === "layout") {
    control = <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Attendance layout">
      {[["summary", "Summary per student"], ["daily", "Daily grid"]].map(([layout, label]) => <button key={layout} type="button" aria-pressed={(value ?? "summary") === layout} disabled={disabled} onClick={() => onChange(field.name, layout)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${(value ?? "summary") === layout ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-300 text-slate-700"}`}>{label}</button>)}
    </div>;
  } else if (field.name === "status" || field.name === "enrollment" || field.name === "isActive" || field.name === "action" || field.name === "entity") {
    const options: Array<string | [string, string]> = field.name === "isActive"
      ? [["", "All statuses"], ["true", "Active"], ["false", "Inactive"]]
      : field.name === "action"
        ? actionOptions
        : field.name === "entity"
          ? entityOptions
          : (field.options ?? []);
    control = <select id={inputId} value={stringValue(value)} disabled={disabled} aria-describedby={describe} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClass}>
      <option value="">Any</option>{options.map((option) => typeof option === "string" ? <option key={option} value={option}>{humanize(option)}</option> : <option key={option[0]} value={option[0]}>{option[1]}</option>)}
    </select>;
  } else {
    control = <input id={inputId} value={stringValue(value)} disabled={disabled} aria-describedby={describe} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClass} />;
  }

  return <div>
    <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">{fieldLabel(field.name)}{field.required && <span aria-hidden="true"> *</span>}</label>
    {control}
    {error && <p id={errorId} role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}
  </div>;
}

function fieldError(field: string, result: ReturnType<typeof formSchema.safeParse>): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

function stringValue(value: string | boolean | undefined): string {
  return typeof value === "string" ? value : "";
}

function plainText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

function fieldLabel(name: string): string {
  const labels: Record<string, string> = {
    schoolYearId: "School year", gradeLevel: "Grade level", sectionId: "Section", classOfferingId: "Class",
    termId: "Term", status: "Student status", isActive: "Teacher status", from: "From", to: "To",
    layout: "Attendance layout", enrollment: "Enrollment", action: "Action", entity: "Entity",
  };
  return labels[name] ?? name.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function booleanLabel(name: string): string {
  if (name === "includeContact") return "Include contact details (guardian name, guardian contact, address)";
  if (name === "includeUnreleased") return "Include unreleased grades (draft)";
  return fieldLabel(name);
}

function humanize(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dayDifference(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return (end - start) / 86_400_000;
}

function isDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function sameFilters(left: ReportFilters, right: ReportFilters): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) if (left[key] !== right[key]) return false;
  return true;
}

function schoolYearForFilters(filters: ReportFilters, years: Array<{ id: string; name: string; startDate: string; endDate: string }>) {
  const id = typeof filters.schoolYearId === "string" ? filters.schoolYearId : undefined;
  return years.find((year) => year.id === id) ?? years.find((year) => "isCurrent" in year && year.isCurrent);
}

function filtersFromSearchParams(params: URLSearchParams): ReportFilters {
  const values: ReportFilters = {};
  for (const [key, value] of params.entries()) {
    if (key === "report" || key === "lock" || key === "ackContact") continue;
    values[key] = booleanFilterNames.has(key) ? value === "true" : value;
  }
  return values;
}

function reportDefaults(
  report: ReportDefinition | null,
  yearId: string | undefined,
  years: Array<{ id: string; startDate: string; endDate: string }>,
): ReportFilters {
  if (!report) return {};
  const defaults: ReportFilters = {};
  if (report.filters.some((field) => field.name === "schoolYearId") && yearId) defaults.schoolYearId = yearId;
  if (report.filters.some((field) => field.name === "enrollment")) defaults.enrollment = "all";
  if (report.filters.some((field) => field.name === "layout")) defaults.layout = "summary";
  if (report.filters.some((field) => field.name === "includeContact")) defaults.includeContact = false;
  if (report.filters.some((field) => field.name === "includeUnreleased")) defaults.includeUnreleased = false;
  if (report.key === "class-attendance" && yearId) {
    const year = years.find((item) => item.id === yearId);
    if (year) {
      const today = manilaToday();
      defaults.from = year.startDate.slice(0, 10);
      defaults.to = today < year.endDate.slice(0, 10) ? today : year.endDate.slice(0, 10);
    }
  }
  return defaults;
}
