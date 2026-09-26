import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";

import { countWords } from "@/lib/text";
import { ERROR_TYPES, ERROR_TYPE_LABELS, normalizeErrorType, type ErrorType } from "@/lib/scoring";

// 4 calls, matching "Prompts système IA" 1:1:
//   1. generateExerciseText      — the French source text
//   2. generateReferenceTranslation — a sentence-aligned reference translation
//   3. classifyTranslation       — compares the learner's translation to the
//                                  reference and classifies errors into the
//                                  fixed 9-category taxonomy. It NEVER
//                                  computes a score — see lib/scoring.ts for
//                                  why (the doc is explicit: a model that
//                                  occasionally miscounts an addition
//                                  corrupts scores silently).
//   4. suggestReplacementCard    — one decontextualized practice sentence
//                                  for a single error type.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set — AI-powered exercise generation and correction are unavailable."
    );
    this.name = "AiNotConfiguredError";
  }
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  return new Anthropic({ apiKey });
}

/**
 * Calls Claude with a single forced tool call and returns the tool's
 * structured input directly. Claude's tool-use path generates
 * schema-constrained JSON server-side, so there's no free-text JSON to
 * mis-parse (stray quotes, unescaped newlines, prose around the object).
 *
 * No `temperature` param: the spec calls for per-call temperature tuning
 * (high for generation variety, low for grading precision), but the API
 * rejects it as deprecated for this model — 400 invalid_request_error,
 * "`temperature` is deprecated for this model". Prompts lean on explicit
 * instructions (e.g. "fais varier...") to get variety instead.
 */
async function completeWithTool(
  prompt: string,
  tool: Tool,
  maxTokens: number
): Promise<unknown> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error(
      `The model hit the ${maxTokens}-token limit for tool "${tool.name}" before finishing its output — the tool call is truncated/incomplete. Increase maxTokens for this call.`
    );
  }

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("The model did not return a tool call.");
  }
  return toolUse.input;
}

// ---------------------------------------------------------------------------
// Appel 1 — Exercise text generation
// ---------------------------------------------------------------------------

const generatedExerciseSchema = z.object({
  title: z.string().min(1).max(80),
  sourceText: z.string().min(1),
  wordCount: z.number().int().positive(),
});

export type GeneratedExercise = z.infer<typeof generatedExerciseSchema>;

const generateExerciseTool: Tool = {
  name: "submit_exercise",
  description: "Submit the generated French exercise text.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Titre court, 2 à 6 mots." },
      sourceText: { type: "string", description: "Le texte source en français, 130-170 mots." },
      wordCount: {
        type: "integer",
        description: "Compte exact de mots du champ sourceText, pour validation serveur.",
      },
    },
    required: ["title", "sourceText", "wordCount"],
  },
};

const TEXT_TYPE_PROMPTS: Record<string, string> = {
  LITERARY:
    "littéraire (narratif, sensoriel, peut inclure dialogue ou figures de style)",
  JOURNALISTIC:
    "journalistique/actualité (factuel, structuré, ton neutre, peut simuler un article — pas de fait réel daté ni de personne réelle nommée)",
  DAILY: "quotidien (registre courant, situation de vie ordinaire)",
};

const LEVEL_WRITING_GUIDANCE: Record<string, string> = {
  A2: "phrases courtes, vocabulaire courant, temps simples",
  B1: "quelques subordonnées, vocabulaire un peu plus varié",
  B2: "syntaxe plus riche, nuances, connecteurs logiques variés",
  C1: "syntaxe complexe, lexique précis, registre soutenu possible, sous-entendus",
};

