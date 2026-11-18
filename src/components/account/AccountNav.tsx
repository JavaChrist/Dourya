"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Package, ShieldCheck, UserRound } from "lucide-react";
import { Suspense } from "react";

const links = [
  { href: "/mon-compte", label: "Profil", icon: UserRound },
  { href: "/mon-compte/commandes", label: "Commandes", icon: Package },
  { href: "/mon-compte/adresses", label: "Adresses", icon: MapPin },
  { href: "/mon-compte/donnees", label: "Mes données", icon: ShieldCheck },
];

/** Suspense: on /mon-compte/commandes/[id] the pathname is only known at request time. */
export function AccountNav() {
  return (
    <Suspense fallback={<AccountNavView pathname={null} />}>
      <AccountNavWithPath />
    </Suspense>
  );
}

function AccountNavWithPath() {
  return <AccountNavView pathname={usePathname()} />;
}

function AccountNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Mon compte" className="mt-6 overflow-x-auto">
      <ul className="flex gap-2 pb-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/mon-compte" ? pathname === href : !!pathname?.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-semibold transition ${
                  active ? "border-ink bg-ink text-white" : "border-secondary/40 bg-white text-ink hover:border-ink"
                }`}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
