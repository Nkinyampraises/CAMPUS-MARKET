
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  // Registers the service worker (production browsers only; skipped in Capacitor).
  import "./pwa";

  createRoot(document.getElementById("root")!).render(<App />);
  