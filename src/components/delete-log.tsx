"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteLog } from "@/app/actions/logs";

/**
 * Deleting is a one-way door, so it asks first. A second click on the same
 * control opens the question inline — no dialog, no framework, nothing to
 * install. Submitting the form runs the Server Action, which is what the
 * session and RLS are checked in.
 */
export function DeleteLog({ logId }: { logId: string }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Delete this log for good?
      </p>
      <form action={deleteLog} className="flex items-center gap-4">
        <input type="hidden" name="log_id" value={logId} />
        <ConfirmDeleteButton />
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          Keep it
        </button>
      </form>
    </div>
  );
}

function ConfirmDeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="text-xs uppercase tracking-widest text-red-600 underline-offset-4 hover:underline disabled:opacity-60 dark:text-red-400"
    >
      {pending ? "Deleting…" : "Yes, delete"}
    </button>
  );
}
