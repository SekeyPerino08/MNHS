"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  commitImport,
  discardImport,
  fetchImportHistory,
  fetchImportJob,
  fetchImportRows,
  previewImport,
} from "./api";
import type {
  ImportCommitOptions,
  ImportDateFormat,
  ImportRowFilter,
  ImportType,
} from "../../types/imports";

export const importKeys = {
  all: ["imports"] as const,
  history: () => [...importKeys.all, "history"] as const,
  historyPage: (params: { page: number; pageSize: number }) => [...importKeys.history(), params] as const,
  job: (id: string) => [...importKeys.all, "job", id] as const,
  rows: (id: string, params: { status: ImportRowFilter; page: number; pageSize: number }) =>
    [...importKeys.all, "rows", id, params] as const,
};

export function usePreviewImport() {
  return useMutation({
    mutationFn: (input: { file: File; type: ImportType; dateFormat: ImportDateFormat }) => previewImport(input),
  });
}

export function useImportJob(id: string, enabled = true) {
  return useQuery({
    queryKey: importKeys.job(id),
    queryFn: () => fetchImportJob(id),
    enabled: Boolean(id) && enabled,
    gcTime: 0,
    retry: false,
  });
}

export function useImportRows(
  id: string,
  params: { status: ImportRowFilter; page: number; pageSize: number },
  enabled = true,
) {
  return useQuery({
    queryKey: importKeys.rows(id, params),
    queryFn: () => fetchImportRows(id, params),
    enabled: Boolean(id) && enabled,
    gcTime: 0,
    placeholderData: (previous) => previous,
    retry: false,
  });
}

export function useCommitImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, options }: { id: string; options: ImportCommitOptions }) => commitImport(id, options),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["students"] }),
        client.invalidateQueries({ queryKey: ["teachers"] }),
        client.invalidateQueries({ queryKey: ["enrollments"] }),
        client.invalidateQueries({ queryKey: ["sections"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: importKeys.history() }),
      ]);
    },
  });
}

export function useDiscardImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: discardImport,
    onSuccess: async (_data, id) => {
      await client.invalidateQueries({ queryKey: importKeys.history() });
      client.removeQueries({ queryKey: importKeys.job(id), exact: true });
      client.removeQueries({ queryKey: [...importKeys.all, "rows", id] });
    },
  });
}

export function useImportHistory(params: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: importKeys.historyPage(params),
    queryFn: () => fetchImportHistory(params),
    placeholderData: (previous) => previous,
  });
}
