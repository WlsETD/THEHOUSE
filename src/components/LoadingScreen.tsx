import type { Room } from '../data/types';

interface Props { progress: number; rooms: Room[]; done: boolean; error: string | null }

/** Draws the actual room polygons from rooms.json while the model streams in. */
export function LoadingScreen({ progress, rooms, done, error }: Props) {
  const W = 14521, H = 12271;
  return (
    <div className={`loading${done ? ' is-done' : ''}`} role="status" aria-live="polite" aria-hidden={done}>
      <div>
        {error ? (
          <p className="err">{error}</p>
        ) : (
          <>
            <svg className="plan" viewBox={`-200 -200 ${W + 400} ${H + 400}`} aria-hidden="true">
              {rooms.map((r, i) => {
                const d = 'M' + r.polygon_mm.map(([x, z]) => `${x},${z}`).join('L') + 'Z';
                const len = r.polygon_mm.reduce((s, p, k, a) => { const q = a[(k + 1) % a.length]; return s + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
                const local = Math.min(1, Math.max(0, progress * rooms.length - i * 0.55));
                return <path key={r.id} d={d} style={{ strokeDasharray: len, strokeDashoffset: len * (1 - local) }} />;
              })}
            </svg>
            <div className="meta label">
              <span>Wu Residence · Plan A-D-11</span>
              <span className="num">{String(Math.round(progress * 100)).padStart(3, '0')}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
