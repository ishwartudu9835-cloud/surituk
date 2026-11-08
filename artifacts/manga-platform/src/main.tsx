import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// When the site is hosted separately from the API (e.g. Cloudflare Pages),
// set VITE_API_URL at build time, e.g. https://surituk-api.onrender.com
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) setBaseUrl(apiUrl);

// If a photo can't be loaded (deleted file, bad link), show a neat letter placeholder instead of a broken icon.
function placeholder(label: string) {
  if (!label.trim()) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1c1816"/></svg>')}`;
  const letter = (label.trim()[0] ?? "S").toUpperCase().replace(/[<>&"']/g, "S");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2a2420"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Georgia,serif" font-size="30" fill="#E1191F">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
window.addEventListener("error", e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || img.dataset.fallback) return;
  img.dataset.fallback = "1";
  img.src = placeholder(img.alt);
}, true);

createRoot(document.getElementById("root")!).render(<App />);
