import type { Metadata } from "next";
import { homeContent, sectionBackgrounds } from "@/data/home";
import { isDemoShown } from "@/lib/catalog/demo";
import { getShownProducts, getVisibleCategories } from "@/lib/catalog";
import { toSlides } from "@/lib/home/carousels";
import { homeCarouselsForShop } from "@/lib/home/repository";
import { PromoBanner } from "@/components/layout/PromoBanner";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { ManualCarousel } from "@/components/home/ManualCarousel";
import { MailClub } from "@/components/home/MailClub";
import { CategoryGrid } from "@/components/home/CategoryGrid";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Home page. Section order follows the Lot 1 brief (B to F; A and G are in the layout). */
export default async function HomePage() {
  const [categories, products, stored] = await Promise.all([getVisibleCategories(), getShownProducts(), homeCarouselsForShop()]);
  const live = {
    categories: new Set(categories.map((c) => c.slug)),
    products: new Set(products.map((p) => p.slug)),
    photos: new Set(products.flatMap((p) => p.images.map((i) => i.src))),
  };
  // Slides composed in Admin → Accueil, else those of src/data/home.ts.
  const slides = stored && { hero: toSlides(stored.hero), selection: toSlides(stored.selection) };
  const { promoBanner, heroCarousel, manualCarousel, mailClub } = homeContent(isDemoShown(process.env), live, slides);
  return (
    <>
      <PromoBanner config={promoBanner} />
      <HeroCarousel config={heroCarousel} />
      <ManualCarousel config={manualCarousel} />
      <MailClub config={mailClub} />
      <CategoryGrid categories={categories} background={sectionBackgrounds.categories} />
    </>
  );
}
