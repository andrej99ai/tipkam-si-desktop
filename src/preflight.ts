// ─── Fail-fast microphone pre-flight ─────────────────────────────────────────
//
// Cilj: uporabnika opozoriti TAKOJ — preden govori — če mikrofon ni dostopen.
// V WebView2 (Edge/Chromium) medijski API-ji tiho odpovedo po asinhronih korakih,
// zato vse preverimo PRED snemanjem in napake jasno klasificiramo.

/** Vrsta težave z mikrofonom (preslika se v lokalizirano sporočilo v i18n) */
export type MicIssue =
  | "blocked"     // dovoljenje zavrnjeno (uporabnik ali Windows Privacy)
  | "no-device"   // ni nobenega vhodnega avdio vira
  | "busy"        // mikrofon zaseden z drugim programom
  | "constraint"  // zahtevane lastnosti niso podprte
  | "insecure"    // nevaren kontekst (HTTP / file://)
  | "aborted"     // sistemska prekinitev
  | "unknown";    // nedoločena napaka

/** Ustrezni i18n ključ za vsako vrsto težave */
export const MIC_ISSUE_I18N: Record<MicIssue, string> = {
  blocked: "micBlocked",
  "no-device": "micNotFound",
  busy: "micBusy",
  constraint: "micConstraint",
  insecure: "micInsecure",
  aborted: "micAborted",
  unknown: "micGeneric",
};

/**
 * Preslika DOMException (ali poljubno napako) iz getUserMedia v MicIssue.
 * Imena napak so standardna v vseh Chromium-based WebView pogonih.
 */
export function mapMicError(err: any): MicIssue {
  const name = String(err?.name ?? "");
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "blocked";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "no-device";
    case "NotReadableError":
    case "TrackStartError":
      return "busy";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "constraint";
    case "SecurityError":
      return "insecure";
    case "AbortError":
      return "aborted";
    default: {
      // Nekateri WebView2 buildi vrnejo le sporočilo brez .name — poskusi ujeti
      const msg = String(err?.message ?? "").toLowerCase();
      if (msg.includes("denied") || msg.includes("not allowed") || msg.includes("permission"))
        return "blocked";
      if (msg.includes("not found") || msg.includes("no device") || msg.includes("notfound"))
        return "no-device";
      if (msg.includes("in use") || msg.includes("busy") || msg.includes("could not start"))
        return "busy";
      return "unknown";
    }
  }
}

/**
 * Lahki pred-snemalni check, ki NE porabi getUserMedia klica
 * (da se izognemo dvojnemu zajemu in težavam z "user gesture" oknom v WebView2).
 *
 * Preveri:
 *  1. permissions.query → "denied" pomeni blokiran mikrofon
 *  2. enumerateDevices → ali sploh obstaja vhodni avdio vir
 *
 * Vrne MicIssue, če je težava zaznana, sicer `null` (vse v redu — nadaljuj z zajemom).
 * Dejanske "busy"/"constraint" napake se ujamejo šele ob pravem getUserMedia,
 * a to se zgodi PRED rdečim indikatorjem, torej še vedno preden uporabnik govori.
 */
export async function preflightCheck(): Promise<MicIssue | null> {
  // 1. Dovoljenje (v starejših WebView2 buildih lahko vrže → fallback)
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    if (status.state === "denied") return "blocked";
  } catch (_) {
    // permissions.query ni podprt — preskočimo, getUserMedia bo ujel napako.
  }

  // 2. Prisotnost naprave
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasMic = devices.some((d) => d.kind === "audioinput");
    if (!hasMic) return "no-device";
  } catch (_) {
    // enumerateDevices ni uspel — ne blokiramo, pustimo getUserMedia odločiti.
  }

  return null;
}
