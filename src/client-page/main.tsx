import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "./App";
// Fonts are bundled, so a client's page makes no third-party requests.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "./client.css";

// The white-label client page (Phase 23): its own small app, no router, no sign-in.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={150}>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
