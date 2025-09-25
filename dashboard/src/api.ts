// dashboard/src/api.ts
const RAW = (process.env.REACT_APP_API_BASE || "").trim();
// strip trailing slash if present
export const API_BASE = RAW.endsWith("/") ? RAW.slice(0, -1) : RAW;

export async function apiFetch(path: string, init?: RequestInit) {
    const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, init);
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    // callers that expect JSON can parse; others can read text if needed
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return res.json();
    return res.text();
}