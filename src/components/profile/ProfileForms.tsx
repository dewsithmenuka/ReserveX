"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnPrimary, inputCls, labelCls } from "@/components/ui/styles";

type Msg = { ok: boolean; text: string } | null;

function errorText(
  data: {
    error?: {
      message?: string;
      details?: { path: string; message: string }[];
    };
  } | null,
) {
  const d = data?.error?.details?.[0];
  return d ? `${d.path}: ${d.message}` : (data?.error?.message ?? "Something went wrong");
}

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;

  return (
    <p
      role={msg.ok ? "status" : "alert"}
      className={`rounded-lg px-3 py-2 text-sm ${
        msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {msg.text}
    </p>
  );
}

export function NameForm({ name }: { name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("name") ?? "").trim();

    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });

      if (!res.ok) {
        setMsg({ ok: false, text: errorText(await res.json().catch(() => null)) });
        return;
      }

      setMsg({ ok: true, text: "Name updated." });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="name" className={labelCls}>
          Full name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={name}
          className={inputCls}
        />
      </div>

      <Message msg={msg} />

      <button type="submit" disabled={busy} className={btnPrimary}>
        {busy ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);

    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(f.get("currentPassword") ?? ""),
          newPassword: String(f.get("newPassword") ?? ""),
        }),
      });

      if (!res.ok) {
        setMsg({ ok: false, text: errorText(await res.json().catch(() => null)) });
        return;
      }

      form.reset();
      setMsg({ ok: true, text: "Password changed." });
    } catch {
      setMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="currentPassword" className={labelCls}>
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="newPassword" className={labelCls}>
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={10}
          maxLength={72}
          autoComplete="new-password"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-slate-500">
          At least 10 characters, with upper and lower case letters and a number.
        </p>
      </div>

      <Message msg={msg} />

      <button type="submit" disabled={busy} className={btnPrimary}>
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}