/**
 * Response shape of the profile endpoint. Only the fields the frontend reads
 * are typed; tighten once the backend contract is final.
 */
import type { UserType } from "./auth";

export type Profile = {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  user_type: UserType;
  role_id?: number;
  mobile?: string | null;
  job_title?: string | null;
  time_zone?: string | null;
  timezone?: string | null;
  avatar?: string | null;
  profile_image?: string | null;
  email_verified?: boolean;
  is_email_verified?: boolean;
  /** Every organization the user belongs to. */
  organizations?: { organization_id: string; name: string; type: "business" | "agency"; role: string }[];
  /** The organization requests act on (the `X-Organization-Id` header, else the default). */
  current_organization_id?: string | null;
};

export type GetProfileResponse = {
  success?: boolean;
  status?: number;
  message?: string;
  data: Profile;
};

/** Payload for `PATCH auth/me`: the backend stores only `name` and `mobile`. */
export type UpdateProfileRequest = {
  name: string;
  mobile: string | null;
};
