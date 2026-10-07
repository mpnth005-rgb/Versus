/** Full-screen wait during AI work. `progress` (0–1) comes from the route's
 * progress stream (lib/progress-stream.ts); the bar glides between reports. */
export function LoadingScreen({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-[30px] bg-paper">
      <div className="font-serif text-[38px] font-semibold text-ink">V</div>
      <div className="h-[5px] w-80 overflow-hidden rounded-[3px] bg-paper-alt-2">
        <div
          className="h-full rounded-[3px] bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(3, progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
