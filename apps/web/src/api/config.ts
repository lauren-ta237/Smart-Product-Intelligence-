const configuredApiUrl = (
	import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_ORIGIN || ""
).trim();

// Recover the backend URL if a frontend origin was accidentally prefixed to it.
const backendUrl = configuredApiUrl.replace(/^https?:\/\/[^/]+\/(https?:\/\/)/i, "$1");
const normalizedBackendUrl = backendUrl.replace(/\/+$/, "");

export const BACKEND_ORIGIN = normalizedBackendUrl.replace(/\/api\/v1$/i, "");
export const API_BASE_URL = normalizedBackendUrl.endsWith("/api/v1")
	? normalizedBackendUrl
	: `${normalizedBackendUrl}/api/v1`;