const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const getToken = () => localStorage.getItem("ca_token");
export const setSession = (token) => (token ? localStorage.setItem("ca_token", token) : localStorage.removeItem("ca_token"));

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(getToken() && { Authorization: `Bearer ${getToken()}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && getToken()) { setSession(null); window.location.reload(); }
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data?.detail;
    const msg = Array.isArray(d) ? d.map((e) => e.msg.replace("Value error, ", "")).join("; ") : d || "Something went wrong";
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}
