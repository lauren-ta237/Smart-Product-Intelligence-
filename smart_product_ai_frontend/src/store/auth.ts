import { create } from "zustand";

export interface UserProfile {
  id?: string;
  email?: string;
  role?: "BUYER" | "VENDOR" | "ADMIN";
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  login: (token: string, user?: UserProfile) => void;
  logout: () => void;
}

// Safely parse JWT payload
function parseJwt(token: string): UserProfile | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload);
    
    return {
      id: parsed.sub || parsed.id,
      email: parsed.email,
      role: parsed.role ? parsed.role.toUpperCase() : undefined,
    };
  } catch (e) {
    return null;
  }
}

// Initial state getters from LocalStorage
const initialToken = localStorage.getItem("access_token");
const initialUserRaw = localStorage.getItem("user_profile");
const initialUser: UserProfile | null = initialUserRaw
  ? JSON.parse(initialUserRaw)
  : initialToken
  ? parseJwt(initialToken)
  : null;

export const useAuth = create<AuthState>((set) => ({
  token: initialToken,
  user: initialUser,

  login: (token, user) => {
    localStorage.setItem("access_token", token);
    
    // Resolve user from argument or JWT payload
    const resolvedUser = user || parseJwt(token);

    if (resolvedUser) {
      localStorage.setItem("user_profile", JSON.stringify(resolvedUser));
    }

    set({ token, user: resolvedUser });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_profile");
    set({ token: null, user: null });
  },
}));