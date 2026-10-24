"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, CircleHelp, Clock3, Download,
  FileCheck2, GraduationCap, LoaderCircle, Trash2, Upload, Users, XCircle,
} from "lucide-react";
import { ApiError } from "../../../lib/api";
import { downloadImportTemplate, downloadRejectedRows } from "../api";
import {
  ConfirmDialog, DataTablePagination, EmptyState, ErrorState, StatusBadge, TableSkeleton,
} from "../../../components/shared";
import {
  importKeys, useCommitImport, useDiscardImport, useImportJob, useImportRows, usePreviewImport,
} from "../hooks";
import { ImportHistory } from "./ImportHistory";
import type {
  ImportDateFormat, ImportJob, ImportResult, ImportRow, ImportRowFilter, ImportType,
} from "../../../types/imports";

const importTabs: { value: ImportRowFilter; label: string; count: (job: ImportJob) => number }[] = [
  { value: "ALL", label: "All", count: (job) => job.totals.rows },
  { value: "VALID", label: "Ready", count: (job) => job.totals.valid },
  { value: "WARNING", label: "Warnings", count: (job) => job.totals.warnings },
  { value: "ERROR", label: "Rejected", count: (job) => job.totals.errors },
];

type WizardStep = "upload" | "review" | "confirm" | "done";

