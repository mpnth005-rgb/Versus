import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
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

/**
 * Calls Claude with a single forced tool call and returns the tool's
 * structured input directly. This sidesteps the classic "ask the model for
 * JSON in prose" failure mode entirely — Claude's tool-use path generates
 * schema-constrained JSON server-side, so there's no free-text JSON to
 * mis-parse (stray quotes, unescaped newlines, prose around the object).
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

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("The model did not return a tool call.");
  }
  return toolUse.input;
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

const generateExerciseTool: Tool = {
  name: "submit_exercise",
  description: "Submit the generated French exercise text.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title, 3 to 6 words." },
      sourceText: { type: "string", description: "The French exercise text, 130-170 words." },
      wordCount: { type: "integer", description: "Exact word count of sourceText." },
    },
    required: ["title", "sourceText", "wordCount"],
  },
};

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

Appelle l'outil submit_exercise avec le résultat.`;

  const result = await completeWithTool(prompt, generateExerciseTool, 1500);
  return generatedExerciseSchema.parse(result);
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

const sentenceCorrectionJsonSchema = {
  type: "object" as const,
  properties: {
    source: { type: "string", description: "The French source sentence." },
    userText: { type: "string", description: "The learner's translation of this sentence." },
    highlight: {
      type: ["string", "null"],
      description:
        "The exact substring of userText to flag, verbatim. Null if the sentence is correct.",
    },
    category: {
      type: "string",
      description: "e.g. Registre, Temps verbal, Vocabulaire, Grammaire, Syntaxe, Correct.",
    },
    comment: { type: "string", description: "Short comment explaining the issue (or praise)." },
  },
  required: ["source", "userText", "highlight", "category", "comment"],
};

const suggestedCardJsonSchema = {
  type: "object" as const,
  properties: {
    front: { type: "string", description: "French source sentence." },
    back: { type: "string", description: "Reference English translation." },
    category: { type: "string" },
  },
  required: ["front", "back", "category"],
};

const correctTranslationTool: Tool = {
  name: "submit_correction",
  description: "Submit the graded correction for the learner's translation.",
  input_schema: {
    type: "object",
    properties: {
      overallScore: { type: "integer", description: "0-100 overall translation quality." },
      adjustedScore: {
        type: "integer",
        description: "0-100, adjusted to be more lenient for the learner's CEFR level.",
      },
      referenceTranslation: {
        type: "string",
        description: "Full idiomatic reference translation of the entire source text.",
      },
      sentenceCorrections: { type: "array", items: sentenceCorrectionJsonSchema },
      suggestedCards: {
        type: "array",
        description: "2 to 4 sentences worth turning into flashcards.",
        items: suggestedCardJsonSchema,
      },
    },
    required: [
      "overallScore",
      "adjustedScore",
      "referenceTranslation",
      "sentenceCorrections",
      "suggestedCards",
    ],
  },
};

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
2. Pour chaque phrase, identifie le principal problème (s'il y en a un) : registre, temps verbal, vocabulaire, grammaire, syntaxe, etc. Si une portion précise du texte de l'apprenant illustre le problème, indique-la exactement telle qu'elle apparaît dans userText (champ highlight). Si la phrase est correcte, mets highlight à null et un commentaire positif bref (catégorie "Correct").
3. Donne une traduction de référence complète et idiomatique du texte source entier.
4. Attribue un score global sur 100 (qualité générale de la traduction) et un score ajusté sur 100 qui tient compte du niveau ${params.level} de l'apprenant (plus indulgent qu'un correcteur natif ne le serait, en valorisant la maîtrise attendue à ce niveau).
5. Suggère 2 à 4 phrases (parmi les phrases du texte) à ajouter à un deck de révision (flashcards), avec leur traduction de référence, en priorisant celles où l'apprenant a fait une erreur.

Appelle l'outil submit_correction avec le résultat.`;

  const result = await completeWithTool(prompt, correctTranslationTool, 4000);
  return correctionResultSchema.parse(result);
}

const suggestCardTool: Tool = {
  name: "submit_card",
  description: "Submit a single replacement flashcard suggestion.",
  input_schema: suggestedCardJsonSchema,
};

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

Appelle l'outil submit_card avec le résultat.`;

  const result = await completeWithTool(prompt, suggestCardTool, 500);
  return suggestedCardSchema.parse(result);
}
