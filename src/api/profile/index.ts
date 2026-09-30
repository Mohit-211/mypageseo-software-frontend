import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { GetProfileResponse, Profile, UpdateProfileRequest } from "../types/profile";

/** Returns the signed-in user's profile. Rejects with a 401 `ApiError` when signed out. */
export async function getProfile(signal?: AbortSignal): Promise<Profile> {
  const response = await api.get<GetProfileResponse>(ENDPOINTS.profile.get, signal ? { signal } : {});
  return response.data;
}

/** Updates the signed-in user's profile with `PATCH auth/me` and returns the saved profile. */
export async function updateProfile(body: UpdateProfileRequest): Promise<Profile | undefined> {
  const response = await api.patch<Partial<GetProfileResponse> | undefined>(ENDPOINTS.profile.update, body);
  return response?.data;
}
