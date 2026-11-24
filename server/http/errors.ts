import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, "Authentication required");
export const forbidden = () => new HttpError(403, "Insufficient permissions");

/** Wrap a route handler: maps HttpError / ZodError to JSON responses, hides unknown errors. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "Validation failed", details: z.flattenError(e) }, { status: 422 });
      console.error(e);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  return schema.parse(body);
}
