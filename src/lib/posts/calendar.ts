import { useState } from "react";

/** The first and last moment of a month, as ISO strings (≤ 93 days, as the calendar routes require). */
export function monthRange(month: Date): { from: string; to: string } {
  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

function startOfThisMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** The month a calendar shows: `shift(±1)` moves it, `today()` comes back to the current month. */
export function useMonth() {
  const [month, setMonth] = useState(startOfThisMonth);
  const shift = (delta: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const today = () => setMonth(startOfThisMonth());
  return { month, shift, today, ...monthRange(month) };
}
