"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export function HealthStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let active = true;
    apiFetch<{ status: string }>("/api/health")
      .then((result) => {
        if (active) setStatus(result.status === "ok" ? "online" : "offline");
      })
      .catch(() => {
        if (active) setStatus("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <p className="mt-6 text-center text-xs text-slate-400" aria-live="polite">
      API status: {status === "checking" ? "Checking…" : status === "online" ? "Connected" : "Unavailable"}
    </p>
  );
}
