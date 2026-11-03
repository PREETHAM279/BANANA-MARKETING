import "server-only";
import { NextResponse } from "next/server";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJSON<T = Record<string, unknown>>(req: Request): Promise<T> {
  const type = req.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new HttpError("Expected application/json", 415);
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError("Invalid JSON body", 400);
  }
}

export class HttpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      console.error(e);
      return fail(e instanceof Error ? e.message : "Unexpected error", 500);
    }
  };
}

export function str(v: unknown, max = 5000): string {
  if (v == null) return "";
  return String(v).slice(0, max);
}

export function isISODate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
