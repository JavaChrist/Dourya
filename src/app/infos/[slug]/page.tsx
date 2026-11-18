import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { infoPages } from "@/config/site";
import { InfoPlaceholder } from "@/components/ui/InfoPlaceholder";

export function generateStaticParams() {
  return infoPages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/infos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: infoPages.find((p) => p.slug === slug)?.title ?? "Informations" };
}

/** Contact, Mail Club and legal pages. Their real text must come from DOURYA. */
async function InfoContent({ params }: { params: PageProps<"/infos/[slug]">["params"] }) {
  const { slug } = await params;
  const page = infoPages.find((p) => p.slug === slug);
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
