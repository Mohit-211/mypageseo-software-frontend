import { ApiError, api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { GetProfileResponse, Profile } from "../types/profile";

/** Returns the signed-in user's profile. Rejects with a 401 `ApiError` when signed out. */
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWJhMDkxNzZkZGY1MjJlYTAwNmYyOGIiLCJpYXQiOjE3OTA1Nzc5NzUsImV4cCI6MTc5MDY2NDM3NSwidHlwZSI6IkFDQ0VTUyIsInJvbGVfaWQiOjksInVzZXJfdHlwZSI6IkFHRU5DWSJ9.piVM-5YcZpYz1V9dzNTJ-pxxiIY4XiaptzNaQaNZHFo";
export async function getProfile(signal?: AbortSignal): Promise<Profile> {
  console.log(signal, "signal")
  console.log(token,"token")
  const response = await api.get<GetProfileResponse>(
    ENDPOINTS.profile.get,
    {
      ...(signal ? { signal } : {}),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
  console.log(response,"response")
  return response.data;
}
