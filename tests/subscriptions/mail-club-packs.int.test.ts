import { beforeEach, describe, expect, it } from "vitest";
import { adminDb } from "@/lib/firebase/admin-db";
import { splitPublished } from "@/lib/subscriptions/packs";
import { createPack, editPackPhoto, getPack, listPacks, savePackText, setPackStatus } from "@/lib/subscriptions/packs-repository";

// Fictitious data only, on the Firestore emulator. Photo upload/delete (Storage) is not exercised here.
const host = () => process.env.FIRESTORE_EMULATOR_HOST;
beforeEach(async () => {
  await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });
});

const NOW = new Date("2026-11-20T10:00:00Z");
const photo = (id: string, alt = "Le contenu du pack") => ({ src: `/admin/mail-club/photos/${id}/abcdef123456.webp`, alt, width: 800, height: 600 });
const withPhoto = (id: string, alt?: string) => adminDb().collection("mailClubPacks").doc(id).update({ images: [photo(id, alt)] });

describe("Mail Club monthly packs", () => {
  it("creates one draft per month and refuses a second one", async () => {
    await createPack("2026-12", "Pack de Noël", "admin_a", NOW);
    await expect(createPack("2026-12", "Autre", "admin_a", NOW)).rejects.toThrow("déjà une fiche");
    const pack = await getPack("2026-12");
    expect(pack).toMatchObject({ title: "Pack de Noël", status: "draft", images: [] });
  });

  it("refuses to publish an incomplete pack, then publishes it once complete", async () => {
    await createPack("2026-12", "Pack de Noël", "admin_a", NOW);
    await expect(setPackStatus("2026-12", "published", "admin_a", NOW)).rejects.toThrow("Il manque");
    await savePackText("2026-12", { title: "Pack de Noël", description: "Stickers et marque-pages" }, "admin_a");
    await withPhoto("2026-12");
    await setPackStatus("2026-12", "published", "admin_a", NOW);
    expect((await getPack("2026-12"))?.status).toBe("published");
  });

  it("shows the newest published month as current and keeps older ones as previous", async () => {
    for (const id of ["2026-11", "2026-12"]) {
      await createPack(id, `Pack ${id}`, "admin_a", NOW);
      await savePackText(id, { title: `Pack ${id}`, description: "Texte" }, "admin_a");
      await withPhoto(id);
      await setPackStatus(id, "published", "admin_a", NOW);
    }
    await createPack("2027-01", "Brouillon", "admin_a", NOW);
    const { current, previous } = splitPublished(await listPacks());
    expect(current?.id).toBe("2026-12");
    expect(previous.map((p) => p.id)).toEqual(["2026-11"]);
  });

  it("sends a published pack back to draft when it loses its text or a photo description", async () => {
    await createPack("2026-12", "Pack", "admin_a", NOW);
    await savePackText("2026-12", { title: "Pack", description: "Texte" }, "admin_a");
    await withPhoto("2026-12");
    await setPackStatus("2026-12", "published", "admin_a", NOW);

    expect(await savePackText("2026-12", { title: "Pack", description: "" }, "admin_a")).toBe(true);
    expect((await getPack("2026-12"))?.status).toBe("draft");

    await savePackText("2026-12", { title: "Pack", description: "Texte" }, "admin_a");
    await setPackStatus("2026-12", "published", "admin_a", NOW);
    expect(await editPackPhoto("2026-12", photo("2026-12").src, { op: "alt", alt: "" }, "admin_a")).toBe(true);
    expect((await getPack("2026-12"))?.status).toBe("draft");
  });
});
