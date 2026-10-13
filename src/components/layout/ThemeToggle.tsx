"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("themechange", callback);
  return () => window.removeEventListener("themechange", callback);
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage unavailable: the theme still applies for this visit
    }
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={toggle}
      className="flex items-center gap-2 rounded-full p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <span aria-hidden="true" className="text-sm">☀️</span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          dark ? "bg-indigo-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[#ffffff] shadow transition-transform ${
            dark ? "translate-x-5" : ""
          }`}
        />
      </span>
      <span aria-hidden="true" className="text-sm">🌙</span>
    </button>
  );
}