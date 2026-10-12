import { api, unwrapData } from "../client";

/** `GET organization/branding`. A business organization gets `white_label: false` and MyPageSEO's defaults. */
export type Branding = {
  white_label: boolean;
  name: string | null;
  agency_name?: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  footer_text: string | null;
  contact_text: string | null;
  hide_mypageseo: boolean;
  email_sender_name: string | null;
  email_reply_to: string | null;
  logo: { mime: string; bytes: number; url: string } | null;
  updated_at?: string | null;
};

export type BrandingInput = Partial<
  Pick<Branding, "name" | "primary_color" | "secondary_color" | "footer_text" | "contact_text" | "hide_mypageseo" | "email_sender_name" | "email_reply_to">
>;

export async function getBranding(signal?: AbortSignal): Promise<Branding> {
  return unwrapData(await api.get("organization/branding", signal ? { signal } : {}));
}

/** Owner of an agency; colours `#rrggbb`; `""` clears a text field. 403 `agency_only` / `owner_only`. */
export async function updateBranding(input: BrandingInput): Promise<Branding> {
  return unwrapData(await api.put("organization/branding", input));
}

/** The logo is private (not a public URL), so it's fetched with the session. */
export async function getBrandingLogo(signal?: AbortSignal): Promise<Blob> {
  const response = await api.get<Response>("organization/branding/logo", { responseType: "blob", ...(signal ? { signal } : {}) });
  return response.blob();
}

/** PNG or JPEG ≤ 512 KB as a data URL. 400 `logo_type`, `logo_too_large`. */
export async function uploadBrandingLogo(dataUrl: string): Promise<Branding> {
  return unwrapData(await api.put("organization/branding/logo", { data: dataUrl }));
}

export async function deleteBrandingLogo(): Promise<unknown> {
  return unwrapData(await api.delete("organization/branding/logo"));
}
export * from "./team";
