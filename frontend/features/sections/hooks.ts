"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSection, deleteSection, fetchSection, fetchSections, updateSection } from "./api";
import type { SectionParams, SectionInput } from "./types";
export const sectionKeys = { all: ["sections"] as const, lists: () => [...sectionKeys.all, "list"] as const, list: (params: SectionParams) => [...sectionKeys.lists(), params] as const, details: () => [...sectionKeys.all, "detail"] as const, detail: (id: string) => [...sectionKeys.details(), id] as const };
export function useSections(params: SectionParams, enabled = true) { return useQuery({ queryKey: sectionKeys.list(params), queryFn: () => fetchSections(params), placeholderData: (previous) => previous, enabled }); }
export function useSection(id: string) { return useQuery({ queryKey: sectionKeys.detail(id), queryFn: async () => (await fetchSection(id)).data, enabled: Boolean(id) }); }
function useInvalidateSections() { const client = useQueryClient(); return () => client.invalidateQueries({ queryKey: sectionKeys.all }); }
export function useCreateSection() { const invalidateQueries = useInvalidateSections(); return useMutation({ mutationFn: createSection, onSuccess: invalidateQueries }); }
export function useUpdateSection() { const invalidateQueries = useInvalidateSections(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<SectionInput> }) => updateSection(id, input), onSuccess: invalidateQueries }); }
export function useDeleteSection() { const invalidateQueries = useInvalidateSections(); return useMutation({ mutationFn: deleteSection, onSuccess: invalidateQueries }); }
