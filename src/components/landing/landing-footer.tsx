import { Link } from "react-router-dom";
import { LineChart } from "lucide-react";
import logoAsset from "@/assets/logo.png";

type FooterLink = { label: string; href: string; internal?: boolean };
type FooterGroup = { title: string; links: FooterLink[] };

const defaultGroups: FooterGroup[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#product" },
      { label: "Capabilities", href: "#capabilities" },
      { label: "Who it\u2019s for", href: "#who" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login", internal: true },
      { label: "Get started", href: "/signup", internal: true },
    ],
  },
];

interface LandingFooterProps {
  /** Link columns shown on the right. Defaults to the landing page's Product/Account groups. */
  groups?: FooterGroup[];
  tagline?: string;
  copyright?: string;
  motto?: string;
}

export function LandingFooter({
  groups = defaultGroups,
  tagline = "Local SEO management for businesses and agencies.",
  copyright = "© 2026 Mypageseo",
  motto = "Local search, measured.",
}: LandingFooterProps) {
  return (
    <footer className="bg-sidebar">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <span className="inline-flex h-11 items-center justify-center rounded-md bg-white px-2.5">
            <img src={logoAsset} alt="MyPageSEO" className="h-9 w-auto object-contain" />
          </span>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-sidebar-foreground/70">
            {tagline}
          </p>
        </div>
        <nav className="flex gap-12 text-sm" aria-label="Footer">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {group.title}
              </p>
              <ul className="mt-3 space-y-2 text-sidebar-foreground/80">
                {group.links.map((link) => (
                  <li key={link.href}>
                    {link.internal ? (
                      <Link to={link.href} className="hover:text-sidebar-accent-foreground">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="hover:text-sidebar-accent-foreground">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-sidebar-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-sidebar-foreground/60 sm:px-6">
          <span className="flex items-center gap-3">
            {copyright}
            <span aria-hidden className="text-sidebar-foreground/30">·</span>
            <Link to="/staff/login" className="hover:text-sidebar-accent-foreground">
              Emp Login
            </Link>
          </span>
          <span className="flex items-center gap-1.5">
            <LineChart className="size-3.5" aria-hidden /> {motto}
          </span>
        </div>
      </div>
    </footer>
  );
}
