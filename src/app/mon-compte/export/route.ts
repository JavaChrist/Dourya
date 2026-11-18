import { exportUserData } from "@/lib/account/repository";
import { getSessionUser } from "@/lib/auth/dal";
import { errorCode, logEvent } from "@/lib/log";
import { allowAction } from "@/lib/security/limit";

/** GDPR export: JSON file of the signed-in user's own data only. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  if (!(await allowAction("account:export", user.uid))) return new Response("Trop de demandes. Réessayez plus tard.", { status: 429 });
  try {
    const data = await exportUserData(user.uid, user.email);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dourya-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logEvent("export_error", { code: errorCode(error) });
    return new Response("Export indisponible. Réessayez plus tard.", { status: 503 });
  }
}