// Real per-call variety: `temperature`/`top_p`/`top_k` are all deprecated
// for this model (see completeWithTool above), so there is no sampling
// randomness left on the API side. Asking the model to "vary itself" with
// an identical prompt each time produced near-duplicate texts under
// near-deterministic decoding. Instead we pick a genuinely different
// constraint server-side (Math.random(), not the model) for every call,
// so the actual prompt text — not just an instruction — differs each time.
const NARRATIVE_ANGLES = [
  "Commence par un dialogue direct entre deux personnages, sans phrase d'introduction.",
  "Ouvre sur une description sensorielle précise (un son, une odeur, une texture) avant d'introduire l'action.",
  "Structure le texte autour d'un objet ou détail concret qui revient à la fin.",
  "Adopte une focalisation interne : raconte depuis les pensées d'un seul personnage ou d'une seule voix.",
  "Introduis un basculement net à mi-texte (changement de ton, de rythme ou de situation).",
  "Construis le texte comme une succession de courtes observations juxtaposées plutôt qu'un récit linéaire.",
  "Termine sur une chute ou une question ouverte plutôt que sur une conclusion fermée.",
  "Commence in medias res, en plein milieu d'une action déjà engagée.",
  "Construis autour d'une comparaison ou d'une image qui traverse tout le texte.",
  "Adopte un ton légèrement ironique ou distancié sur la situation décrite.",
  "Alterne deux courts paragraphes contrastés (par exemple avant/après, ou deux points de vue).",
  "Ancre le texte dans un lieu précis décrit avec des détails concrets dès la première phrase.",
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function generateExerciseTextOnce(params: {
  textType: "LITERARY" | "JOURNALISTIC" | "DAILY";
  level: "A2" | "B1" | "B2" | "C1";
  themes: string[];
}): Promise<GeneratedExercise> {
  const angle = pickRandom(NARRATIVE_ANGLES);
  const targetWordCount = 135 + Math.floor(Math.random() * 31); // 135–165

  const prompt = `Tu es un générateur de textes pour une plateforme d'entraînement à la traduction FR → EN nommée Versus.

Tu reçois trois critères choisis par l'utilisateur : un type de texte, un niveau de langue (échelle CECRL), et une liste de thèmes.
- Type de texte : ${TEXT_TYPE_PROMPTS[params.textType]}
- Niveau CECRL : ${params.level} (${LEVEL_WRITING_GUIDANCE[params.level]})
- Thèmes : ${params.themes.length > 0 ? params.themes.join(", ") : "un thème de ton choix"}

Génère un texte ORIGINAL en français répondant à ces critères :
- Longueur cible : environ ${targetWordCount} mots (strictement entre 130 et 170 dans tous les cas).
- Adapte le lexique, la longueur des phrases et la complexité syntaxique au niveau CECRL demandé.
- Intègre organiquement les thèmes demandés sans les lister artificiellement.
- Ne nomme AUCUNE personne réelle, ne fais référence à AUCUN événement d'actualité réel vérifiable, n'utilise AUCUN personnage ou œuvre sous droit d'auteur.
- Consigne de structure pour CE texte précisément (ne la mentionne jamais, elle est invisible pour l'utilisateur) : ${angle}
- Ne réutilise jamais un titre, un nom de personnage ou une accroche déjà vus.
- Le texte doit constituer un exercice de traduction intéressant : varie les temps verbaux, inclus au moins une expression idiomatique ou tournure non triviale adaptée au niveau, évite les phrases trop plates.

Appelle l'outil submit_exercise avec le résultat.`;

  const result = await completeWithTool(prompt, generateExerciseTool, 1500);
  return generatedExerciseSchema.parse(result);
}

/** Recounts words server-side rather than trusting the model's self-reported
 * count, and retries generation if the text falls outside 130-170 words. */
export async function generateExerciseText(params: {
  textType: "LITERARY" | "JOURNALISTIC" | "DAILY";
  level: "A2" | "B1" | "B2" | "C1";
  themes: string[];
}): Promise<GeneratedExercise> {
  const MAX_ATTEMPTS = 3;
  let last: GeneratedExercise | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const generated = await generateExerciseTextOnce(params);
    const wordCount = countWords(generated.sourceText);
    last = { ...generated, wordCount };
    if (wordCount >= 130 && wordCount <= 170) return last;
  }

  return last!;
}

// ---------------------------------------------------------------------------
// Appel 2 — Reference translation, sentence-aligned
// ---------------------------------------------------------------------------

const referenceSentenceSchema = z.object({
  numero: z.number().int().positive(),
  phraseSource: z.string(),
  phraseTraduite: z.string(),
});

const referenceTranslationSchema = z.object({
  traductionComplete: z.string(),
  phrases: z.array(referenceSentenceSchema).min(1),
});

export type ReferenceTranslation = z.infer<typeof referenceTranslationSchema>;

const generateReferenceTool: Tool = {
  name: "submit_reference_translation",
  description: "Submit the sentence-aligned reference translation.",
  input_schema: {
    type: "object",
    properties: {
      traductionComplete: { type: "string", description: "Traduction anglaise complète, texte continu." },
      phrases: {
        type: "array",
        description: "Alignement phrase par phrase, même ordre et même nombre que le texte source.",
        items: {
          type: "object",
          properties: {
            numero: { type: "integer" },
            phraseSource: { type: "string" },
            phraseTraduite: { type: "string" },
          },
          required: ["numero", "phraseSource", "phraseTraduite"],
        },
      },
    },
    required: ["traductionComplete", "phrases"],
  },
};

