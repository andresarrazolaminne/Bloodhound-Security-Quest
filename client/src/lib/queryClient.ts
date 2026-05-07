import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiCampaignSlug, withApiBase } from "./paths";

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
  campaignSlugOverride?: string | null,
): Promise<Response> {
  const campaignSlug =
    campaignSlugOverride !== undefined &&
    campaignSlugOverride !== null &&
    String(campaignSlugOverride).trim() !== ""
      ? String(campaignSlugOverride).trim()
      : getApiCampaignSlug();
  const apiUrl = withApiBase(url, campaignSlug);
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

  const ct = res.headers.get("content-type") || "";
  if (apiUrl.includes("/api") && ct.includes("text/html")) {
    return new Response(
      JSON.stringify({
        message:
          "El servidor respondió HTML en una ruta de API (suele indicar prefijo incorrecto o API no montada bajo esta URL). En producción define VITE_BASE_PATH y UI_BASE_PATH en el mismo proceso Node que sirve la app, igual que en el build del frontend.",
        code: "API_HTML_RESPONSE",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

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
    const campaignSlug = getApiCampaignSlug();
    const adminAuth = sessionStorage.getItem("adminApiToken");
    const headers: Record<string, string> = {};
    if (campaignSlug) headers["x-campaign-slug"] = campaignSlug;
    if (adminAuth) headers["x-admin-auth"] = adminAuth;
    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    const ct = res.headers.get("content-type") || "";
    if (url.includes("/api") && ct.includes("text/html")) {
      throw new Error(
        "Respuesta HTML en ruta API (revisa prefijo VITE_BASE_PATH/UI_BASE_PATH en el servidor Node).",
      );
    }

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
