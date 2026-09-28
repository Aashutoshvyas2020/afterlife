"use client";

import { useCallback, useEffect, useState } from "react";

export type ServiceStatus = {
  selectedRepository: string;
  productName: string;
  resurrection: { status: string; evidence?: string; detail?: string; taskId?: string; revision?: string; decision?: string };
  artifact: { status: string; error?: string };
  deployment: { status: string; scope?: string; productionUrl?: string };
  stripe: { status: string; amount?: number; currency?: string; error?: string };
  qa: { status: string; detail?: string };
  latestError: string | null;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init, signal: init?.signal ?? AbortSignal.timeout(25000) });
  let value;
  try { value = await response.json(); }
  catch { throw new Error("The service is unavailable. Please retry in a moment."); }
  if (!response.ok) throw new Error(value.error || "The request could not be completed. Please retry.");
  return value as T;
}

export function formatPrice(stripe?: ServiceStatus["stripe"]) {
  if (stripe?.status !== "ready" || typeof stripe.amount !== "number" || !stripe.currency) return "Price pending";
  const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency: stripe.currency });
  return formatter.format(stripe.amount / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2));
}

export function useService() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    Promise.all([api<ServiceStatus>("/api/status", { signal }), api<{ entitled: boolean }>("/api/entitlement", { signal })])
      .then(([service, access]) => { if (!controller.signal.aborted) { setStatus(service); setEntitled(access.entitled === true); setError(""); } })
      .catch(cause => { if (!controller.signal.aborted) { setStatus(null); setEntitled(false); setError(cause instanceof Error ? cause.message : "Service unavailable. Retry in a moment."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  return { status, entitled, loading, error, refresh };
}
