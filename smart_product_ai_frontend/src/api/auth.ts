// smart_product_ai_frontend/src/api/auth.ts
import axios from "axios";
import { API_BASE_URL } from "./config";

/*
  Central API client for Auth specific tasks.
  Standardized to /api/v1 to avoid routing duplication.
*/
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || API_BASE_URL,
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