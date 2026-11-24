import { render } from "preact";
import { App } from "./app";
import { inTauri } from "./storage";
import "./styles.css";

const root = document.getElementById("app");
if (root) render(<App />, root);

// Web version only: work offline once loaded, and ask the browser to keep the characters
// stored on this device (without this, Safari may clear them after weeks without a visit).
if (!inTauri() && import.meta.env.PROD) {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => undefined);
  navigator.storage?.persist?.().catch(() => undefined);
}
