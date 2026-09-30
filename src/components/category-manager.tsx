"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import {
  createCategory,
  deleteCategory,
  renameCategory,
} from "@/app/actions/categories";
import {
  CATEGORY_NAME_MAX_LENGTH,
  INITIAL_CATEGORY_RESULT,
} from "@/lib/category-input";
import type { CategorySummary } from "@/lib/types";

/**
 * The category surface: one box to add a name, one row per category to rename
 * or remove it.
 *
 * Everything happens in place. There is no dialog and no notification system
 * to install, because there is nothing here worth interrupting for: a rename
 * replaces the row's label with a field, a delete asks its question on the same
 * line and then either the row is gone or it is not. Errors are printed under
 * the field that caused them, which is the same convention the log form uses.
 */

// A focus ring, not just a darker border: colour alone is not a focus
// indicator, and a keyboard user needs to see where they are.
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950";

const labelClass =
  "text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400";

const quietClass =
  "text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100";

const errorClass = "text-xs text-red-600 dark:text-red-400";

export function CategoryManager({
  categories,
}: {
  categories: CategorySummary[];
}) {
  return (
    <div className="flex flex-col">
      <CreateCategoryForm />

      {categories.length === 0 ? (
        <p className="mt-10 border-t border-zinc-200 pt-8 text-sm leading-7 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          No categories yet.
          <br />
          Name the things you keep coming back to.
        </p>
      ) : (
        <ul className="mt-10 flex flex-col border-t border-zinc-200 dark:border-zinc-800">
          {categories.map((category) => (
            <li
              key={category.id}
              className="border-b border-zinc-200 dark:border-zinc-800"
            >
              <CategoryRow category={category} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateCategoryForm() {
  const [result, formAction, pending] = useActionState(
    createCategory,
    INITIAL_CATEGORY_RESULT,
  );
  const errors = result.ok ? null : result.errors;

  // The box is emptied after a save. The category exists now, so leaving the
  // name sitting in the field would only invite a second submission of it and
  // the duplicate-name refusal that follows.
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (result.ok && result.saved && nameInput.current !== null) {
      nameInput.current.value = "";
    }
  }, [result]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="category_name" className={labelClass}>
        New category
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <input
          id="category_name"
          name="name"
          type="text"
          ref={nameInput}
          maxLength={CATEGORY_NAME_MAX_LENGTH}
          required
          placeholder="Work, Health, Late nights"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="shrink-0 self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {errors?.form ? (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.form}</p>
      ) : null}
      {errors?.name ? <p className={errorClass}>{errors.name}</p> : null}
    </form>
  );
}

type RowMode = "idle" | "rename" | "delete";

function CategoryRow({ category }: { category: CategorySummary }) {
  const [mode, setMode] = useState<RowMode>("idle");

  // Stable, so the rename form's effect fires once per save and not once per
  // render of the row it lives in.
  const showName = useCallback(() => setMode("idle"), []);
  const startRename = useCallback(() => setMode("rename"), []);
  const startDelete = useCallback(() => setMode("delete"), []);

  return (
    <div className="flex flex-col gap-3 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        {mode === "rename" ? (
          <RenameForm
            category={category}
            onSaved={showName}
            onCancel={showName}
          />
        ) : (
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {category.name}
            </p>
            <p className={`mt-1 ${labelClass}`}>{usageLabel(category.logCount)}</p>
          </div>
        )}

        {mode === "idle" ? (
          <div className="flex shrink-0 items-center gap-4">
            <button type="button" onClick={startRename} className={quietClass}>
              Rename
            </button>
            <button type="button" onClick={startDelete} className={quietClass}>
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {mode === "delete" ? (
        <DeletePrompt category={category} onCancel={showName} />
      ) : null}
    </div>
  );
}

function RenameForm({
  category,
  onSaved,
  onCancel,
}: {
  category: CategorySummary;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [result, formAction, pending] = useActionState(
    renameCategory,
    INITIAL_CATEGORY_RESULT,
  );
  const errors = result.ok ? null : result.errors;

  // The row goes back to reading as a name once the write lands, and the page
  // around it re-renders with the new label.
  const saved = result.ok && result.saved;
  useEffect(() => {
    if (saved) {
      onSaved();
    }
  }, [saved, onSaved]);

  const fieldId = `category_name_${category.id}`;

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <input type="hidden" name="category_id" value={category.id} />
      <label htmlFor={fieldId} className="sr-only">
        Rename {category.name}
      </label>
      <input
        id={fieldId}
        name="name"
        type="text"
        defaultValue={category.name}
        maxLength={CATEGORY_NAME_MAX_LENGTH}
        required
        autoFocus
        className={inputClass}
      />
      {errors?.form ? (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.form}</p>
      ) : null}
      {errors?.name ? <p className={errorClass}>{errors.name}</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className={quietClass}>
          Keep the name
        </button>
      </div>
    </form>
  );
}

/**
 * The question, asked on the row itself. The count is stated before the
 * answer, because "delete" and "forget this label" are the same word to
 * somebody who has just spent an evening tagging three years of entries, and
 * the difference is which one they meant.
 */
function DeletePrompt({
  category,
  onCancel,
}: {
  category: CategorySummary;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {deletionWarning(category.logCount)}
      </p>
      <form action={deleteCategory} className="flex items-center gap-4">
        <input type="hidden" name="category_id" value={category.id} />
        <ConfirmRemoveButton />
        <button type="button" onClick={onCancel} className={quietClass}>
          Keep it
        </button>
      </form>
    </div>
  );
}

function ConfirmRemoveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="text-xs uppercase tracking-widest text-red-600 underline-offset-4 hover:underline disabled:opacity-60 dark:text-red-400"
    >
      {pending ? "Removing…" : "Yes, remove"}
    </button>
  );
}

function usageLabel(logCount: number): string {
  if (logCount === 0) {
    return "No logs yet";
  }

  return logCount === 1 ? "1 log" : `${logCount} logs`;
}

function deletionWarning(logCount: number): string {
  if (logCount === 0) {
    return "Remove this category? No logs use it.";
  }

  if (logCount === 1) {
    return "Remove this category? 1 log loses the tag, none is deleted.";
  }

  return `Remove this category? ${logCount} logs lose the tag, none are deleted.`;
}
