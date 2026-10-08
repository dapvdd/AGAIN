/**
 * A scripted stand-in for the Supabase client, for the unit tests.
 *
 * What it can prove:
 *   - every statement the application builds: table, operation, columns,
 *     payload, filters, limit;
 *   - how the application reacts when a statement comes back empty or fails.
 *
 * The test scripts the response for each statement. A statement the test did
 * not script is answered with an error *and* recorded in `unhandled`, so a
 * test cannot quietly pass because a query went nowhere.
 *
 * What it cannot prove: Row Level Security. "The row is not visible" in these
 * tests means *the scripted response was empty* — that exercises the
 * application's handling of a filtered result, never the filtering itself.
 * Whether PostgreSQL actually hides the row belongs to the RLS policies and
 * stays covered by the live, manual security verification against a real
 * database. Nothing here should ever be described as an RLS test.
 */

export type FakeOp = "select" | "insert" | "update" | "delete";

export interface FakeFilter {
  kind: "eq" | "in" | "ilike" | "gte" | "lt";
  column: string;
  value: unknown;
}

export interface FakeOrder {
  column: string;
  ascending: boolean;
}

/** One statement, as the application built it. */
export interface FakeCall {
  table: string;
  op: FakeOp;
  columns?: string;
  payload?: unknown;
  filters: FakeFilter[];
  orders: FakeOrder[];
  limit?: number;
}

export interface FakeError {
  code: string;
  message: string;
}

export interface FakeResponse {
  data?: unknown;
  error?: FakeError | null;
}

export type FakeResponder = (call: FakeCall) => FakeResponse | null | undefined;

/** The session `auth.getUser()` hands back. */
export interface FakeSession {
  id: string;
  [claim: string]: unknown;
}

export interface FakeSupabase {
  client: FakeClient;
  /** Every statement the application executed, in order. */
  calls: FakeCall[];
  /** Statements no test scripted. Always expected to be empty. */
  unhandled: FakeCall[];
  callsTo(table: string, op?: FakeOp): FakeCall[];
}

export interface FakeClient {
  auth: {
    getUser(): Promise<{ data: { user: FakeSession | null }; error: FakeError | null }>;
  };
  from(table: string): FakeQueryBuilder;
}

class FakeQueryBuilder implements PromiseLike<FakeResponse> {
  private readonly call: FakeCall;
  private executed = false;

  constructor(
    private readonly owner: FakeSupabase,
    private readonly respond: FakeResponder,
    table: string,
  ) {
    this.call = { table, op: "select", filters: [], orders: [] };
  }

  select(columns?: string): this {
    this.call.columns = columns;
    return this;
  }

  insert(payload: unknown): this {
    this.call.op = "insert";
    this.call.payload = payload;
    return this;
  }

  update(payload: unknown): this {
    this.call.op = "update";
    this.call.payload = payload;
    return this;
  }

  delete(): this {
    this.call.op = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.filter("eq", column, value);
  }

  in(column: string, values: unknown[]): this {
    return this.filter("in", column, values);
  }

  ilike(column: string, pattern: string): this {
    return this.filter("ilike", column, pattern);
  }

  gte(column: string, value: unknown): this {
    return this.filter("gte", column, value);
  }

  lt(column: string, value: unknown): this {
    return this.filter("lt", column, value);
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.call.orders.push({
      column,
      ascending: options?.ascending ?? true,
    });
    return this;
  }

  limit(count: number): this {
    this.call.limit = count;
    return this;
  }

  /** PostgREST's single-row shape: an empty result is `null`, not an error. */
  maybeSingle(): Promise<{ data: unknown; error: FakeError | null }> {
    return this.run().then((response) => {
      if (response.error) {
        return { data: null, error: response.error };
      }

      const { data } = response;
      if (Array.isArray(data)) {
        if (data.length > 1) {
          return {
            data: null,
            error: { code: "PGRST116", message: "expected at most one row" },
          };
        }
        return { data: data[0] ?? null, error: null };
      }

      return { data: data ?? null, error: null };
    });
  }

  then<TResult1 = FakeResponse, TResult2 = never>(
    onfulfilled?:
      | ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private filter(kind: FakeFilter["kind"], column: string, value: unknown): this {
    this.call.filters.push({ kind, column, value });
    return this;
  }

  private run(): Promise<FakeResponse> {
    if (this.executed) {
      return Promise.resolve({ data: null, error: null });
    }
    this.executed = true;
    this.owner.calls.push(this.call);

    const scripted = this.respond(this.call);
    if (!scripted) {
      this.owner.unhandled.push(this.call);
      return Promise.resolve({
        data: null,
        error: {
          code: "FAKE_UNHANDLED",
          message: `no scripted response for ${this.call.op}:${this.call.table}`,
        },
      });
    }

    return Promise.resolve({
      data: scripted.data ?? null,
      error: scripted.error ?? null,
    });
  }
}

export interface FakeSupabaseOptions {
  /** Answers each statement. An unscripted statement becomes an error. */
  respond?: FakeResponder;
  /** The session `auth.getUser()` reports. `null` means signed out. */
  user?: FakeSession | null;
}

export function createFakeSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const respond = options.respond ?? (() => null);
  const calls: FakeCall[] = [];
  const unhandled: FakeCall[] = [];

  const fake: FakeSupabase = {
    client: {
      auth: {
        getUser: async () => ({
          data: { user: options.user ?? null },
          error: null,
        }),
      },
      from: (table: string) => new FakeQueryBuilder(fake, respond, table),
    },
    calls,
    unhandled,
    callsTo: (table, op) =>
      calls.filter(
        (call) => call.table === table && (op === undefined || call.op === op),
      ),
  };

  return fake;
}

/** Looks a statement up by `"op:table"`, e.g. `"select:pillars"`. */
export function responderFor(
  responses: Record<string, FakeResponse>,
): FakeResponder {
  return (call) => responses[`${call.op}:${call.table}`] ?? null;
}
