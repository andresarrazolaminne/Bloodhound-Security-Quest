import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getActiveCampaignSlug, withApiBase } from "./paths";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const apiUrl = withApiBase(url);
  const campaignSlug = getActiveCampaignSlug();
  const adminAuth = sessionStorage.getItem("adminApiToken");
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  if (campaignSlug) headers["x-campaign-slug"] = campaignSlug;
  if (adminAuth) headers["x-admin-auth"] = adminAuth;
  const res = await fetch(apiUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Don't throw errors automatically - let the calling function handle this
  // This allows more control for handling specific status codes like 404
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = typeof queryKey[0] === "string" ? withApiBase(queryKey[0]) : String(queryKey[0]);
    const campaignSlug = getActiveCampaignSlug();
    const adminAuth = sessionStorage.getItem("adminApiToken");
    const headers: Record<string, string> = {};
    if (campaignSlug) headers["x-campaign-slug"] = campaignSlug;
    if (adminAuth) headers["x-admin-auth"] = adminAuth;
    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
