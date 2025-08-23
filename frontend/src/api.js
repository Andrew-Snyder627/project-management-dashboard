const BASE_URL = "http://localhost:5000";

async function apiFetch(
  path,
  { method = "GET", body, headers = {}, etag } = {}
) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(etag ? { "If-None-Match": etag } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 304)
    return { status: 304, json: null, etag: etag || null };

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}

  if (!res.ok && json?.error) throw new Error(`${res.status} ${json.error}`);

  return { status: res.status, json, etag: res.headers.get("ETag") };
}

export const api = {
  // auth
  me: () => apiFetch("/auth/me"),
  login: (d) => apiFetch("/auth/login", { method: "POST", body: d }),
  signup: (d) => apiFetch("/auth/signup", { method: "POST", body: d }),
  logout: () => apiFetch("/auth/logout", { method: "DELETE" }),

  // meetings
  listMeetings: () => apiFetch("/meetings"),
  createMeeting: (d) => apiFetch("/meetings", { method: "POST", body: d }),
  getMeeting: (id) => apiFetch(`/meetings/${id}`),
  updateMeeting: (id, d) =>
    apiFetch(`/meetings/${id}`, { method: "PATCH", body: d }),
  deleteMeeting: (id) => apiFetch(`/meetings/${id}`, { method: "DELETE" }),

  // summaries
  summarize: (id) => apiFetch(`/meetings/${id}/summarize`, { method: "POST" }),
  getSummary: (id, etag) => apiFetch(`/meetings/${id}/summary`, { etag }),

  // action items
  listItems: (mid) => apiFetch(`/meetings/${mid}/action-items`),
  createItem: (mid, d) =>
    apiFetch(`/meetings/${mid}/action-items`, { method: "POST", body: d }),
  updateItem: (id, d) =>
    apiFetch(`/action-items/${id}`, { method: "PATCH", body: d }),
  deleteItem: (id) => apiFetch(`/action-items/${id}`, { method: "DELETE" }),
};
