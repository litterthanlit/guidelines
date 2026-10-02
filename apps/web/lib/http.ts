import "server-only";
import { OpError } from "@guidelines/core";
import { ConflictError, NotFoundError } from "@guidelines/core/store";
import { ZodError } from "zod";

export function errorResponse(err: unknown): Response {
  if (err instanceof ConflictError) {
    return Response.json({ error: err.message, code: "conflict", rev: err.actual }, { status: 409 });
  }
  if (err instanceof NotFoundError) return Response.json({ error: err.message, code: "not_found" }, { status: 404 });
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    return Response.json({ error: msg, code: "invalid" }, { status: 400 });
  }
  if (err instanceof OpError) return Response.json({ error: err.message, code: "invalid" }, { status: 400 });
  console.error(err);
  return Response.json({ error: "Internal error", code: "internal" }, { status: 500 });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return errorResponse(err);
  }
}
