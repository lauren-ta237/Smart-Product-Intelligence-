const configuredBackendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN || "").trim();

export const BACKEND_ORIGIN = configuredBackendOrigin.replace(/\/+$/, "");
export const API_BASE_URL = `${BACKEND_ORIGIN}/api/v1`;