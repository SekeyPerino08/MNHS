"use client";

import { toast } from "sonner";
import type { ReportFilters } from "../../types/reports";
import { friendlyReportMessage } from "./api-messages";
import { downloadReportFile } from "./api";

export async function downloadReport(key: string, filters: ReportFilters): Promise<string> {
  const toastId = toast.loading("Preparing download");
  try {
    const filename = await downloadReportFile(key, filters);
    toast.success(`Download started: ${filename}`, { id: toastId });
    return filename;
  } catch (error) {
    toast.error(friendlyReportMessage(error), { id: toastId });
    throw error;
  }
}
