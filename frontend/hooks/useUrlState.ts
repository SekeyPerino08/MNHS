"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type UrlValue = string | undefined;
type UrlUpdates = Record<string, string | number | null | undefined>;

export function useUrlState(defaults: Record<string, string>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timer = useRef<number | null>(null);

  const values = useMemo(() => {
    const parsed: Record<string, UrlValue> = { ...defaults };
    searchParams.forEach((value, key) => { parsed[key] = value; });
    return parsed;
  }, [defaults, searchParams]);

  const update = useCallback((updates: UrlUpdates, resetPage = true) => {
    const next = new URLSearchParams(searchParams.toString());
    if (resetPage && !("page" in updates)) next.set("page", "1");
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    router.push(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const updateSearch = useCallback((search: string, delay = 400) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      update({ search: search.trim() || null }, true);
      timer.current = null;
    }, delay);
  }, [update]);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  return { values, update, updateSearch, clear };
}
