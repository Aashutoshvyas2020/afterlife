"use client";

import { useSyncExternalStore } from "react";
import { getPro, setPro } from "./demo-session";

// UI-only demo state. Never use this as a real authorization or payment check.
const listeners = new Set<() => void>();
const snapshot = getPro;
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", listener); };
}
export function setDemoPro(value: boolean) {
  setPro(value);
  listeners.forEach(listener => listener());
}
export function useDemoPro() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
