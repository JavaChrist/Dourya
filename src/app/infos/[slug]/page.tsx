import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { infoPages } from "@/config/site";
import { InfoPlaceholder } from "@/components/ui/InfoPlaceholder";

/** Pages with their own route: src/app/infos/mail-club and src/app/infos/cgv. */
const OWN_ROUTE = new Set(["mail-club", "cgv"]);
const placeholderPages = infoPages.filter((p) => !OWN_ROUTE.has(p.slug));

export function generateStaticParams() {
  return placeholderPages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/infos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = placeholderPages.find((p) => p.slug === slug);
  if (!page) return { title: "Informations" };
  return { title: page.title, alternates: { canonical: `/infos/${page.slug}` } };
}

/** Contact and legal pages. Their real text must come from DOURYA. */
async function InfoContent({ params }: { params: PageProps<"/infos/[slug]">["params"] }) {
  const { slug } = await params;
  const page = placeholderPages.find((p) => p.slug === slug);
  if (!page) notFound();
  return (
    <InfoPlaceholder title={page.title}>
      <p>Contenu à venir. Le texte officiel sera fourni par DOURYA et ajouté dans un prochain lot.</p>
    </InfoPlaceholder>
  );
}

/** params are read inside Suspense so the shared App Shell stays URL-independent (Next 16 partial prefetching). */
export default function InfoPage({ params }: PageProps<"/infos/[slug]">) {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-[60vh]" />}>
      <InfoContent params={params} />
    </Suspense>
  );
}
