import { heroCarousel, mailClub, manualCarousel, promoBanner, sectionBackgrounds } from "@/data/home";
import { getVisibleCategories } from "@/lib/catalog";
import { PromoBanner } from "@/components/layout/PromoBanner";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { ManualCarousel } from "@/components/home/ManualCarousel";
import { MailClub } from "@/components/home/MailClub";
import { CategoryGrid } from "@/components/home/CategoryGrid";

/** Home page. Section order follows the Lot 1 brief (B to F; A and G are in the layout). */
export default async function HomePage() {
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
