"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR, { mutate, type SWRConfiguration } from "swr";
import { api, ApiError, LOGIN_PATHS, type Audience } from "./api";

/** SWR wrapper; sends the user to the right login page when the session has expired. */
export function useApi<T>(path: string | null, audience: Audience, config?: SWRConfiguration<T>) {
  const router = useRouter();
  const result = useSWR<T>(path, (p: string) => api<T>(p), { revalidateOnFocus: true, ...config });
  const unauthorized = result.error instanceof ApiError && result.error.status === 401;
  useEffect(() => {
    if (unauthorized) router.replace(LOGIN_PATHS[audience]);
  }, [unauthorized, router, audience]);
  return result;
}

/**
 * Drops every cached response, including cached 401s. Call when the session changes (sign-in, sign-out),
 * otherwise a stale 401 from before sign-in bounces the user straight back to the login page.
 */
export const clearApiCache = () => mutate(() => true, undefined, { revalidate: false });
