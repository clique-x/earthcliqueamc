export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Audience = "company" | "vendor" | "admin";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const LOGIN_PATHS: Record<Audience, string> = { company: "/login", vendor: "/vendor/login", admin: "/admin/login" };

/** Calls the API with the session cookie. Throws ApiError with the server's message. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    credentials: "include",
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) throw new ApiError(res.status, data.message ?? `Request failed (${res.status})`);
  return data as T;
}

export async function uploadFile(path: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${API_URL}${path}`, { method: "POST", credentials: "include", body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, data.message ?? "Upload failed");
  }
}

/** Absolute URL for a protected file served by the API (`/files/...`). */
export const fileUrl = (path: string, as: Audience) => `${API_URL}${path}?as=${as}`;

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");
