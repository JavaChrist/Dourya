import type { Metadata } from "next";
import { homeContent, sectionBackgrounds } from "@/data/home";
import { isDemoShown } from "@/lib/catalog/demo";
import { getVisibleCategories } from "@/lib/catalog";
import { PromoBanner } from "@/components/layout/PromoBanner";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { ManualCarousel } from "@/components/home/ManualCarousel";
import { MailClub } from "@/components/home/MailClub";
import { CategoryGrid } from "@/components/home/CategoryGrid";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Home page. Section order follows the Lot 1 brief (B to F; A and G are in the layout). */
export default async function HomePage() {
  const { promoBanner, heroCarousel, manualCarousel, mailClub } = homeContent(isDemoShown(process.env));
  return (
    <>
      <PromoBanner config={promoBanner} />
      <HeroCarousel config={heroCarousel} />
      <ManualCarousel config={manualCarousel} />
      <MailClub config={mailClub} />
      <CategoryGrid categories={await getVisibleCategories()} background={sectionBackgrounds.categories} />
    </>
  );
}
