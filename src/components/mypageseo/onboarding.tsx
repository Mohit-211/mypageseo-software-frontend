import type { ReactNode } from "react";
import { AuthLayout } from "@/components/auth/auth";

/**
 * Focused setup frame: the sign-in layout (brand panel, card), not the app shell. The layout
 * already shows the MyPageSEO logo above the card on small screens, so the frame adds none.
 * The tab keeps one name through loading, errors and every step.
 */
export function OnboardingFrame({ children }: { children: ReactNode }) {
  return (
    <AuthLayout title="Set up MyPageSEO">
      <div className="w-full max-w-xl">{children}</div>
    </AuthLayout>
  );
}
