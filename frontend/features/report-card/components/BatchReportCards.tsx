"use client";

import { useMemo, useRef, useState } from "react";
import { FileSearch, Printer, Search } from "lucide-react";
import { useSectionReportCards } from "../hooks";
import { ErrorState } from "../../../components/shared";
import type { ReportCard } from "../../../types/report-card";
import { ReportCardView } from "./ReportCard";

export function BatchReportCards({
  sectionId,
  includeUnreleased = false,
  title,
}: Readonly<{ sectionId: string; includeUnreleased?: boolean; title: string }>) {
  const reportCards = useSectionReportCards(sectionId, includeUnreleased);
  const [filter, setFilter] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filteredCards = useMemo(() => {
    const value = filter.trim().toLowerCase();
    if (!value) return reportCards.data ?? [];
    return (reportCards.data ?? []).filter((card) => {
      const fullName = `${card.student.lastName} ${card.student.firstName} ${card.student.middleName ?? ""}`.toLowerCase();
      return fullName.includes(value);
    });
  }, [filter, reportCards.data]);

  const handleFocus = (studentId: string) => {
    setFocusedId(studentId);
    const element = cardRefs.current[studentId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (reportCards.isLoading) {
    return <div className="space-y-4 animate-pulse"><div className="h-12 rounded-xl bg-slate-200" /><div className="h-48 rounded-2xl bg-slate-200" /><div className="h-96 rounded-2xl bg-slate-200" /></div>;
  }

  if (reportCards.isError) {
    return (
      <ErrorState
        title="Could not load report cards"
        error={reportCards.error}
        retry={() => void reportCards.refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Batch report cards</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">{title}</h1>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Printer size={16} aria-hidden="true" />
          Print all
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block flex-1 min-w-[220px]">
            <span className="sr-only">Filter students</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter by student name"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-indigo-500"
            />
          </label>
          <div className="text-sm text-slate-600">{filteredCards.length} report card{filteredCards.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      {(reportCards.data && reportCards.data.length > 80) || (filteredCards.length === 0 && filter) ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {reportCards.data && reportCards.data.length > 80
            ? "This section is too large to print in one batch. Please print in smaller batches."
            : "No students match the current name filter."}
        </div>
      ) : null}

      <div className="space-y-6 print:space-y-0">
        {filteredCards.map((card) => (
          <div
            key={card.student.id}
            ref={(node) => { cardRefs.current[card.student.id] = node; }}
            className={`${focusedId === card.student.id ? "ring-2 ring-indigo-500" : ""} print:page-break-after-always`}
          >
            <ReportCardView data={card} />
          </div>
        ))}
      </div>

      {!filteredCards.length && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          <div className="mx-auto mb-3 inline-flex rounded-full bg-slate-100 p-3 text-slate-500"><FileSearch size={18} aria-hidden="true" /></div>
          No report cards are available for this filter.
        </div>
      )}
    </div>
  );
}
