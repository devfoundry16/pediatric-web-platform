/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// ─── Supabase mock ────────────────────────────────────────────────────────────
// A chainable stand-in for the supabase-js query builder covering only the
// surface lib/google-calendar.ts uses. Every awaited query is recorded and
// resolved by a per-table handler, so tests assert on what was written.

export interface RecordedQuery {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  /** Every chained call, in order: { method: "eq", args: ["id", "..."] } */
  calls: Array<{ method: string; args: unknown[] }>;
  payload?: unknown;
}

export type TableResult = { data?: unknown; error?: { message: string } | null; count?: number };
export type TableHandler = (q: RecordedQuery) => TableResult;

export function has(q: RecordedQuery, method: string): boolean {
  return q.calls.some((c) => c.method === method);
}

export function argOf(q: RecordedQuery, method: string, field: string): unknown {
  return q.calls.find((c) => c.method === method && c.args[0] === field)?.args[1];
}

/**
 * Apply the query's eq/is/in filters to an in-memory row list, then honour
 * single/maybeSingle. Lets a handler stand in for a real table with one line.
 */
export function applyFilters(rows: any[], q: RecordedQuery): TableResult {
  let out = [...rows];
  for (const call of q.calls) {
    const [field, value] = call.args as [string, any];
    if (call.method === "eq") out = out.filter((r) => r[field] === value);
    else if (call.method === "is") out = out.filter((r) => r[field] === value);
    else if (call.method === "in") out = out.filter((r) => (value as any[]).includes(r[field]));
    else if (call.method === "neq") out = out.filter((r) => r[field] !== value);
  }
  if (has(q, "single") || has(q, "maybeSingle")) {
    return { data: out[0] ?? null };
  }
  return { data: out, count: out.length };
}

export function createSupabaseMock(handlers: Record<string, TableHandler> = {}) {
  const queries: RecordedQuery[] = [];
  const getUserById = vi.fn(async (_id: string): Promise<any> => ({
    data: { user: null },
    error: null,
  }));

  function from(table: string) {
    const q: RecordedQuery = { table, op: "select", calls: [] };
    const builder: any = {};
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        q.calls.push({ method, args });
        return builder;
      };
    for (const m of [
      "select",
      "eq",
      "neq",
      "in",
      "is",
      "gt",
      "gte",
      "lt",
      "lte",
      "not",
      "order",
      "limit",
      "range",
      "single",
      "maybeSingle",
    ]) {
      builder[m] = chain(m);
    }
    for (const op of ["insert", "update", "delete", "upsert"] as const) {
      builder[op] = (payload?: unknown) => {
        q.op = op;
        if (payload !== undefined) q.payload = payload;
        return builder;
      };
    }
    builder.then = (resolve: any, reject: any) => {
      queries.push(q);
      const result = handlers[table] ? handlers[table](q) : {};
      return Promise.resolve({
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null,
      }).then(resolve, reject);
    };
    return builder;
  }

  const client = { from, auth: { admin: { getUserById } } };
  return { client, queries, getUserById, handlers };
}

/**
 * Stateful stand-in for calendar_event_mirrors: upserts and deletes mutate the
 * backing array, so delete-path and stale-target tests see real state.
 */
export function createMirrorStore(initial: any[] = []) {
  const rows: any[] = [...initial];
  const handler: TableHandler = (q) => {
    if (q.op === "upsert") {
      const p = q.payload as any;
      const existing = rows.find(
        (r) =>
          r.account_id === p.account_id &&
          r.related_type === p.related_type &&
          r.related_id === p.related_id
      );
      if (existing) existing.google_event_id = p.google_event_id;
      else rows.push({ ...p });
      return {};
    }
    if (q.op === "delete") {
      const accountId = argOf(q, "eq", "account_id");
      const relatedType = argOf(q, "eq", "related_type");
      const relatedId = argOf(q, "eq", "related_id");
      for (let i = rows.length - 1; i >= 0; i--) {
        if (
          rows[i].account_id === accountId &&
          rows[i].related_type === relatedType &&
          rows[i].related_id === relatedId
        ) {
          rows.splice(i, 1);
        }
      }
      return {};
    }
    return applyFilters(rows, q);
  };
  return { rows, handler };
}

// ─── fetch mock ───────────────────────────────────────────────────────────────

export interface FetchCall {
  method: string;
  url: string;
  body?: any;
  authorization?: string;
}

export interface FetchRoute {
  match: (method: string, url: string) => boolean;
  respond: (call: FetchCall) => Response | Promise<Response>;
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function empty(status: number): Response {
  return new Response(null, { status });
}

export function createFetchMock(routes: FetchRoute[]) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: any, init?: any): Promise<Response> => {
    const method: string = init?.method ?? "GET";
    let body: any;
    const raw = init?.body;
    if (raw instanceof URLSearchParams) body = Object.fromEntries(raw);
    else if (typeof raw === "string") {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
    const call: FetchCall = {
      method,
      url: String(url),
      body,
      authorization: init?.headers?.Authorization,
    };
    calls.push(call);
    for (const route of routes) {
      if (route.match(method, call.url)) return route.respond(call);
    }
    throw new Error(`Unmatched fetch: ${method} ${call.url}`);
  });
  return { fn, calls, routes };
}

/**
 * Route answering Google's refresh-token grant. Maps each stored refresh token
 * to a distinct access token so tests can prove per-account isolation.
 */
export function tokenRefreshRoute(byRefreshToken: Record<string, string> = {}): FetchRoute {
  return {
    match: (method, url) =>
      method === "POST" && url.startsWith("https://oauth2.googleapis.com/token"),
    respond: (call) => {
      const refresh = call.body?.refresh_token as string | undefined;
      const access = (refresh && byRefreshToken[refresh]) || "test-access-token";
      return json(200, { access_token: access, expires_in: 3600 });
    },
  };
}
