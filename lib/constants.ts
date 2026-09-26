export const FREE_MONTHLY_EXERCISE_LIMIT = 7;
export const FREE_MAX_CARDS_PER_EXERCISE = 3;
export const DEFAULT_DAILY_NEW_CARD_LIMIT = 10;

export const TEXT_TYPE_LABELS: Record<string, string> = {
  LITERARY: "Littéraire",
  JOURNALISTIC: "Journalistique",
  DAILY: "Quotidien",
};

export const LEVEL_LABELS: Record<string, string> = {
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
};

export const THEME_OPTIONS = [
  "Science",
  "Environnement",
  "Politique",
  "Économie",
  "Société",
  "Culture",
] as const;

export const MAX_THEMES = 3;

// Shared between the sub-theme picker (criteria-form.tsx) and the exercise
// generation prompt (lib/ai.ts) — one source of truth so the UI only ever
// offers subthemes the server actually knows how to use.
export const THEME_SUBTOPICS: Record<string, string[]> = {
  Science: [
    "Astronomie et espace",
    "Physique quantique",
    "Biologie et génétique",
    "Médecine et santé",
    "Neurosciences",
    "Intelligence artificielle",
    "Chimie et matériaux",
    "Paléontologie et archéologie",
    "Mathématiques",
    "Océanographie",
  ],
  Environnement: [
    "Changement climatique",
    "Biodiversité et espèces menacées",
    "Énergies renouvelables",
    "Pollution de l'air",
    "Gestion de l'eau",
    "Déforestation",
    "Océans et pollution plastique",
    "Agriculture durable",
    "Recyclage et économie circulaire",
    "Catastrophes naturelles",
  ],
  Politique: [
    "Élections et systèmes électoraux",
    "Relations internationales",
    "Union européenne",
    "Droits de l'homme",
    "Politique intérieure française",
    "Conflits et géopolitique",
    "Institutions et Constitution",
    "Partis et mouvements politiques",
    "Politiques migratoires",
    "Défense et sécurité",
  ],
  Économie: [
    "Inflation et pouvoir d'achat",
    "Marchés financiers et Bourse",
    "Emploi et chômage",
    "Commerce international",
    "Cryptomonnaies et finance numérique",
    "Entrepreneuriat et startups",
    "Fiscalité et impôts",
    "Immobilier et logement",
    "Banques centrales et politique monétaire",
    "Inégalités et répartition des richesses",
  ],
  Société: [
    "Éducation et école",
    "Santé publique",
    "Égalité femmes-hommes",
    "Famille et parentalité",
    "Jeunesse et génération Z",
    "Réseaux sociaux et numérique",
    "Travail et télétravail",
    "Religion et laïcité",
    "Vieillissement de la population",
    "Justice et criminalité",
  ],
  Culture: [
    "Cinéma et séries",
    "Littérature et édition",
    "Musique",
    "Arts plastiques et expositions",
    "Théâtre et spectacle vivant",
    "Patrimoine et monuments",
    "Jeux vidéo",
    "Mode et design",
    "Gastronomie",
    "Photographie",
  ],
};

export const NAV_ITEMS = [
  { href: "/training", label: "Entraînement" },
  { href: "/deck", label: "Deck de révision" },
  { href: "/progress", label: "Progression" },
  { href: "/account", label: "Gestion du compte" },
] as const;

/** Returns "2026-09" for the current UTC month. */
export function currentYearMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
