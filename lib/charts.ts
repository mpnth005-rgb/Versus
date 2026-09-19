// Minimal SVG chart geometry helpers — no charting library, matching the
// design's hand-authored inline SVGs, but computed from real data.

const LINE_WIDTH = 560;
const LINE_HEIGHT = 220;
const LINE_TOP = 10;
const LINE_BOTTOM = 199;

export function buildScoreLinePoints(scores: number[]): {
  linePoints: string;
  areaPoints: string;
  width: number;
  height: number;
} {
  const n = scores.length;
  const yFor = (value: number) => LINE_TOP + ((100 - value) / 100) * (LINE_BOTTOM - LINE_TOP);
  const xFor = (i: number) => (n <= 1 ? LINE_WIDTH / 2 : (i * LINE_WIDTH) / (n - 1));

  const points = scores.map((s, i) => `${xFor(i)},${yFor(s)}`);
  const linePoints = points.join(" ");
  const areaPoints =
    points.length > 0
      ? `${linePoints} ${LINE_WIDTH},${LINE_BOTTOM + 1} 0,${LINE_BOTTOM + 1}`
      : "";

  return { linePoints, areaPoints, width: LINE_WIDTH, height: LINE_HEIGHT };
}

const BAR_WIDTH = 26;
const BAR_GAP = 14;
const BAR_TOP = 10;
const BAR_BOTTOM = 199;

export function buildWeeklyBars(counts: number[]): {
  bars: { x: number; y: number; height: number; count: number }[];
  width: number;
  height: number;
  axisMax: number;
} {
  const maxCount = Math.max(...counts, 1);
  const axisMax = Math.max(5, Math.ceil(maxCount / 5) * 5);

  const bars = counts.map((count, i) => {
    const x = 10 + i * (BAR_WIDTH + BAR_GAP);
    const height = (count / axisMax) * (BAR_BOTTOM - BAR_TOP);
    const y = BAR_BOTTOM - height;
    return { x, y, height, count };
  });

  const width = 10 + counts.length * (BAR_WIDTH + BAR_GAP);
  return { bars, width: Math.max(width, 320), height: 220, axisMax };
}

export { LINE_TOP, LINE_BOTTOM };
