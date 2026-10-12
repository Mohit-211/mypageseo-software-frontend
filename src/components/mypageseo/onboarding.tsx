import type { ReactNode } from "react";
import { AuthLayout, AuthWordmark } from "@/components/auth/auth";

/** Focused setup frame — the authentication shell, not the app shell. */
export function OnboardingFrame({ children }: { children: ReactNode }) {
  return (
    <AuthLayout>
      <div className="w-full max-w-xl">
        <div className="lg:hidden">
          <AuthWordmark className="mb-6" />
        </div>
        {children}
      </div>
    </AuthLayout>
  );
}
