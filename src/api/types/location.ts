/** Country, state and city records used by the signup location selects. */
export type LocationOption = {
  _id: string;
  name: string;
};

export type Country = LocationOption;
export type State = LocationOption & { country_id?: string };
export type City = LocationOption & { state_id?: string };
