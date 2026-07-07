import axios from "axios";

/*
  Central API client.
  Every request goes through here.
  Automatically attaches JWT token.
*/
export const api = axios.create({
  // 🟢 Fixed: Changed from "/api/v1" to "/api" to align perfectly with your route files
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json"
  }
});

// Add authentication automatically.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    
    // 🟢 Safeguard: Ensure the headers object exists before assigning properties
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);