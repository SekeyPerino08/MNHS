"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyProfile } from "./api";

export function useMyProfile() {
  return useQuery({ queryKey: ["my-profile"], queryFn: fetchMyProfile });
}
