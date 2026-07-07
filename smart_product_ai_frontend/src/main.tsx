import React from "react";
import ReactDOM from "react-dom/client";
import Router from "./app/router";
import Providers from "./app/providers";
import "./index.css";

ReactDOM
.createRoot(
document.getElementById("root")!
)
.render(
<React.StrictMode>
<Providers>
<Router/>
</Providers>
</React.StrictMode>
);