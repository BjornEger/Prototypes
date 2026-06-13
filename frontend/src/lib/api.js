import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

export const ApiUsers = {
  list: () => api.get("/users").then((r) => r.data),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data),
  addMyActivity: (uid, aid) => api.post(`/users/${uid}/my-activities/${aid}`).then((r) => r.data),
  removeMyActivity: (uid, aid) => api.delete(`/users/${uid}/my-activities/${aid}`).then((r) => r.data),
  toggleFavorite: (uid, aid) => api.post(`/users/${uid}/favorites/${aid}`).then((r) => r.data),
};

export const ApiProjects = {
  list: () => api.get("/projects").then((r) => r.data),
};

export const ApiActivities = {
  list: (params = {}) => api.get("/activities", { params }).then((r) => r.data),
  create: (payload) => api.post("/activities", payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/activities/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/activities/${id}`).then((r) => r.data),
};

export const ApiTime = {
  list: (params) => api.get("/time-entries", { params }).then((r) => r.data),
  upsert: (payload) => api.post("/time-entries/upsert", payload).then((r) => r.data),
  saveWeek: (userId, weekStart) =>
    api
      .post("/time-entries/save-week", null, { params: { user_id: userId, week_start_date: weekStart } })
      .then((r) => r.data),
  copyPrevious: (userId, weekStart) =>
    api
      .post("/time-entries/copy-previous", null, { params: { user_id: userId, week_start_date: weekStart } })
      .then((r) => r.data),
};

export const ApiOverview = {
  get: (weekStart) => api.get("/overview", { params: { week_start_date: weekStart } }).then((r) => r.data),
};
