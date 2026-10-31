import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg, "bad_request");
export const unauthorized = (msg = "Not signed in") => new HttpError(401, msg, "unauthorized");
export const forbidden = (msg = "Not allowed") => new HttpError(403, msg, "forbidden");
export const notFound = (msg = "Not found") => new HttpError(404, msg, "not_found");
export const conflict = (msg: string, code = "conflict") => new HttpError(409, msg, code);

/** Parses input with a zod schema; ZodErrors are turned into 400s by the error handler. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}
