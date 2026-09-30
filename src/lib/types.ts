export interface Profile {
  id: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The fixed compass. Not user-owned: the seven rows are seeded by the
 * migration and are only readable, never writable, from the client.
 */
export interface Pillar {
  key: string;
  label: string;
  sort_order: number;
}

/** A user-owned label for organising logs. */
export interface Category {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * A category as the management page shows it: the row, plus how many of the
 * user's logs carry it. The count is derived, not stored, and is the only
 * thing that makes the consequence of a delete sayable out loud.
 */
export interface CategorySummary {
  id: string;
  name: string;
  logCount: number;
}

/** One dated entry in a user's archive. */
export interface Log {
  id: string;
  user_id: string;
  logged_on: string;
  pillar: string | null;
  title: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

/** A log with its categories resolved. */
export interface LogWithCategories extends Log {
  categories: Category[];
}
