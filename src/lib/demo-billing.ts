"use client";

import { useSyncExternalStore } from "react";

// UI-only demo state. Never use this as a real authorization or payment check.
let unlocked = false;
const listeners = new Set<() => void>();
const key = "pocketscan-demo-pro";
function snapshot() {
  try { return sessionStorage.getItem(key) === "true" || unlocked; }
  catch { return unlocked; }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", listener); };
}
export function setDemoPro(value: boolean) {
  unlocked = value;
  try { sessionStorage.setItem(key, String(value)); } catch { /* In-memory fallback for restricted browsers. */ }
  listeners.forEach(listener => listener());
}
export function useDemoPro() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
