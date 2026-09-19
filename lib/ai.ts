import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

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

/** Extracts and parses the first top-level JSON object found in a string. */
function parseJsonBlock(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("The model did not return a JSON object.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function complete(prompt: string, maxTokens: number): Promise<string> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("The model did not return a text response.");
  }
  return textBlock.text;
}

// ---------------------------------------------------------------------------
// Exercise text generation
// ---------------------------------------------------------------------------

const generatedExerciseSchema = z.object({
  title: z.string().min(1).max(80),
  sourceText: z.string().min(1),
  wordCount: z.number().int().positive(),
});

export type GeneratedExercise = z.infer<typeof generatedExerciseSchema>;

const TEXT_TYPE_PROMPTS: Record<string, string> = {
  LITERARY: "littéraire (registre narratif, soigné)",
  JOURNALISTIC: "journalistique (style d'article de presse)",
  DAILY: "de la vie quotidienne (registre courant, familier ou pratique)",
};

export async function generateExerciseText(params: {
  textType: "LITERARY" | "JOURNALISTIC" | "DAILY";
  level: "A2" | "B1" | "B2" | "C1";
  themes: string[];
}): Promise<GeneratedExercise> {
  const prompt = `Tu es un générateur de textes pour une application d'entraînement à la traduction français → anglais nommée Versus.

Écris un texte original en français, de type ${TEXT_TYPE_PROMPTS[params.textType]}, calibré pour un niveau de langue ${params.level} (CECRL), et abordant ${
    params.themes.length > 0 ? `le(s) thème(s) suivant(s) : ${params.themes.join(", ")}` : "un thème de ton choix"
  }.

Contraintes :
- Longueur : entre 130 et 170 mots.
- Le texte doit être cohérent, autonome (pas besoin de contexte externe), et adapté à un exercice de traduction.
- Donne aussi un titre court (3 à 6 mots).

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format exact suivant :
{"title": "...", "sourceText": "...", "wordCount": <nombre entier de mots dans sourceText>}`;

  const raw = await complete(prompt, 1500);
  const parsed = generatedExerciseSchema.parse(parseJsonBlock(raw));
  return parsed;
}

// ---------------------------------------------------------------------------
// Translation correction / grading
// ---------------------------------------------------------------------------

const sentenceCorrectionSchema = z.object({
  source: z.string(),
  userText: z.string(),
  highlight: z.string().nullable(),
  category: z.string(),
  comment: z.string(),
});

const suggestedCardSchema = z.object({
  front: z.string(),
  back: z.string(),
  category: z.string(),
});

const correctionResultSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  adjustedScore: z.number().int().min(0).max(100),
  referenceTranslation: z.string(),
  sentenceCorrections: z.array(sentenceCorrectionSchema).min(1),
  suggestedCards: z.array(suggestedCardSchema).min(1).max(5),
});

export type CorrectionResult = z.infer<typeof correctionResultSchema>;

export async function correctTranslation(params: {
  sourceText: string;
  userTranslation: string;
  level: "A2" | "B1" | "B2" | "C1";
}): Promise<CorrectionResult> {
  const prompt = `Tu es un correcteur expert de traduction français → anglais pour l'application Versus. Un apprenant de niveau ${params.level} (CECRL) a traduit le texte source suivant.

Texte source (français) :
"""
${params.sourceText}
"""

Traduction de l'apprenant (anglais) :
"""
${params.userTranslation}
"""

Tâche :
1. Découpe le texte source en phrases et compare chaque phrase à la portion correspondante de la traduction de l'apprenant.
2. Pour chaque phrase, identifie le principal problème (s'il y en a un) : registre, temps verbal, vocabulaire, grammaire, syntaxe, etc. Si une portion précise du texte de l'apprenant illustre le problème, indique-la exactement telle qu'elle apparaît dans "userText" (champ "highlight"). Si la phrase est correcte, mets "highlight" à null et un commentaire positif bref.
3. Donne une traduction de référence complète et idiomatique du texte source entier.
4. Attribue un score global sur 100 (qualité générale de la traduction) et un score ajusté sur 100 qui tient compte du niveau ${params.level} de l'apprenant (plus indulgent qu'un correcteur natif ne le serait, en valorisant la maîtrise attendue à ce niveau).
5. Suggère 2 à 4 phrases (parmi les phrases du texte) à ajouter à un deck de révision (flashcards), avec leur traduction de référence, en priorisant celles où l'apprenant a fait une erreur.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format exact suivant :
{
  "overallScore": <entier 0-100>,
  "adjustedScore": <entier 0-100>,
  "referenceTranslation": "...",
  "sentenceCorrections": [
    {"source": "...", "userText": "...", "highlight": "..." | null, "category": "...", "comment": "..."}
  ],
  "suggestedCards": [
    {"front": "...", "back": "...", "category": "..."}
  ]
}`;

  const raw = await complete(prompt, 4000);
  const parsed = correctionResultSchema.parse(parseJsonBlock(raw));
  return parsed;
}

export async function suggestReplacementCard(params: {
  sourceText: string;
  existingFronts: string[];
}): Promise<{ front: string; back: string; category: string }> {
  const prompt = `Tu es un assistant qui crée des flashcards de vocabulaire/traduction français → anglais pour l'application Versus, à partir du texte source suivant :
"""
${params.sourceText}
"""

Les phrases suivantes ont déjà été suggérées, ne les répète pas : ${
    params.existingFronts.length > 0
      ? params.existingFronts.map((f) => `"${f}"`).join(", ")
      : "(aucune)"
  }.

Choisis une autre phrase du texte (idéalement une qui illustre une difficulté de traduction utile à mémoriser) et donne sa traduction de référence en anglais, ainsi qu'une courte catégorie (ex: Vocabulaire, Temps verbal, Registre, Syntaxe).

Réponds UNIQUEMENT avec un objet JSON valide, au format exact :
{"front": "...", "back": "...", "category": "..."}`;

  const raw = await complete(prompt, 500);
  return suggestedCardSchema.parse(parseJsonBlock(raw));
}
