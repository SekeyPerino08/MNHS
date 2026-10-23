import { apiFetch } from "../../lib/api";
import type { SectionDetail, SectionInput, SectionPage, SectionParams } from "./types";
export async function fetchSections(params: SectionParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  return apiFetch<SectionPage>(`/api/sections?${query}`);
}
export async function fetchSection(id: string) { return apiFetch<{ data: SectionDetail }>(`/api/sections/${encodeURIComponent(id)}`); }
export async function createSection(input: SectionInput) { return apiFetch<{ data: unknown }>("/api/sections", { method: "POST", body: JSON.stringify(input) }); }
export async function updateSection(id: string, input: Partial<SectionInput>) { return apiFetch<{ data: unknown }>(`/api/sections/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }); }
export async function deleteSection(id: string) { return apiFetch<void>(`/api/sections/${encodeURIComponent(id)}`, { method: "DELETE" }); }
