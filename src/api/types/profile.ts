/**
 * Response shape of the profile endpoint. Only the fields the frontend reads
 * are typed; tighten once the backend contract is final.
 */
import type { UserType } from "./auth";

export type Profile = {
  id?: string;
  name?: string;
  email?: string;
  user_type: UserType;
  role_id?: number;
};

export type GetProfileResponse = {
  success?: boolean;
  status?: number;
  message?: string;
  data: Profile;
};