export function ImportWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const jobId = searchParams.get("job");
  const urlType = searchParams.get("type");
  const type: ImportType = urlType === "teachers" ? "TEACHERS" : "STUDENTS";
  const [dateFormat, setDateFormat] = useState<ImportDateFormat>("ISO");
  const [file, setFile] = useState<File | null>(null);
  const [includeWarnings, setIncludeWarnings] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<"back" | "discard" | null>(null);
  const [confirmNavigation, setConfirmNavigation] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [completedType, setCompletedType] = useState<ImportType | null>(null);
  const dragDepth = useRef(0);
  const currentUrl = useRef("");
  const [dragging, setDragging] = useState(false);

  const preview = usePreviewImport();
  const resetPreview = preview.reset;
  const commit = useCommitImport();
  const discard = useDiscardImport();
  const requestedStep = validStep(searchParams.get("step"), jobId ? "review" : "upload");
  const step: WizardStep = requestedStep === "done" && !result ? "review" : requestedStep;
  const jobQuery = useImportJob(jobId ?? "", Boolean(jobId) && step !== "done");
  const job = jobQuery.data ?? null;
  const rowFilter = validFilter(searchParams.get("filter"));
  const rowPage = positiveInt(searchParams.get("rowPage"), 1);
  const rowPageSize = positiveInt(searchParams.get("rowPageSize"), 25);
  const rowsQuery = useImportRows(jobId ?? "", { status: rowFilter, page: rowPage, pageSize: rowPageSize }, step === "review" && Boolean(jobId));
  const activePreview = Boolean(step !== "done" && jobId && job?.status !== "COMMITTED" && job?.status !== "DISCARDED");
  const importableCount = (job?.totals.valid ?? 0) + (includeWarnings ? job?.totals.warnings ?? 0 : 0);

  const setParams = useCallback((updates: Record<string, string | null>, replace = true) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const url = params.size ? `/admin/imports?${params.toString()}` : "/admin/imports";
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    currentUrl.current = `${window.location.pathname}${window.location.search}`;
  }, [searchParams]);

  useEffect(() => {
    if (!jobId || !activePreview) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      event.preventDefault();
      setConfirmNavigation(destination.pathname + destination.search);
    };
    const handlePopState = () => {
      const destination = new URL(window.location.href);
      window.history.pushState(window.history.state, "", currentUrl.current || "/admin/imports");
      setConfirmNavigation(destination.pathname + destination.search);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", handleLink, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", handleLink, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [activePreview, jobId]);

  useEffect(() => () => {
    resetPreview();
    if (!jobId) return;
    queryClient.removeQueries({ queryKey: [...importKeys.all, "rows", jobId] });
    queryClient.removeQueries({ queryKey: importKeys.job(jobId) });
  }, [jobId, queryClient, resetPreview]);

  function chooseType(next: ImportType) {
    preview.reset();
    setParams({ type: next.toLowerCase() });
  }

  function selectFile(next: File | null) {
    if (!next) return;
    preview.reset();
    if (!next.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      toast.error("Choose a file with the .csv extension.");
      return;
    }
    if (next.size > 2 * 1024 * 1024) {
      setFile(null);
      toast.error("The file must be 2 MB or smaller.");
      return;
    }
    setFile(next);
  }

  async function checkFile() {
    if (!file) return;
    try {
      const response = await preview.mutateAsync({ file, type, dateFormat });
      const id = response.jobId ?? response.id;
      if (!id) throw new Error("The preview response did not include an import ID.");
      queryClient.setQueryData(importKeys.job(id), toJobSummary(response));
      setFile(null);
      preview.reset();
      setParams({ job: id, step: "review", filter: null, rowPage: null }, false);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        toast.error(error instanceof Error ? error.message : "Could not check this CSV file.");
      }
    }
  }

  async function downloadTemplate() {
    try {
      await downloadImportTemplate(type);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download the template.");
    }
  }

  async function downloadRejected() {
    if (!job || !jobId) return;
    try {
      await downloadRejectedRows(jobId, job.fileName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download rejected rows.");
    }
  }

  async function discardAndContinue() {
    if (!jobId || !confirmDiscard) return;
    const action = confirmDiscard;
    try {
      await discard.mutateAsync(jobId);
      setFile(null);
      setConfirmDiscard(null);
      setParams({ job: null, step: null, filter: null, rowPage: null, type: type.toLowerCase() });
      if (action === "back") setIncludeWarnings(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not discard this preview.");
    }
  }

  async function leaveAfterDiscard() {
    if (!jobId || !confirmNavigation) return;
    const destination = confirmNavigation;
    try {
      await discard.mutateAsync(jobId);
      setConfirmNavigation(null);
      router.push(destination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not discard this preview.");
    }
  }

  async function commitImport() {
    if (!jobId || !job) return;
    setCommitError(null);
    try {
      const response = await commit.mutateAsync({ id: jobId, options: { includeWarnings } });
      setResult(response);
      setCompletedType(job.type);
      setParams({ step: "done" });
      queryClient.removeQueries({ queryKey: [...importKeys.all, "rows", jobId] });
      queryClient.removeQueries({ queryKey: importKeys.job(jobId) });
      toast.success("Import complete");
    } catch (error) {
      if (error instanceof ApiError && ["IMPORT_CONFLICT", "IMPORT_EXPIRED", "ALREADY_COMMITTED"].includes(error.code ?? "")) {
        setCommitError(error);
      } else {
        toast.error(error instanceof Error ? error.message : "Could not complete the import.");
      }
    }
  }

  function startOver() {
    setResult(null);
    setCompletedType(null);
    setFile(null);
    setIncludeWarnings(false);
    setCommitError(null);
    setParams({ job: null, step: null, filter: null, rowPage: null, type: type.toLowerCase() });
    preview.reset();
    commit.reset();
    if (jobId) {
      queryClient.removeQueries({ queryKey: [...importKeys.all, "rows", jobId] });
      queryClient.removeQueries({ queryKey: importKeys.job(jobId) });
    }
  }

  const stepNames: { id: WizardStep; label: string }[] = [
    { id: "upload", label: "Upload" }, { id: "review", label: "Review" },
    { id: "confirm", label: "Confirm" }, { id: "done", label: "Done" },
  ];
  const stepIndex = stepNames.findIndex((item) => item.id === step);

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Bulk CSV import</h1>
        <p className="mt-1 text-sm text-slate-500">Check a CSV, review every row, then import records.</p>
      </header>
      <nav aria-label="Import steps" className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite" aria-atomic="true">
          {stepNames.map((item, index) => {
            const complete = index < stepIndex;
            const current = index === stepIndex;
            return <li key={item.id} aria-current={current ? "step" : undefined} className={`flex items-center gap-2 text-sm ${current ? "font-semibold text-indigo-700" : complete ? "text-slate-700" : "text-slate-400"}`}>
              <span className={`flex size-7 items-center justify-center rounded-full border text-xs ${complete ? "border-emerald-600 bg-emerald-50 text-emerald-800" : current ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300"}`}>
                {complete ? <Check size={15} aria-label="Complete" /> : index + 1}
              </span>{item.label}
            </li>;
          })}
        </ol>
        <p className="sr-only" role="status">Current step: {stepNames[stepIndex]?.label ?? "Upload"}</p>
      </nav>

      {step === "upload" && <UploadStep
        type={type} dateFormat={dateFormat} file={file} dragging={dragging}
        checking={preview.isPending} error={preview.error} onType={chooseType} onDateFormat={setDateFormat}
        onFile={selectFile} onRemove={() => setFile(null)} onDownloadTemplate={() => void downloadTemplate()}
        onCheck={() => void checkFile()} onInputClick={() => document.getElementById("import-file-input")?.click()}
        onDragState={setDragging} onDragDepth={(change) => { dragDepth.current = Math.max(0, dragDepth.current + change); setDragging(dragDepth.current > 0); }}
      />}

      {jobId && step === "review" && (
        jobQuery.isLoading && !job ? <WizardLoading /> :
        jobQuery.isError && !job ? <ExpiredOrError error={jobQuery.error} onStartOver={startOver} retry={() => void jobQuery.refetch()} /> :
        job ? <ReviewStep
          job={job} rows={rowsQuery.data?.data ?? []} rowMeta={rowsQuery.data?.meta}
          rowFilter={rowFilter} rowPage={rowPage}
          loading={rowsQuery.isLoading} rowsError={rowsQuery.error} onRetryRows={() => void rowsQuery.refetch()} includeWarnings={includeWarnings}
          importableCount={importableCount} onFilter={(filter) => setParams({ filter: filter === "ALL" ? null : filter, rowPage: null })}
          onPage={(page) => setParams({ rowPage: String(page) })}
          onPageSize={(size) => setParams({ rowPageSize: String(size), rowPage: null })}
          onIncludeWarnings={setIncludeWarnings} onDownloadRejected={() => void downloadRejected()}
          onBack={() => setConfirmDiscard("back")} onDiscard={() => setConfirmDiscard("discard")}
          onImport={() => setParams({ step: "confirm" })} />
        : null
      )}

      {step === "confirm" && job && !commitError && <ConfirmDialog
        title="Confirm import"
        description={<div className="space-y-3">
          <p>{confirmationText(job, importableCount, includeWarnings)}</p>
          <p className="font-medium text-slate-800">This cannot be undone from here.</p>
          <button type="button" onClick={() => void downloadRejected()} disabled={!job.totals.errors && !job.totals.warnings} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 underline disabled:text-slate-400">
            <Download size={16} /> Download rejected rows
          </button>
          <p className="text-xs text-amber-800">Rejected rows cannot be downloaded after importing.</p>
        </div>}
        onConfirm={() => void commitImport()} onClose={() => setParams({ step: "review" })}
        loading={commit.isPending} confirmLabel={`Import ${importableCount} rows`} />
      }

      {commitError && <ConfirmDialog
        title={commitError.code === "ALREADY_COMMITTED" ? "Import already completed" : "Preview needs to be checked again"}
        description={<div className="space-y-2"><p>{commitError.message}</p><p>Return to Upload and check the CSV again before continuing.</p></div>}
        onConfirm={startOver} onClose={startOver} confirmLabel="Upload another file" />
      }

      {step === "done" && result && completedType && <DoneStep type={completedType} result={result} onStartOver={startOver} />}

      {confirmDiscard && <ConfirmDialog
        title={confirmDiscard === "back" ? "Discard this preview and go back?" : "Discard this import?"}
        description="This preview will be discarded. You will need to upload and check the CSV again before importing."
        destructive confirmLabel="Discard preview" loading={discard.isPending}
        onClose={() => setConfirmDiscard(null)} onConfirm={() => void discardAndContinue()} />
      }
      {confirmNavigation && <ConfirmDialog
        title="Leave this import?"
        description="Your uncommitted preview will be discarded before leaving this page."
        destructive confirmLabel="Discard and leave" loading={discard.isPending}
        onClose={() => setConfirmNavigation(null)} onConfirm={() => void leaveAfterDiscard()} />
      }

      <ImportHistory />
    </div>
  );
}

function UploadStep(props: {
  type: ImportType;
  dateFormat: ImportDateFormat;
  file: File | null;
  dragging: boolean;
  checking: boolean;
  error: unknown;
  onType: (type: ImportType) => void;
  onDateFormat: (format: ImportDateFormat) => void;
  onFile: (file: File | null) => void;
  onRemove: () => void;
  onDownloadTemplate: () => void;
  onCheck: () => void;
  onInputClick: () => void;
  onDragState: (dragging: boolean) => void;
  onDragDepth: (change: number) => void;
}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <h2 className="text-xl font-semibold text-slate-900">Upload a CSV file</h2>
    <p className="mt-1 text-sm text-slate-500">Choose the type of records and check that your columns match the template.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {(["STUDENTS", "TEACHERS"] as const).map((item) => {
        const selected = props.type === item;
        return <div key={item} className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${selected ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200"}`}>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="radio" name="importType" value={item} checked={selected} onChange={() => props.onType(item)} className="size-4 accent-indigo-600" />
            <span className="flex items-center gap-2 font-medium text-slate-800">{item === "STUDENTS" ? <GraduationCap size={19} /> : <Users size={19} />}{item === "STUDENTS" ? "Students" : "Teachers"}</span>
          </label>
          <button type="button" onClick={props.onDownloadTemplate} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:underline"><Download size={15} /> Template</button>
        </div>;
      })}
    </div>
    {props.type === "STUDENTS" && <div className="mt-5 max-w-xl">
      <label htmlFor="import-date-format" className="block text-sm font-medium text-slate-700">Student birth date format</label>
      <select id="import-date-format" value={props.dateFormat} onChange={(event) => props.onDateFormat(event.target.value as ImportDateFormat)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
        <option value="ISO">Year-Month-Day, 2012-03-04</option>
        <option value="MDY">Month/Day/Year, 03/04/2012</option>
        <option value="DMY">Day/Month/Year, 04/03/2012</option>
      </select>
      <p className="mt-1.5 text-xs text-slate-500">Choose carefully: the system never guesses dates.</p>
    </div>}
    <input id="import-file-input" type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose CSV file" onChange={(event) => { props.onFile(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} />
    <div
      onDragEnter={(event) => { event.preventDefault(); props.onDragDepth(1); }}
      onDragLeave={(event) => { event.preventDefault(); props.onDragDepth(-1); }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); props.onDragDepth(-1000); props.onDragState(false); props.onFile(event.dataTransfer.files?.[0] ?? null); }}
      onClick={props.onInputClick}
      role="group" aria-label="Choose a CSV file or drop it here"
      className={`mt-6 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${props.dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"}`}
    >
      <Upload className="mx-auto text-slate-500" size={27} aria-hidden="true" />
      <p className="mt-3 font-semibold text-slate-800">Drop your CSV file here</p>
      <p className="mt-1 text-sm text-slate-500">or</p>
      <button type="button" onClick={(event) => { event.stopPropagation(); props.onInputClick(); }} className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Choose file</button>
    </div>
    {props.file && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3"><FileCheck2 className="shrink-0 text-emerald-700" size={20} /><div className="min-w-0"><p className="truncate font-medium text-slate-800">{props.file.name}</p><p className="text-xs text-slate-500">{formatBytes(props.file.size)}</p></div></div>
      <button type="button" onClick={props.onRemove} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white"><Trash2 size={15} /> Remove</button>
    </div>}
    <ul className="mt-5 space-y-1.5 text-sm text-slate-600">
      <li>• Save from Excel as CSV UTF-8</li>
      {props.type === "STUDENTS" && <li>• Format student number columns as Text so numbers are not changed</li>}
      <li>• Up to 1,000 rows per file</li>
      <li>• Maximum file size: 2 MB</li>
    </ul>
    {props.error !== null && props.error !== undefined && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <p>{friendlyMessage(props.error)}</p>
      {(props.error instanceof ApiError && props.error.code === "NO_CURRENT_SCHOOL_YEAR") &&
        <Link href="/admin/school-years" className="mt-1 inline-block font-semibold underline">Set a current school year</Link>}
      <p className="mt-1">Check the <button type="button" onClick={props.onDownloadTemplate} className="font-semibold underline">template</button> for the expected columns.</p>
    </div>}
    <div className="mt-6 flex justify-end">
      <button type="button" disabled={!props.file || props.checking} onClick={props.onCheck} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
        {props.checking ? <><LoaderCircle size={17} className="animate-spin" /> Checking file…</> : <><FileCheck2 size={17} /> Check file</>}
      </button>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{props.checking ? "Checking file" : ""}</p>
  </section>;
}

function ReviewStep(props: {
  job: ImportJob;
  rows: ImportRow[];
  rowMeta?: { page: number; pageSize: number; total: number; totalPages: number };
  rowFilter: ImportRowFilter;
  rowPage: number;
  loading: boolean;
  rowsError: unknown;
  onRetryRows: () => void;
  includeWarnings: boolean;
  importableCount: number;
  onFilter: (filter: ImportRowFilter) => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onIncludeWarnings: (include: boolean) => void;
  onDownloadRejected: () => void;
  onBack: () => void;
  onDiscard: () => void;
  onImport: () => void;
}) {
  const sections = [...new Set(props.rows.flatMap((row) => row.enrollment?.label ? [row.enrollment.label] : []))];
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold text-slate-900">Review {props.job.type === "STUDENTS" ? "student" : "teacher"} rows</h2><p className="mt-1 text-sm text-slate-500">{props.job.fileName}</p></div>
      <StatusBadge label={props.job.type === "STUDENTS" ? "Students" : "Teachers"} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard title="Total rows" count={props.job.totals.rows} icon={<FileCheck2 />} />
      <SummaryCard title="Ready to import" count={props.job.totals.valid} icon={<CheckCircle2 />} />
      <SummaryCard title="Warnings" count={props.job.totals.warnings} icon={<AlertTriangle />} />
      <SummaryCard title="Rejected" count={props.job.totals.errors} icon={<XCircle />} />
    </div>
    {props.job.previouslyImported && <div role="status" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <AlertTriangle className="mt-0.5 shrink-0" size={19} /><p>A file with identical content was imported on <strong>{formatDate(props.job.previouslyImported.at)}</strong> by <strong>{props.job.previouslyImported.by}</strong>.</p>
    </div>}
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <p><strong>Recognized columns:</strong> {props.job.columns.recognized.join(", ") || "None"}</p>
      {props.job.columns.ignored.length > 0 && <p className="mt-1"><strong>These columns were ignored:</strong> {props.job.columns.ignored.join(", ")}</p>}
      {props.job.willEnroll && <p className="mt-2 flex gap-2"><GraduationCap size={17} className="shrink-0" />Valid students will also be enrolled in {sections.length ? sections.join(", ") : "the listed sections"} for the current school year.</p>}
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={14} /> Preview expires {formatDate(props.job.expiresAt)}</p>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div role="tablist" aria-label="Filter preview rows" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-3">
        {importTabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={props.rowFilter === tab.value} onClick={() => props.onFilter(tab.value)} className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium ${props.rowFilter === tab.value ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>
          {tab.label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{tab.count(props.job)}</span>
        </button>)}
      </div>
      {props.rowsError ? <ErrorState title="Could not load preview rows" error={props.rowsError} retry={props.onRetryRows} />
        : !props.loading && props.rows.length === 0 ? <EmptyState title="No rows in this category" description="Choose another tab to inspect the remaining rows." />
        : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>
            <th className="px-4 py-3">Row</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Cleaned values</th><th className="px-4 py-3">Details</th>
          </tr></thead>
          {props.loading && !props.rows.length ? <TableSkeleton columns={4} rows={5} /> :
            <tbody className="divide-y divide-slate-100">{props.rows.map((row) => <ImportRowView key={row.rowNumber} row={row} type={props.job.type} />)}</tbody>}
        </table></div>}
      {props.rowMeta && <DataTablePagination page={props.rowMeta.page} pageSize={props.rowMeta.pageSize} total={props.rowMeta.total} totalPages={props.rowMeta.totalPages} onPage={props.onPage} onPageSize={props.onPageSize} />}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        {(props.job.totals.errors > 0 || props.job.totals.warnings > 0) && <button type="button" onClick={props.onDownloadRejected} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline"><Download size={16} /> Download rejected rows</button>}
        {props.job.totals.warnings > 0 && <label className="mt-3 flex max-w-xl items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={props.includeWarnings} onChange={(event) => props.onIncludeWarnings(event.target.checked)} className="mt-1 accent-indigo-600" />
          <span><strong>Also import rows with warnings (possible duplicates)</strong><span className="mt-0.5 block text-xs text-slate-500">Turn this on only after reviewing possible duplicate matches.</span></span>
        </label>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={props.onBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"><ArrowLeft size={16} /> Back</button>
        <button type="button" onClick={props.onDiscard} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700"><Trash2 size={16} /> Discard</button>
        <button type="button" onClick={props.onImport} disabled={props.importableCount === 0} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
          Import {props.importableCount} rows
        </button>
      </div>
    </div>
  </section>;
}

function ImportRowView({ row, type }: { row: ImportRow; type: ImportType }) {
  const values = row.status === "ERROR" ? row.original : row.normalized;
  const fields = type === "STUDENTS"
    ? [["Student number", fieldValue(values, ["studentNo", "studentNumber", "student_no"])],
      ["Name", getName(values)], ["Sex", fieldValue(values, ["sex"])],
      ["Birth date", fieldValue(values, ["birthDate", "dateOfBirth"])],
      ["Grade", fieldValue(values, ["gradeLevel", "grade"])],
      ["Section", fieldValue(values, ["sectionName", "section"])]]
    : [["Employee number", fieldValue(values, ["employeeNo", "employeeNumber", "employee_no"])],
      ["Name", getName(values)], ["Department", fieldValue(values, ["department"])]];
  const problems = row.status === "ERROR" ? row.errors : row.status === "WARNING" ? row.warnings : [];
  const errorFieldNames = [...new Set(row.errors.map((issue) => issue.field))];
  const warningMessage = row.warnings.map((issue) => `${issue.field}: ${issue.message}`).join("; ");
  return <tr className="align-top">
    <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-700">{row.rowNumber}</td>
    <td className="px-4 py-4"><RowStatus status={row.status} /></td>
    <td className="px-4 py-4"><div className="flex flex-wrap gap-x-4 gap-y-1">
      {fields.filter(([, value]) => value !== "—").map(([label, value]) => <span key={label} className="whitespace-nowrap text-slate-700"><span className="text-xs text-slate-500">{label}: </span>{value}</span>)}
    </div>
      {row.status === "ERROR" && <div className="mt-2 text-xs text-slate-500">Original values shown</div>}
      {row.changes.length > 0 && <details className="mt-2">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800"><CircleHelp size={13} /> Cleaned ({row.changes.length})</summary>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">{row.changes.map((change, index) => <li key={`${change.field}-${index}`}><strong>{change.field}:</strong> {displayValue(change.from)} becomes {displayValue(change.to)}</li>)}</ul>
      </details>}
    </td>
    <td className="max-w-md px-4 py-4 text-sm">
      {row.status === "ERROR" && <div><p className="font-medium text-rose-800">Errors by field: {errorFieldNames.join(", ") || "Row"}</p><ul className="mt-1 space-y-1 text-rose-700">{problems.map((item, index) => <li key={`${item.field}-${index}`}><strong>{item.field}:</strong> {item.message}</li>)}</ul></div>}
      {row.status === "WARNING" && <div className="text-amber-900"><p className="font-medium">Possible duplicate</p><p>{warningMessage || "Review this possible duplicate before importing."}</p></div>}
      {row.status === "VALID" && row.enrollment && <p className="text-slate-600">{row.enrollment.label}</p>}
      {row.status === "VALID" && !row.enrollment && <span className="text-slate-400">—</span>}
    </td>
  </tr>;
}

function SummaryCard({ title, count, icon }: { title: string; count: number; icon: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">{icon}</span>
    <div><p className="text-sm text-slate-500">{title}</p><p className="text-xl font-semibold text-slate-900">{count}</p></div>
  </div>;
}

function RowStatus({ status }: { status: ImportRow["status"] }) {
  const config = {
    VALID: { label: "Ready", icon: <CheckCircle2 size={16} />, style: "text-emerald-800" },
    WARNING: { label: "Warning", icon: <AlertTriangle size={16} />, style: "text-amber-800" },
    ERROR: { label: "Rejected", icon: <XCircle size={16} />, style: "text-rose-800" },
  }[status];
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-medium ${config.style}`}>{config.icon}{config.label}</span>;
}

function DoneStep({ type, result, onStartOver }: { type: ImportType; result: ImportResult; onStartOver: () => void }) {
  const personPath = type === "STUDENTS" ? "/admin/students" : "/admin/teachers";
  return <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
    <p className="sr-only" role="status" aria-live="polite">Import complete</p>
    <div className="flex items-center gap-3"><CheckCircle2 size={28} className="text-emerald-700" /><div><h2 className="text-2xl font-semibold text-slate-900">Import complete</h2><p className="text-sm text-slate-600">The records were saved successfully.</p></div></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard title="Created" count={result.created} icon={<Users />} />
      <SummaryCard title="Enrolled" count={result.enrolled} icon={<GraduationCap />} />
      <SummaryCard title="Skipped warnings" count={result.skippedWarnings} icon={<AlertTriangle />} />
      <SummaryCard title="Skipped errors" count={result.skippedErrors} icon={<XCircle />} />
    </div>
    <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">Login accounts are created from each person&apos;s page.</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <Link href={personPath} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Go to {type === "STUDENTS" ? "Students" : "Teachers"}</Link>
      {type === "STUDENTS" && <Link href="/admin/enrollment" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Go to Enrollment</Link>}
      <button type="button" onClick={onStartOver} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Import another file</button>
    </div>
  </section>;
}

function WizardLoading() {
  return <div className="animate-pulse space-y-4" aria-label="Loading import preview"><div className="h-28 rounded-xl bg-slate-200" /><div className="h-80 rounded-2xl bg-slate-200" /></div>;
}

function ExpiredOrError({ error, onStartOver, retry }: { error: unknown; onStartOver: () => void; retry: () => void }) {
  const expired = error instanceof ApiError && error.code === "IMPORT_EXPIRED";
  return <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
    <h2 className="font-semibold text-slate-900">{expired ? "This preview expired" : "Could not open this preview"}</h2>
    <p className="mt-2 text-sm text-slate-600">{friendlyMessage(error)}</p>
    <div className="mt-4 flex gap-2">
      {!expired && <button type="button" onClick={retry} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Retry</button>}
      <button type="button" onClick={onStartOver} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Upload another file</button>
    </div>
  </div>;
}

function validFilter(value: string | null): ImportRowFilter {
  return value === "VALID" || value === "WARNING" || value === "ERROR" ? value : "ALL";
}

function validStep(value: string | null, fallback: WizardStep): WizardStep {
  return value === "review" || value === "confirm" || value === "done" ? value : fallback;
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function fieldValue(record: Record<string, unknown>, candidates: string[]): string {
  const normalizedCandidates = candidates.map(normalizeKey);
  const key = Object.keys(record).find((name) => normalizedCandidates.includes(normalizeKey(name)));
  return key ? displayValue(record[key]) : "—";
}

function getName(record: Record<string, unknown>): string {
  const full = fieldValue(record, ["fullName", "name"]);
  if (full !== "—") return full;
  const parts = ["firstName", "middleName", "lastName"].map((key) => fieldValue(record, [key])).filter((value) => value !== "—");
  return parts.join(" ") || "—";
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function friendlyMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The upload failed. Please try again.";
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function confirmationText(job: ImportJob, importable: number, includeWarnings: boolean): string {
  const label = job.type === "STUDENTS" ? "students" : "teachers";
  const enrollment = job.willEnroll && job.type === "STUDENTS" ? " and enroll them in sections" : "";
  const skippedWarnings = job.totals.warnings - (includeWarnings ? job.totals.warnings : 0);
  return `Create ${importable} ${label}${enrollment}. ${job.totals.errors} rejected rows and ${skippedWarnings} warnings will be skipped.`;
}

function toJobSummary(job: ImportJob): ImportJob {
  return {
    id: job.id,
    jobId: job.jobId,
    type: job.type,
    fileName: job.fileName,
    expiresAt: job.expiresAt,
    columns: job.columns,
    totals: job.totals,
    willEnroll: job.willEnroll,
    previouslyImported: job.previouslyImported,
    status: job.status,
    createdAt: job.createdAt,
    committedAt: job.committedAt,
  };
}
