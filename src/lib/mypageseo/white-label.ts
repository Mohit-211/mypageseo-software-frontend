/**
 * Agency white-label reporting configuration.
 *
 * The report system consumes exactly two branding fields today
 * (`ReportBranding`: companyName and logoUrl). Persisting a configuration,
 * rendering a branded preview and resetting to default branding are handled
 * client-side today; a demo configuration is shown until the settings
 * backend is connected. Logo upload genuinely requires file storage that is
 * not connected to this frontend, so it stays disabled.
 */

import { withDemoFallback } from "./demo/demo-mode";
import { DEMO_WHITE_LABEL_BRANDING } from "./demo/white-label";
import type { ReportBranding } from "../reports/reports";

export type WhiteLabelCapabilities = {
  /** Persist the configuration through the settings backend. */
  canSave: boolean;
  /** Upload a logo asset through the application's file storage. */
  canUploadLogo: boolean;
  /** Render a branded preview of a real report. */
  canPreview: boolean;
  /** Clear the configuration back to standard Mypageseo branding. */
  canReset: boolean;
};

export type WhiteLabelResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  /** No settings backend is connected, so no configuration can be read or written. */
  | { status: "unavailable"; reason: string; capabilities: WhiteLabelCapabilities }
  | { status: "ready"; branding: ReportBranding; capabilities: WhiteLabelCapabilities };

const NO_CAPABILITIES: WhiteLabelCapabilities = {
  canSave: false,
  canUploadLogo: false,
  canPreview: false,
  canReset: false,
};

/** Logo storage is not connected, so upload stays disabled even in the demo. */
const DEMO_CAPABILITIES: WhiteLabelCapabilities = {
  canSave: true,
  canUploadLogo: false,
  canPreview: true,
  canReset: true,
};

export function getWhiteLabelCapabilities(real?: WhiteLabelCapabilities | null): WhiteLabelCapabilities {
  return withDemoFallback(real, () => DEMO_CAPABILITIES);
}

export function getWhiteLabelSettings(real?: WhiteLabelResult | null): WhiteLabelResult {
  return withDemoFallback(real, () => ({
    status: "ready",
    branding: DEMO_WHITE_LABEL_BRANDING,
    capabilities: DEMO_CAPABILITIES,
  }));
}

export const COMPANY_NAME_MAX_LENGTH = 80;
