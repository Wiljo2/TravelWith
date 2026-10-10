import { IDEA_TYPES } from "@/constants/ideaTypes";
import { INSIGHT_KINDS, INSIGHT_PHASES } from "@/constants/insightKinds";
import { transcriptExcerpt } from "@/utils/excerpt";
import { vocab } from "@/utils/ideas";

// What Gemini is asked about a short video (a reel or TikTok of up to 90 s):
// the places it recommends (spots) and every other concrete piece of advice
// (insights), with the second where each one appears.

export const MAX_SPOTS = 12;
export const MAX_INSIGHTS = 8;
export const SUMMARY_MAX = 600;
export const ON_SCREEN_MAX = 600;
export const INSIGHT_MAX = 160;
export const WHEN_MAX = 80;
const CAPTION_MAX = 600;
const TRANSCRIPT_MAX = 600;

export const CATS = Object.keys(IDEA_TYPES);
export const KINDS = Object.keys(INSIGHT_KINDS);
export const PHASES = Object.keys(INSIGHT_PHASES);

// What the app already knows about the post, to read the video better.
export interface PromptContext {
  places: string[];
  caption?: string;
  transcript?: string;
}

// Gemini responseSchema (OpenAPI subset).
export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    relevant: { type: "boolean" },
    summary: { type: "string" },
    onScreen: { type: "string" },
    spots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          city: { type: "string" },
          cat: { type: "string", enum: CATS },
          at: { type: "number" },
          price: { type: "string" },
          tip: { type: "string" },
        },
        required: ["name", "cat"],
      },
    },
    insights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: KINDS },
          text: { type: "string" },
          phase: { type: "string", enum: PHASES },
          when: { type: "string" },
          start: { type: "number" },
          end: { type: "number" },
          place: { type: "string" },
          brand: { type: "string" },
          at: { type: "number" },
        },
        required: ["kind", "text"],
      },
    },
  },
  required: ["relevant", "summary", "spots", "insights"],
};

const clip = (text: string, max: number) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

export function analysisPrompt({ places, caption, transcript }: PromptContext): string {
  const list = places.length ? places.join(", ") : "(sin lugares definidos)";
  const post = [
    caption?.trim() && `- Texto del post: ${clip(caption, CAPTION_MAX)}`,
    transcript?.trim() && `- Subtítulos automáticos: ${transcriptExcerpt(transcript, new Set(vocab(places.join(" "))), TRANSCRIPT_MAX)}`,
  ].filter(Boolean);
  return `Mira este video corto que un grupo guardó para su viaje (imagen, audio y TODO el texto que aparece en pantalla). Responde en español.
Lugares del viaje: ${list}.
${post.length ? `Lo que ya sabemos del post (úsalo para entender el video; puede listar lo que muestra):\n${post.join("\n")}\n` : ""}
- relevant: true si da ideas útiles para viajar (lugares, comida, actividades, compras, consejos); false si trata de otra cosa o es solo humor sin datos.
- summary: qué muestra y recomienda, máximo ${SUMMARY_MAX} caracteres.
- onScreen: el texto importante que aparece en pantalla (nombres, precios, horarios, direcciones), máximo ${ON_SCREEN_MAX} caracteres.
- spots: cada lugar, negocio o experiencia concreta que recomienda (máximo ${MAX_SPOTS}), en el orden en que aparecen:
  name (nombre propio), city, cat (${CATS.join(", ")}), at (segundo del video donde aparece), price y tip si se dicen o se ven.
  Si el lugar queda en uno de los lugares del viaje, usa ese nombre exacto en city.
- insights: cada consejo concreto que NO es un lugar (máximo ${MAX_INSIGHTS}), en el orden en que aparecen:
  kind: "todo" = algo que hay que hacer, reservar, comprar, llevar o descargar; "tip" = cómo o cuándo hacer algo mejor; "avoid" = qué no hacer o qué error evitar; "fact" = un dato útil (precio, horario, regla, lo que está incluido).
  text: una frase corta y accionable, máximo ${INSIGHT_MAX} caracteres (ej. "Reserva los shows en la app antes de embarcar; se llenan").
  phase: "before" (antes del viaje), "first" (primer día o llegada; en un crucero, el embarque), "during", "last" (último día o salida; en un crucero, el desembarque) o "anytime".
  when: el momento como lo dice el video, máximo ${WHEN_MAX} caracteres (ej. "60 días antes", "el día de embarque al mediodía").
  start y end: horas del día en decimal (11.5 = 11:30) solo si el video da una hora o franja.
  place: el lugar del viaje o del sitio al que se refiere, si lo dice. brand: la empresa, barco o parque al que aplica, si el consejo es específico de uno.
  at: segundo del video donde se dice o se ve.
Reglas:
- Lee todo el texto en pantalla: en estos videos muchos consejos solo aparecen escritos.
- En un video tipo lista ("5 errores…", "3 cosas que…"), cada punto es un insight o un spot aparte.
- Un insight debe tener algo concreto: un nombre, un número, una hora, un lugar o una acción clara. Omite lo genérico ("disfruta", "pásala bien").
- No repitas como insight lo que ya es un spot.
- No inventes: solo lo que se ve o se oye. Si no hay nada concreto, devuelve listas vacías.`;
}
