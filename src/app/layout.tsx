import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { site, mainNav } from "@/config/site";
import { sectionBackgrounds } from "@/data/home";
import { getProducts, getVisibleCategories } from "@/lib/catalog";
import { CartProvider } from "@/components/cart/CartProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { UpdateNotifier } from "@/components/layout/UpdateNotifier";
import type { SearchEntry } from "@/components/layout/SearchBox";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${site.name} : illustrations et créations originales`, template: `%s | ${site.name}` },
  description: site.description,
};

export const viewport: Viewport = {
  themeColor: "#ff3c72",
};

function buildSearchEntries(): SearchEntry[] {
  const cats = getVisibleCategories();
  const catName = new Map(cats.map((c) => [c.slug, c.name]));
  return [
    ...cats.map((c) => ({ label: c.name, href: `/categorie/${c.slug}`, hint: "Catégorie" })),
    ...getProducts().map((p) => ({
      label: p.name,
      href: `/produit/${p.slug}`,
      hint: catName.get(p.categorySlug) ?? "",
    })),
  ];
}

export default function RootLayout({ children }: LayoutProps<"/">) {
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
          <Header nav={mainNav} searchEntries={buildSearchEntries()} />
          <main id="contenu" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <Footer background={sectionBackgrounds.footer} />
        </CartProvider>
        <UpdateNotifier />
      </body>
    </html>
  );
}
