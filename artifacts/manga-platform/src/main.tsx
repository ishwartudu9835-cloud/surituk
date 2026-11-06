import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// When the site is hosted separately from the API (e.g. Cloudflare Pages),
// set VITE_API_URL at build time, e.g. https://surituk-api.onrender.com
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) setBaseUrl(apiUrl);

createRoot(document.getElementById("root")!).render(<App />);
