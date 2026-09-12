import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("[main] Booting NexusChecker client...");

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("[main] #root element not found in DOM. Rendering fallback message.");
  document.body.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#09090b;color:#f4f4f5;font-family:monospace;padding:24px;text-align:center;">' +
    "Failed to find #root element. Please reload the page.</div>";
} else {
  try {
    createRoot(rootElement).render(<App />);
    console.log("[main] React app rendered successfully");
  } catch (error) {
    console.error("[main] Failed to render React app:", error);
    rootElement.innerHTML =
      '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:#09090b;color:#f4f4f5;font-family:monospace;padding:24px;' +
      'text-align:center;"><h1>Failed to load app</h1><p style="opacity:0.7;">' +
      "Please reload the page or contact support if the problem persists.</p></div>";
  }
}

window.addEventListener("error", (event) => {
  console.error("[window.onerror]", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[window.onunhandledrejection]", event.reason);
});
