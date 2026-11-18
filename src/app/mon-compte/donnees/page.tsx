import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DeletionRequestForm, ExportLink } from "@/components/account/DataRequests";
import { Card, formatDate } from "@/components/account/ui";
import { listOwnDataRequests } from "@/lib/account/repository";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Mes données" };

const TYPE_LABEL = { export: "Export", deletion: "Suppression" } as const;

async function DataContent() {
  const user = await requireUser("/mon-compte/donnees");
  const requests = await listOwnDataRequests(user.uid);
  const deletionPending = requests.some((r) => r.type === "deletion" && r.status === "pending");
  return (
    <div className="space-y-6">
      <Card title="Exporter mes données">
        <p className="mb-4 text-ink">Téléchargez une copie des informations liées à votre compte : profil, préférences, adresses et commandes.</p>
        <ExportLink />
      </Card>
      <Card title="Supprimer mon compte">
        <p className="mb-4 text-ink">
          La demande est traitée manuellement. Certaines données de commande peuvent devoir être conservées pour des obligations légales. Voir la{" "}
          <Link href="/infos/confidentialite" className="font-bold text-link hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
        <DeletionRequestForm pending={deletionPending} />
      </Card>
      {requests.length > 0 && (
        <Card title="Mes demandes">
          <ul className="divide-y divide-secondary/30">
            {requests.map((r) => (
              <li key={r.id} className="flex justify-between gap-4 py-2 text-ink">
                <span>
                  {TYPE_LABEL[r.type]} · {formatDate(r.createdAt)}
                </span>
                <span className="font-semibold">{r.status === "done" ? "Traitée" : "En cours"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default function DataPage() {
  return (
    <Suspense fallback={<p role="status" className="text-ink-muted">Chargement…</p>}>
      <DataContent />
    </Suspense>
  );
}
