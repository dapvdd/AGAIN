"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BODY_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  EMPTY_LOG_FORM_STATE,
  TITLE_MAX_LENGTH,
  type LogFormState,
} from "@/lib/log-input";
import type { Category, Pillar } from "@/lib/types";

export interface LogFormDefaults {
  /** null on a new entry: the day is filled in from the browser's calendar. */
  loggedOn: string | null;
  pillar: string;
  categoryIds: string[];
  title: string;
  body: string;
}

interface LogFormProps {
  action: (state: LogFormState, formData: FormData) => Promise<LogFormState>;
  pillars: Pillar[];
  categories: Category[];
  /** Present on the edit form only: the row being changed. */
  logId?: string;
  defaults?: LogFormDefaults;
  submitLabel: string;
  cancelHref: string;
  cancelLabel?: string;
}

// A focus ring, not just a darker border: colour alone is not a focus
// indicator, and a keyboard user needs to see where they are in a form this
// long. The offset keeps the ring off the border so it reads at any contrast.
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950";

const labelClass = "text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400";

const hintClass = "text-xs text-zinc-500 dark:text-zinc-400";

const choiceClass =
  "block cursor-pointer rounded-full border border-zinc-300 px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-500 transition-colors select-none hover:border-zinc-400 peer-checked:border-zinc-900 peer-checked:text-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-400 peer-focus-visible:ring-offset-2 peer-focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:peer-checked:border-zinc-100 dark:peer-checked:text-zinc-50 dark:peer-focus-visible:ring-offset-zinc-950";

export function LogForm({
  action,
  pillars,
  categories,
  logId,
  defaults,
  submitLabel,
  cancelHref,
  cancelLabel = "Cancel",
}: LogFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    EMPTY_LOG_FORM_STATE,
  );
  const errors = state.errors;

  // The day is the one field whose default has to come from the user rather
  // than from the server: the same moment can be two different days in
  // Jakarta and in UTC. The field stays uncontrolled and is filled straight
  // into the DOM, so the server render and the first client render agree. The
  // action still falls back to today if the field arrives empty.
  const dayInput = useRef<HTMLInputElement>(null);
  const presetDay = defaults?.loggedOn ?? null;

  useEffect(() => {
    const input = dayInput.current;
    if (presetDay === null && input !== null && input.value === "") {
      input.value = localToday();
    }
  }, [presetDay]);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {logId ? <input type="hidden" name="log_id" value={logId} /> : null}

      {errors.form ? (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.form}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="logged_on" className={labelClass}>
          Day
        </label>
        <input
          id="logged_on"
          name="logged_on"
          type="date"
          required
          ref={dayInput}
          defaultValue={presetDay ?? undefined}
          className={`${inputClass} sm:max-w-[12rem]`}
        />
        {errors.loggedOn ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errors.loggedOn}
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className={labelClass}>Pillar</legend>
        <div className="flex flex-wrap gap-2">
          <label>
            <input
              type="radio"
              name="pillar"
              value=""
              defaultChecked={(defaults?.pillar ?? "") === ""}
              className="peer sr-only"
            />
            <span className={choiceClass}>None</span>
          </label>
          {pillars.map((pillar) => (
            <label key={pillar.key}>
              <input
                type="radio"
                name="pillar"
                value={pillar.key}
                defaultChecked={defaults?.pillar === pillar.key}
                className="peer sr-only"
              />
              <span className={choiceClass}>{pillar.label}</span>
            </label>
          ))}
        </div>
        {errors.pillar ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errors.pillar}
          </p>
        ) : (
          <p className={hintClass}>Optional.</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={labelClass}>Categories</legend>
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <label key={category.id}>
                <input
                  type="checkbox"
                  name="category_ids"
                  value={category.id}
                  defaultChecked={
                    defaults?.categoryIds.includes(category.id) ?? false
                  }
                  className="peer sr-only"
                />
                <span className={choiceClass}>{category.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className={hintClass}>No categories yet.</p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new_category" className={hintClass}>
            New category
          </label>
          <input
            id="new_category"
            name="new_category"
            type="text"
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            placeholder="Optional — created when you save"
            className={`${inputClass} sm:max-w-sm`}
          />
        </div>

        {errors.categories ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errors.categories}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="title" className={labelClass}>
            Title
          </label>
          <span className={hintClass}>Optional · {TITLE_MAX_LENGTH} max</span>
        </div>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={TITLE_MAX_LENGTH}
          defaultValue={defaults?.title ?? ""}
          placeholder="A few words to find it later"
          className={inputClass}
        />
        {errors.title ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errors.title}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="body" className={labelClass}>
            Note
          </label>
          <span className={hintClass}>Required</span>
        </div>
        <textarea
          id="body"
          name="body"
          required
          rows={12}
          maxLength={BODY_MAX_LENGTH}
          defaultValue={defaults?.body ?? ""}
          placeholder="What happened. No performance, no audience."
          className={`${inputClass} resize-y leading-6`}
        />
        {errors.body ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.body}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          {cancelLabel}
        </Link>
      </div>
    </form>
  );
}

/** Today on the user's own calendar, not the server's. */
function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
