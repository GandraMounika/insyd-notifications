const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function http(path, opts) {
  const res = await fetch(BASE + path, {
    headers: { "content-type": "application/json" },
    ...opts
  });
  if (!res.ok) {
    let text = await res.text();
    throw new Error(text || "Request failed");
  }
  return res.json();
}

export const api = {
  listPosts: () => http("/posts"),
  createPost: (payload) => http("/posts", { method: "POST", body: JSON.stringify(payload) }),
  likePost: (id, actorId) => http(`/posts/${id}/like`, { method: "POST", body: JSON.stringify({ actorId }) }),
  listNotifications: (userId, limit=50) => http(`/notifications?userId=${encodeURIComponent(userId)}&limit=${limit}`),
  markRead: (id) => http(`/notifications/${id}/read`, { method: "PATCH" }),
  markAll: (userId) => http(`/notifications/read-all?userId=${encodeURIComponent(userId)}`, { method: "PATCH" }),
};