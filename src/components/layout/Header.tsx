"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NavItem } from "@/lib/types";
import { useCart } from "@/components/cart/CartProvider";
import { Logo } from "@/components/ui/Logo";
import { SearchBox, type SearchEntry } from "./SearchBox";

const iconButton =
  "flex size-11 items-center justify-center rounded-full text-white transition hover:bg-white/15";

export function Header({ nav, searchEntries }: { nav: NavItem[]; searchEntries: SearchEntry[] }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);

  const closeMenu = () => menuRef.current?.close();

  useEffect(() => {
    // Close the mobile UI after a navigation.
    menuRef.current?.close();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on route change
    setSearchOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 bg-primary shadow-[0_2px_0_rgba(43,18,32,0.12)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-2 sm:px-4 lg:h-20 lg:gap-6 lg:px-6">
        {/* Mobile: menu button */}
        <button
          type="button"
          className={`${iconButton} lg:hidden`}
          aria-label="Ouvrir le menu"
          aria-haspopup="dialog"
          onClick={() => menuRef.current?.showModal()}
        >
          <Menu aria-hidden className="size-6" />
        </button>

        <Link href="/" aria-label="DOURYA, accueil" className="mx-auto shrink-0 rounded-sm lg:mx-0">
          <Logo priority className="w-28 sm:w-32 lg:w-40" />
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-2.5 py-2 font-display text-lg whitespace-nowrap font-semibold xl:px-3 xl:text-[1.2rem] text-white transition hover:bg-white/15 ${
                      active ? "bg-white/20" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto hidden w-52 lg:block xl:w-64">
          <SearchBox entries={searchEntries} />
        </div>

        <div className="flex items-center gap-1 lg:ml-0">
          <button
            type="button"
            className={`${iconButton} lg:hidden`}
            aria-label={searchOpen ? "Fermer la recherche" : "Rechercher"}
            aria-expanded={searchOpen}
            aria-controls="mobile-search"
            onClick={() => setSearchOpen((v) => !v)}
          >
            {searchOpen ? <X aria-hidden className="size-6" /> : <Search aria-hidden className="size-6" />}
          </button>
          <Link href="/compte" aria-label="Mon compte" className={`${iconButton} hidden sm:flex`}>
            <User aria-hidden className="size-6" />
          </Link>
          <CartLink />
        </div>
      </div>

      {searchOpen && (
        <div id="mobile-search" className="px-4 pb-3 lg:hidden">
          <SearchBox entries={searchEntries} autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      )}

      {/* Mobile menu: native modal dialog (focus trap + Escape for free) */}
      <dialog
        ref={menuRef}
        aria-label="Menu"
        className="m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none bg-primary p-0 text-white backdrop:bg-ink/50 open:flex open:flex-col"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeMenu();
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Logo className="w-28" />
          <button type="button" className={iconButton} aria-label="Fermer le menu" onClick={closeMenu}>
            <X aria-hidden className="size-6" />
          </button>
        </div>
        <nav aria-label="Navigation mobile" className="flex-1 overflow-y-auto px-2">
          <ul className="space-y-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeMenu}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="block rounded-md px-4 py-3 font-display text-2xl font-semibold hover:bg-white/15"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/30 p-2">
          <Link
            href="/compte"
            onClick={closeMenu}
            className="flex items-center gap-3 rounded-md px-4 py-3 text-xl font-bold hover:bg-white/15"
          >
            <User aria-hidden className="size-6" />
            Mon compte
          </Link>
        </div>
      </dialog>
    </header>
  );
}

function CartLink() {
  const { count } = useCart();
  return (
    <Link
      href="/panier"
      aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}
      className={`${iconButton} relative`}
    >
      <ShoppingBag aria-hidden className="size-6" />
      <span
        aria-hidden
        className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs leading-5 font-extrabold text-ink"
      >
        {count}
      </span>
    </Link>
  );
}
