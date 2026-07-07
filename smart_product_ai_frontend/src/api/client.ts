import axios from "axios";

/*
 Central HTTP client.
 All frontend requests go through here.
*/
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json"
  }
});

/*
 Attach access token automatically.
 Every protected request gets: Authorization: Bearer TOKEN
*/
api.interceptors.request.use(
  (config) => {
    // 🟢 Aligned: Matching "access_token" across your unified browser cache namespaces
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");

    if (token) {
      config.headers = config.headers || {};
      // 🟢 Type Guard: Handles indexing safely for dynamic Axios versions
      config.headers.set 
        ? config.headers.set("Authorization", `Bearer ${token}`)
        : (config.headers["Authorization"] = `Bearer ${token}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/*
 Global response handler.
 Handles expired tokens and auth failures gracefully.
*/
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Check if the server rejected the request with a 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      sessionStorage.removeItem("access_token");

      // Force session evacuation redirect sequence to authorization login routes
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);