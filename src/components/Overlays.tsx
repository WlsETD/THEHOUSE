import { useEffect, useRef } from 'react';
import type { SceneManager } from '../three/SceneManager';
import type { ChapterWindow } from '../animation/CameraPath';
import type { Room, RoomsFile, SceneFile } from '../data/types';

/** Hero copy — visible on the establishing shot, fades as soon as the visitor scrolls. */
export function HeroOverlay({ manager, roomCount }: { manager: SceneManager | null; roomCount: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!manager) return;
    return manager.onFrame(f => {
      if (!el.current) return;
      const o = manager.cam.mode === 'scroll' ? Math.max(0, 1 - f.progress / 0.022) : 0;
      el.current.style.opacity = o.toFixed(3);
      el.current.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    }) as () => void;
  }, [manager]);
  return (
    <div className="hero fade-enter" ref={el}>
      <div className="hero-title">
        <h1 className="display">A Space to Experience.</h1>
        <p>Designed Around<br />The Art of Living.</p>
        <div className="hero-meta label"><span>Xindian, New Taipei</span><span>Project ACL16004</span><span className="num">{roomCount} spaces</span></div>
      </div>
      <div className="scroll-cue label"><span>Scroll to explore</span><span className="rail" aria-hidden="true" /></div>
    </div>
  );
}

/** Final overview — project facts, all from rooms.json / scene.json. */
export function Finale({ manager, window: w, rooms, scene, onExplore, onRestart }: {
  manager: SceneManager | null; window: ChapterWindow | undefined; rooms: RoomsFile; scene: SceneFile; onExplore: () => void; onRestart: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!manager || !w) return;
    return manager.onFrame(f => {
      if (!el.current) return;
      const o = manager.cam.mode === 'scroll' ? Math.min(1, Math.max(0, (f.progress - w.start + 0.02) / 0.03)) : 0;
      el.current.style.opacity = o.toFixed(3);
      el.current.classList.toggle('is-on', o > 0.5);
    }) as () => void;
  }, [manager, w]);
  const interior = rooms.rooms.filter(r => r.kind === 'interior').length;
  const outdoor = rooms.rooms.length - interior;
  const [, , bw, bh] = scene.meta.bbox_plan_mm;
  return (
    <section className="finale" ref={el} aria-label="Project summary">
      <div className="label" style={{ color: 'var(--bone-dim)' }}>Final overview</div>
      <h2 className="display">Wu Residence</h2>
      <div className="facts label">
        <div><span>Interior</span><b className="num">{rooms.totals.interior_m2.toFixed(2)} m²</b></div>
        <div><span>Balconies</span><b className="num">{rooms.totals.balcony_m2.toFixed(2)} m²</b></div>
        <div><span>Spaces</span><b className="num">{interior} + {outdoor} outdoor</b></div>
        <div><span>Footprint</span><b className="num">{(bw / 1000).toFixed(2)} × {(bh / 1000).toFixed(2)} m</b></div>
      </div>
      <div className="actions label">
        <button onClick={onExplore}>Explore freely</button>
        <button onClick={onRestart}>Back to the beginning</button>
      </div>
      <p className="credit">{scene.meta.project} · {scene.meta.project_no} · Plan {scene.meta.drawing} · {scene.meta.scale} · Model {scene.meta.model_version}. Rendered live in WebGL; heights not dimensioned on the drawing are assumptions.</p>
    </section>
  );
}

export function IndexMenu({ rooms, chapterOf, onGo, onClose }: { rooms: Room[]; chapterOf: (id: string) => number | null; onGo: (p: number) => void; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [onClose]);
  const group = (kind: string[]) => rooms.filter(r => kind.includes(r.kind));
  const list = (rs: Room[], start: number) => (
    <ol>
      {rs.map((r, i) => {
        const p = chapterOf(r.id);
        return (
          <li key={r.id}>
            <button disabled={p === null} onClick={() => { if (p !== null) { onGo(p); onClose(); } }}>
              <span className="label num">{String(start + i + 1).padStart(2, '0')}</span>
              <span>{r.name_en}<span className="zh">{r.name_zh}</span></span>
              <span className="label num">{r.area_m2.toFixed(2)} m²</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
  const inside = group(['interior']);
  return (
    <div className="index-menu" role="dialog" aria-modal="true" aria-label="Index of spaces">
      <h2 className="display">Index of spaces</h2>
      <div className="index-cols">
        <div><p className="label" style={{ color: 'var(--bone-faint)' }}>Interior · {inside.length}</p>{list(inside, 0)}</div>
        <div><p className="label" style={{ color: 'var(--bone-faint)' }}>Outdoor · {rooms.length - inside.length}</p>{list(group(['balcony', 'ledge']), inside.length)}</div>
      </div>
    </div>
  );
}

export function ExploreToolbar({ onReset, onOverview, onPlan, onExit, onFullscreen, pick, onClearPick }: {
  onReset: () => void; onOverview: () => void; onPlan: () => void; onExit: () => void; onFullscreen: () => void;
  pick: Record<string, unknown> | null; onClearPick: () => void;
}) {
  return (
    <>
      <p className="hint label">Drag to orbit · scroll or pinch to zoom · right-drag or two fingers to pan · click an object for its ID</p>
      <div className="toolbar label" role="toolbar" aria-label="Free explore">
        <button onClick={onReset}>Reset view</button>
        <button onClick={onOverview}>Overview</button>
        <button onClick={onPlan}>Floor plan</button>
        <button onClick={onFullscreen}>Fullscreen</button>
        <button className="primary" onClick={onExit}>Back to tour</button>
      </div>
      {pick && (
        <div className="pick" onClick={onClearPick}>
          <div className="label id">{String(pick.id)}</div>
          <div>{String(pick.name)}</div>
          <div className="label" style={{ color: 'var(--bone-dim)' }}>{String(pick.category)} · {String(pick.room ?? '—')} · {String(pick.layer)}</div>
        </div>
      )}
    </>
  );
}
