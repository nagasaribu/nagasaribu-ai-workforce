export type ResponseMode = "human" | "simple" | "deep_thinking";

export const RESPONSE_MODES: ResponseMode[] = ["human", "simple", "deep_thinking"];

export const DEFAULT_RESPONSE_MODE: ResponseMode = "human";

export const MODE_LABELS: Record<ResponseMode, string> = {
  human: "Human",
  simple: "Simple",
  deep_thinking: "Deep Thinking",
};

export const MODE_ICONS: Record<ResponseMode, string> = {
  human: "💬",
  simple: "⚡",
  deep_thinking: "🧠",
};

export const MODE_DESCRIPTIONS: Record<ResponseMode, string> = {
  human: "Jawapan semula jadi, mesra dan ringkas dalam Bahasa Melayu.",
  simple: "Bahasa mudah dengan maksimum 3–5 poin utama.",
  deep_thinking: "Analisis strategik terperinci dengan bukti, andaian, risiko dan cadangan.",
};

export function isResponseMode(value: unknown): value is ResponseMode {
  return typeof value === "string" && (RESPONSE_MODES as string[]).includes(value);
}

export function normalizeResponseMode(value: unknown): ResponseMode {
  return isResponseMode(value) ? value : DEFAULT_RESPONSE_MODE;
}

export function modeInstruction(mode: ResponseMode): string {
  switch (mode) {
    case "simple":
      return [
        "Mod jawapan: SIMPLE.",
        "Gunakan Bahasa Melayu yang sangat mudah dan ayat pendek.",
        "Berikan maksimum 3–5 poin utama sahaja.",
        "Elakkan jargon, jadual besar, angka rumit dan penerangan panjang.",
        "Jangan gunakan sintaks Markdown seperti **, ## atau jadual Markdown.",
      ].join(" ");
    case "deep_thinking":
      return [
        "Mod jawapan: DEEP_THINKING.",
        "Berikan analisis strategik yang tersusun dalam Bahasa Melayu.",
        "Sertakan ringkasan eksekutif, fakta/bukti, andaian, pilihan pendekatan, pengiraan penting, risiko, cadangan dan langkah seterusnya.",
        "Berikan ringkasan penaakulan yang berguna, bukan rantaian pemikiran peribadi tersembunyi.",
        "Jangan gunakan sintaks Markdown seperti **, ## atau jadual Markdown; gunakan tajuk ringkas dan poin.",
      ].join(" ");
    default:
      return [
        "Mod jawapan: HUMAN.",
        "Jawab dalam Bahasa Melayu semula jadi, mesra dan profesional.",
        "Mulakan dengan ringkasan satu ayat, kemudian 3–5 penemuan atau tindakan utama.",
        "Elakkan jargon, jadual besar dan penerangan panjang.",
        "Jangan gunakan sintaks Markdown seperti **, ## atau jadual Markdown.",
        "Akhiri dengan satu langkah seterusnya yang konkrit.",
      ].join(" ");
  }
}
