import Link from "next/link";
import { Link2, Mail } from "lucide-react";
import { copyrightHolder, footerLegal, site, socialLinks } from "@/config/site";
import type { NavItem, SectionBackground } from "@/lib/types";
import { Logo } from "@/components/ui/Logo";
import { backgroundProps } from "@/components/ui/Section";

const linkClass = "rounded-sm text-ink hover:text-pink-strong hover:underline underline-offset-4";

/**
 * Footer. Contact, social and legal content are never invented: when a value
 * is missing in src/config/site.ts, a neutral "à compléter" note is shown.
 */
export function Footer({ background, nav }: { background: SectionBackground; nav: NavItem[] }) {
  const bg = backgroundProps(background);
  const year = 2026;
  return (
    <footer className="mt-auto">
      <div className={`${bg.className} py-10`} style={bg.style}>
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 text-center sm:px-6">
          <Link href="/" aria-label="DOURYA, accueil" className="rounded-sm">
            <Logo variant="full" className="w-64 sm:w-80" />
          </Link>
        </div>
      </div>

      <div className="bg-surface-muted">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <FooterColumn title="Boutique">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Contact">
            <li>
              <Link href="/infos/contact" className={linkClass}>
                Nous contacter
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <Mail aria-hidden className="size-4 shrink-0 text-pink-strong" />
              {site.contactEmail ? (
                <a href={`mailto:${site.contactEmail}`} className={linkClass}>
                  {site.contactEmail}
                </a>
              ) : (
                <span className="text-ink-muted italic">Adresse e-mail à compléter</span>
              )}
            </li>
          </FooterColumn>

          <FooterColumn title="Réseaux sociaux">
            {socialLinks.length > 0 ? (
              socialLinks.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className={`${linkClass} inline-flex items-center gap-2`}>
                    <Link2 aria-hidden className="size-4 text-pink-strong" />
                    {s.label}
                  </a>
                </li>
              ))
            ) : (
              <li className="text-ink-muted italic">Liens à compléter</li>
            )}
          </FooterColumn>

          <FooterColumn title="Informations">
            {footerLegal.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </FooterColumn>
        </div>
        <p className="border-t border-secondary/40 px-4 py-4 text-center text-sm text-ink-muted">
          © {year} {copyrightHolder}. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-pink-strong">{title}</h2>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  );
}
