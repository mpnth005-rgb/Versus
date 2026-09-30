import { prisma } from "@/lib/prisma";
import { DEFAULT_DAILY_NEW_CARD_LIMIT } from "@/lib/constants";
import { DEFAULT_SRS_CONFIG, type SrsConfig } from "@/lib/srs";

export async function getUserSettings(userId: string) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return settings;
}

export async function getDailyNewCardLimit(userId: string): Promise<number> {
  const settings = await getUserSettings(userId);
  return settings?.dailyNewCardLimit ?? DEFAULT_DAILY_NEW_CARD_LIMIT;
}

/** Reads the per-user SRS parameters — see prisma/schema.prisma:UserSettings.
 * Not exposed in a settings UI yet, but nothing in lib/srs.ts hardcodes
 * these, so one can be added later without touching scheduling logic. */
export async function getSrsConfig(userId: string): Promise<SrsConfig> {
  const settings = await getUserSettings(userId);
  if (!settings) return DEFAULT_SRS_CONFIG;
  return {
    learningStepsMinutes:
      (settings.learningStepsMinutes as number[] | null) ?? DEFAULT_SRS_CONFIG.learningStepsMinutes,
    relearningStepsMinutes:
      (settings.relearningStepsMinutes as number[] | null) ??
      DEFAULT_SRS_CONFIG.relearningStepsMinutes,
    graduatingIntervalDays: settings.graduatingIntervalDays,
    easyIntervalDays: settings.easyIntervalDays,
    minimumIntervalDays: settings.minimumIntervalDays,
    easeFactorFloor: settings.easeFactorFloor,
  };
}

// Like Anki, a study day rolls over at 4 a.m. (Paris time) rather than
// midnight, so a late-night session still counts as the same day.
const STUDY_DAY_TIME_ZONE = "Europe/Paris";
const STUDY_DAY_ROLLOVER_HOUR = 4;

/** UTC offset (ms) of STUDY_DAY_TIME_ZONE at the given instant. */
function timeZoneOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDY_DAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wallClockAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return wallClockAsUtc - (at.getTime() - at.getMilliseconds());
}

/** Start of the study day containing `now` (the last 4 a.m. Paris time). */
export function startOfStudyDay(now: Date = new Date()): Date {
  const local = new Date(now.getTime() + timeZoneOffsetMs(now));
  if (local.getUTCHours() < STUDY_DAY_ROLLOVER_HOUR) {
    local.setUTCDate(local.getUTCDate() - 1);
  }
  const rolloverAsUtc = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    STUDY_DAY_ROLLOVER_HOUR
  );
  // DST never switches at 4 a.m., so the offset at the rollover instant is
  // the one in effect a few hours around it.
  return new Date(rolloverAsUtc - timeZoneOffsetMs(new Date(rolloverAsUtc)));
}

/**
 * Everything a review session needs, split by bucket. The session itself
 * (components/deck/review-session.tsx) picks the next card Anki-style:
 * - new cards: the oldest ones, up to what's left of today's quota;
 * - learning: every LEARNING/RELEARNING card, even those whose minute
 *   delay hasn't elapsed yet — they can be shown ahead of time once
 *   nothing else is left;
 * - review: cards due at any point before the next study day starts.
 */
export async function getReviewQueue(userId: string) {
  const dayStart = startOfStudyDay();
  const nextDayStart = startOfStudyDay(new Date(dayStart.getTime() + 30 * 60 * 60 * 1000));
  const dailyNewCardLimit = await getDailyNewCardLimit(userId);

  const introducedToday = await prisma.flashcard.count({
    where: { userId, introducedAt: { gte: dayStart } },
  });
  const newCardsLeft = Math.max(0, dailyNewCardLimit - introducedToday);

  const [newCards, learningCards, reviewCards] = await Promise.all([
    newCardsLeft > 0
      ? prisma.flashcard.findMany({
          where: { userId, state: "NEW" },
          orderBy: { createdAt: "asc" },
          take: newCardsLeft,
        })
      : Promise.resolve([]),
    prisma.flashcard.findMany({
      where: { userId, state: { in: ["LEARNING", "RELEARNING"] } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.flashcard.findMany({
      where: { userId, state: "REVIEW", dueAt: { lt: nextDayStart } },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  return { newCards, learningCards, reviewCards, dailyNewCardLimit, introducedToday };
}