export async function generateReferenceTranslation(
  sourceText: string
): Promise<ReferenceTranslation> {
  const prompt = `Tu es un traducteur professionnel FR → EN. Tu reçois un texte source en français.

Texte source :
"""
${sourceText}
"""

Produis une traduction de référence en anglais qui :
- Restitue fidèlement le sens, le registre et le ton du texte source (pas de traduction mot-à-mot / calque).
- Utilise une syntaxe et des tournures naturelles en anglais, pas des structures françaises transposées.
- Respecte les conventions de temps verbaux propres à l'anglais (ex. concordance des temps dans un récit au passé), même quand elles diffèrent du français.
- Reste au niveau de langue général du texte source (ne simplifie pas, n'enrichit pas artificiellement).

Découpe ta traduction phrase par phrase, alignée sur le découpage en phrases du texte source (même nombre de phrases, dans le même ordre), pour permettre une comparaison phrase par phrase ultérieure.

Appelle l'outil submit_reference_translation avec le résultat.`;

  const result = await completeWithTool(prompt, generateReferenceTool, 3000);
  return referenceTranslationSchema.parse(result);
}

// ---------------------------------------------------------------------------
// Appel 3 — Correction: error classification (never a score) + suggested cards
// ---------------------------------------------------------------------------

const errorTypeEnumSchema = z.preprocess(
  normalizeErrorType,
  z.enum(ERROR_TYPES as [ErrorType, ...ErrorType[]])
);

const sentenceErrorSchema = z.object({
  type: errorTypeEnumSchema,
  explanation: z.string(),
});

const flaggedSentenceSchema = z.object({
  sentenceNumber: z.number().int().positive(),
  sourceSentence: z.string(),
  userSentence: z.string(),
  errors: z.array(sentenceErrorSchema).min(1),
});

const suggestedCardSchema = z.object({
  front: z.string(),
  back: z.string(),
  category: errorTypeEnumSchema,
});

const classificationSchema = z.object({
  flaggedSentences: z.array(flaggedSentenceSchema),
  suggestedCards: z.array(suggestedCardSchema).max(10),
});

export type FlaggedSentence = z.infer<typeof flaggedSentenceSchema>;
export type SuggestedCard = z.infer<typeof suggestedCardSchema>;
export type TranslationClassification = z.infer<typeof classificationSchema>;

const errorTypeSchema = {
  type: "string" as const,
  enum: ERROR_TYPES,
};

const classifyTool: Tool = {
  name: "submit_classification",
  description:
    "Submit the classified translation errors (never a score) and suggested flashcards.",
  input_schema: {
    type: "object",
    properties: {
      flaggedSentences: {
        type: "array",
        description:
          "Uniquement les phrases contenant au moins une erreur. Ne pas inclure les phrases correctes.",
        items: {
          type: "object",
          properties: {
            sentenceNumber: { type: "integer" },
            sourceSentence: { type: "string" },
            userSentence: {
              type: "string",
              description: "La portion correspondante de la traduction de l'utilisateur.",
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: errorTypeSchema,
                  explanation: {
                    type: "string",
                    description: "Explication pédagogique courte, 2-3 phrases maximum.",
                  },
                },
                required: ["type", "explanation"],
              },
            },
          },
          required: ["sentenceNumber", "sourceSentence", "userSentence", "errors"],
        },
      },
      suggestedCards: {
        type: "array",
        description:
          "0 à 10 cartes, une par type d'erreur distinct relevé (0 si aucune erreur). Chaque carte cible une seule erreur réellement commise par l'utilisateur.",
        items: {
          type: "object",
          properties: {
            front: {
              type: "string",
              description:
                "Phrase française COURTE (5-15 mots), autonome, indépendante du texte de l'exercice, ciblant précisément le point de difficulté.",
            },
            back: { type: "string", description: "Traduction anglaise correcte." },
            category: errorTypeSchema,
          },
          required: ["front", "back", "category"],
        },
      },
    },
    required: ["flaggedSentences", "suggestedCards"],
  },
};

