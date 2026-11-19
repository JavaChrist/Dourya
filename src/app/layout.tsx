import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { buildNav, HEADER_CATEGORY_LIMIT, site, siteOrigin } from "@/config/site";
import { getVisibleCategories } from "@/lib/catalog";
import { sectionBackgrounds } from "@/data/home";
import { getSearchEntries } from "@/lib/catalog/search";
import { CartProvider } from "@/components/cart/CartProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { UpdateNotifier } from "@/components/layout/UpdateNotifier";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${site.name} : illustrations et créations originales`, template: `%s | ${site.name}` },
  description: site.description,
  // Turns the relative canonical URLs of each page into absolute https://dourya.fr URLs.
  // No canonical here: it would be inherited by every page that does not set its own.
  metadataBase: new URL(siteOrigin()),
  openGraph: { siteName: site.name, locale: "fr_FR", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#ff3c72",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Header, mobile menu and footer follow the visible rubriques (new admin rubriques included).
  const categories = await getVisibleCategories();
  return (
    <html lang="fr" className={`${nunito.variable} ${fredoka.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#contenu"
          className="sr-only z-50 rounded-full bg-accent px-4 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Aller au contenu
        </a>
        <CartProvider>
          <Header nav={buildNav(categories, HEADER_CATEGORY_LIMIT)} menuNav={buildNav(categories)} searchEntries={await getSearchEntries()} />
          <main id="contenu" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <Footer background={sectionBackgrounds.footer} nav={buildNav(categories)} />
        </CartProvider>
        <UpdateNotifier />
      </body>
    </html>
  );
}
