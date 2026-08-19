import React from "react";
import ReactDOM from "react-dom/client";
import Router from "./app/router";
import Providers from "./app/providers";
import "./index.css";

// Fix for stale or legacy route redirects:
if (window.location.pathname === "/dashboard") {
  window.history.replaceState(null, "", "/");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <Router />
    </Providers>
  </React.StrictMode>
);