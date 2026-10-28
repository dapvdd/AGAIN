"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createLog } from "@/app/actions/logs";
import {
  EMPTY_LOG_FORM_STATE,
  type LogFormState,
} from "@/lib/log-input";
import type { Pillar } from "@/lib/types";

/**
 * Minimal log capture — designed for the case where you just want to write
 * something down without navigating to a form. Only body and day are
 * required; pillar and categories are collapsible options.
 *
 * Shown as a sticky trigger in the app layout header; when open it renders as
 * a full-width strip on mobile (bottom-sheet style, above the nav) and as a
 * slim inline panel on wide screens.
 *
 * Submitting it calls the same `createLog` action as the full form, so the
 * archive and the navigation are updated the same way they would be on a full
 * submit. A successful save redirects to the new log's page.
 */

interface QuickLogProps {
  pillars: Pillar[];
  /** Pop open when true. The parent controls this via the open/close setter. */
  initialOpen?: boolean;
  onClose?: () => void;
}

export function QuickLog({ pillars, initialOpen = false }: QuickLogProps) {
  const [open, setOpen] = useState(initialOpen);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  const today = localToday();
  const [defaults] = useState(() => ({ loggedOn: today, pillar: "", categoryIds: [], title: "", body: "" }));

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="quick-log-panel"
        aria-label={open ? "Close quick log" : "Open quick log"}
        className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950 sm:px-4 sm:py-2 sm:text-sm"
      >
        {open ? "Done" : "Log"}
      </button>

      {open ? (
        <div
          id="quick-log-panel"
          role="region"
          aria-label="Quick log"
          className="absolute left-0 right-0 top-full z-50 border-t border-zinc-200 bg-white px-4 py-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 sm:static sm:border-0 sm:shadow-none"
        >
          <QuickLogForm pillars={pillars} defaults={defaults} />
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// The form itself — separated so it can also be rendered on /app/quick
// ---------------------------------------------------------------------------

export interface QuickLogDefaults {
  loggedOn: string;
  pillar: string;
  categoryIds: string[];
  title: string;
  body: string;
}

interface QuickLogFormProps {
  pillars: Pillar[];
  defaults: QuickLogDefaults;
}

const EMPTY_STATE: LogFormState = { errors: {} };

export function QuickLogForm({ pillars, defaults }: QuickLogFormProps) {
  const [state, formAction, pending] = useActionState(
    quickLogAction,
    EMPTY_STATE,
  );

  // When the server action returns a redirect, the page navigates away.
  // If it returns form errors we surface the most actionable one.
  const topError =
    !state || Object.keys(state.errors ?? {}).length === 0
      ? null
      : state.errors.form ??
        state.errors.body ??
        state.errors.loggedOn ??
        "Could not save. Try again.";

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const [idempotencyKey] = useState(() => generateUuid());

  // Auto-focus the body on mount
  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  // Pre-fill today if the day field is still empty (SSR vs client mismatch)
  useEffect(() => {
    const input = dayRef.current;
    if (input && input.value === "") {
      input.value = defaults.loggedOn;
    }
  }, [defaults.loggedOn]);

  const choiceClass =
    "cursor-pointer rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] uppercase tracking-widest transition-colors select-none hover:border-zinc-400 peer-checked:border-zinc-900 peer-checked:text-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-400 peer-focus-visible:ring-offset-1 peer-focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:peer-checked:border-zinc-100 dark:peer-checked:text-zinc-50 dark:peer-focus-visible:ring-zinc-500 dark:peer-focus-visible:ring-offset-zinc-950";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="logged_on" defaultValue={defaults.loggedOn} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />

      {topError && (
        <p className="text-xs text-red-600 dark:text-red-400">{topError}</p>
      )}

      {/* Day — small, one-line */}
      <div className="flex items-center gap-2">
        <label htmlFor="quick-logged_on" className="sr-only">
          Day
        </label>
        <input
          id="quick-logged_on"
          name="logged_on"
          type="date"
          ref={dayRef}
          defaultValue={defaults.loggedOn}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950 sm:max-w-[10rem]"
        />
      </div>

      {/* Body — the only thing that is truly required */}
      <div className="flex flex-col gap-1">
        <label htmlFor="quick-body" className="sr-only">
          Note
        </label>
        <textarea
          id="quick-body"
          name="body"
          ref={bodyRef}
          rows={4}
          maxLength={20_000}
          required
          placeholder="What happened."
          className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950"
        />
      </div>

      {/* Pillar — compact horizontal strip */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="sr-only">Pillar</legend>
        <div className="flex flex-wrap gap-1">
          <label>
            <input
              type="radio"
              name="pillar"
              value=""
              defaultChecked
              className="peer sr-only"
            />
            <span className={choiceClass}>None</span>
          </label>
          {pillars.map((p) => (
            <label key={p.key}>
              <input
                type="radio"
                name="pillar"
                value={p.key}
                defaultChecked={defaults.pillar === p.key}
                className="peer sr-only"
              />
              <span className={choiceClass}>{p.key}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Save log"}
        </button>
        <Link
          href="/app/logs/new"
          className="text-[10px] uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400 sm:text-xs"
        >
          Full form
        </Link>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// The Server Action wrapper — calls the full createLog action but discards
// server-rendered form errors for the quick path. On success createLog
// redirects; the framework converts that into a form-reset and the page
// navigates away, which is the correct UX: the user wrote it, they're there.
// ---------------------------------------------------------------------------

async function quickLogAction(
  _prev: LogFormState,
  formData: FormData,
): Promise<LogFormState> {
  try {
    const result = await createLog(EMPTY_LOG_FORM_STATE, formData);
    // createLog redirects on success, so we only reach here on error.
    return result;
  } catch {
    // A redirect thrown by createLog on success — the framework catches it and
    // the page navigates. Return a dummy "ok" state so useActionState is happy.
    return { errors: {} };
  }
}

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** A v4-ish uuid from the browser's cryptographic random source. */
function generateUuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