export async function classifyTranslation(params: {
  sourceText: string;
  reference: ReferenceTranslation;
  userTranslation: string;
}): Promise<TranslationClassification> {
  const referenceBlock = params.reference.phrases
    .map((p) => `${p.numero}. FR: ${p.phraseSource}\n   EN (référence): ${p.phraseTraduite}`)
    .join("\n");

  const prompt = `Tu es un correcteur de traduction FR → EN pour une plateforme d'entraînement. Tu reçois le texte source en français, la traduction de référence phrase par phrase (déjà générée), et la traduction soumise par l'utilisateur.

Texte source (français) :
"""
${params.sourceText}
"""

Traduction de référence, phrase par phrase :
${referenceBlock}

Traduction soumise par l'utilisateur (texte libre, à aligner toi-même sur la numérotation ci-dessus) :
"""
${params.userTranslation}
"""

Compare la traduction utilisateur à la traduction de référence, phrase par phrase, et identifie les erreurs selon EXACTEMENT ces 9 catégories (n'en invente aucune autre, n'en fusionne aucune, et utilise le code exact — majuscules, underscores — dans le champ "type"/"category") : ${ERROR_TYPES.join(", ")}.

- FAUTE_DE_TEMPS (${ERROR_TYPE_LABELS.FAUTE_DE_TEMPS}) : mauvais temps verbal.
- CONTRESENS (${ERROR_TYPE_LABELS.CONTRESENS}) : sens contraire ou substantiellement différent du texte source (vérifie toujours le contexte avant de qualifier un terme de contresens).
- FAUTE_DE_STYLE (${ERROR_TYPE_LABELS.FAUTE_DE_STYLE}) : non-respect du style ou du rythme de la phrase source.
- FAUTE_DE_PREPOSITION (${ERROR_TYPE_LABELS.FAUTE_DE_PREPOSITION}) : préposition incorrecte pour le sens spatial/logique visé.
- FAUTE_DE_VOCABULAIRE (${ERROR_TYPE_LABELS.FAUTE_DE_VOCABULAIRE}) : mot mal choisi, terme technique ou idiomatique manqué.
- FAUTE_DE_SYNTAXE (${ERROR_TYPE_LABELS.FAUTE_DE_SYNTAXE}) : structure grammaticale incorrecte en anglais (ex. comma splice).
- CALQUE (${ERROR_TYPE_LABELS.CALQUE}) : traduction mot-à-mot d'une structure française qui n'existe pas ainsi en anglais.
- TRADUCTION_INEXACTE (${ERROR_TYPE_LABELS.TRADUCTION_INEXACTE}) : sens proche mais imprécis, sans être un contresens.
- FAUTE_DE_TON (${ERROR_TYPE_LABELS.FAUTE_DE_TON}) : registre ou ironie du texte source non restitués.

IMPORTANT — la traduction de référence est UN exemple valide, pas l'unique bonne réponse. N'attribue AUCUNE erreur du seul fait qu'une phrase s'écarte de la formulation de la référence : si la phrase de l'utilisateur est grammaticalement correcte, fidèle au sens et au registre du texte source, elle ne doit recevoir aucune pénalité, même si elle est formulée très différemment de la référence. Compare chaque phrase au texte source, jamais mot à mot à la référence.

Pour chaque phrase contenant une ou plusieurs erreurs, liste-les avec leur type exact et une explication pédagogique courte (2-3 phrases maximum, ton bienveillant mais précis). Si une phrase ne contient aucune erreur, NE L'INCLUS PAS dans flaggedSentences. N'attribue JAMAIS de score ni de pénalité chiffrée — cela sera calculé automatiquement à partir des types que tu identifies.

Ensuite, propose entre 0 et 10 cartes de révision (0 si aucune erreur), chacune ciblant UNE erreur précise commise par l'utilisateur — au maximum une carte par erreur distincte relevée. Chaque carte a un recto (une phrase française nouvelle, 5-15 mots, autonome) et un verso (sa traduction anglaise correcte). Cette phrase doit être totalement INDÉPENDANTE des critères de l'exercice (type de texte, niveau, thèmes) — choisis la formulation la plus simple et directe possible pour isoler le point de difficulté, sans bruit contextuel.

Appelle l'outil submit_classification avec le résultat.`;

  const result = await completeWithTool(prompt, classifyTool, 4000);
  return classificationSchema.parse(result);
}

// ---------------------------------------------------------------------------
// Appel 4 — Refresh a single suggested card (decontextualized, by error type)
// ---------------------------------------------------------------------------

const suggestCardTool: Tool = {
  name: "submit_card",
  description: "Submit a single replacement flashcard suggestion.",
  input_schema: {
    type: "object",
    properties: {
      front: {
        type: "string",
        description: "Phrase française courte (5-15 mots), autonome, sans contexte imposé.",
      },
      back: { type: "string", description: "Traduction anglaise correcte." },
      category: errorTypeSchema,
    },
    required: ["front", "back", "category"],
  },
};

export async function suggestReplacementCard(params: {
  errorType: ErrorType;
  previousFront?: string;
}): Promise<SuggestedCard> {
  const prompt = `Tu es un générateur de phrases d'exercice pour une plateforme d'entraînement à la traduction FR → EN.

Type d'erreur ciblé : ${params.errorType}
${params.previousFront ? `Phrase précédemment générée pour ce même point (à ne pas répéter, ni reformuler de façon très proche) : "${params.previousFront}"` : ""}

Génère UNE nouvelle phrase française courte (5-15 mots), autonome, qui isole clairement le point de difficulté correspondant à ce type d'erreur, accompagnée de sa traduction anglaise correcte. Cette phrase doit être totalement indépendante de tout contexte d'exercice (pas de thème, niveau ou registre imposé) — choisis la formulation la plus simple et la plus directe possible.

Appelle l'outil submit_card avec le résultat (category = "${params.errorType}").`;

  const result = await completeWithTool(prompt, suggestCardTool, 500);
  return suggestedCardSchema.parse(result);
}
