"use client";

import { Printer } from "lucide-react";
import { ApiError } from "../../../lib/api";

export function PrintToolbar({ title = "Print / Save as PDF" }: Readonly<{ title?: string }>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-900">Printable report card</p>
        <p className="text-xs text-slate-500">In the print dialog, choose Save as PDF to download it.</p>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        aria-label={title}
      >
        <Printer size={16} aria-hidden="true" />
        {title}
      </button>
    </div>
  );
}

export function mapReportCardError(error: unknown) {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "NO_ENROLLMENT":
      return "No report card is available because the student was not enrolled that year";
    case "SECTION_TOO_LARGE":
      return "This section is too large to print in one batch. Please print in smaller batches.";
    case "Forbidden":
    case "403":
      return "You don't have access to this report card";
    default:
      return error.message;
  }
}
