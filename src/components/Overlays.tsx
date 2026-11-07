import { useEffect, useRef } from 'react';
import type { SceneManager } from '../three/SceneManager';
import type { ChapterWindow } from '../animation/CameraPath';
import type { Room, RoomsFile, SceneFile } from '../data/types';
import { useLang } from '../i18n';

/** Hero copy — visible on the establishing shot, fades as soon as the visitor scrolls. */
export function HeroOverlay({ manager, roomCount }: { manager: SceneManager | null; roomCount: number }) {
  const { t } = useLang();
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
        <h1 className="display">{t('hero.title')}</h1>
        <p>{t('hero.sub1')}<br />{t('hero.sub2')}</p>
        <div className="hero-meta label"><span>{t('hero.place')}</span><span>{t('hero.project')}</span><span className="num">{roomCount} {t('hero.spaces')}</span></div>
      </div>
      <div className="scroll-cue label"><span>{t('hero.cue')}</span><span className="rail" aria-hidden="true" /></div>
    </div>
  );
}

/** Final overview — project facts, all from rooms.json / scene.json. */
export function Finale({ manager, window: w, rooms, scene, onExplore, onRestart, onStudio }: {
  manager: SceneManager | null; window: ChapterWindow | undefined; rooms: RoomsFile; scene: SceneFile; onExplore: () => void; onRestart: () => void; onStudio: () => void;
}) {
  const { t } = useLang();
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
      <div className="label" style={{ color: 'var(--bone-dim)' }}>{t('fin.label')}</div>
      <h2 className="display">{t('fin.title')}</h2>
      <div className="facts label">
        <div><span>{t('fin.interior')}</span><b className="num">{rooms.totals.interior_m2.toFixed(2)} m²</b></div>
        <div><span>{t('fin.balconies')}</span><b className="num">{rooms.totals.balcony_m2.toFixed(2)} m²</b></div>
        <div><span>{t('fin.spaces')}</span><b className="num">{interior} + {outdoor} {t('fin.outdoor')}</b></div>
        <div><span>{t('fin.footprint')}</span><b className="num">{(bw / 1000).toFixed(2)} × {(bh / 1000).toFixed(2)} m</b></div>
      </div>
      <div className="actions label">
        <button className="cta" onClick={onStudio}>{t('fin.studio')}</button>
        <button onClick={onExplore}>{t('fin.explore')}</button>
        <button onClick={onRestart}>{t('fin.restart')}</button>
      </div>
      <p className="credit">{scene.meta.project} · {scene.meta.project_no} · {scene.meta.drawing} · {scene.meta.scale} · Model {scene.meta.model_version}. {t('fin.credit')}</p>
    </section>
  );
}

export function IndexMenu({ rooms, chapterOf, onGo, onClose }: { rooms: Room[]; chapterOf: (id: string) => number | null; onGo: (p: number) => void; onClose: () => void }) {
  const { t, lang } = useLang();
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
              <span>{lang === 'zh' ? r.name_zh : r.name_en}<span className="zh">{lang === 'zh' ? r.name_en : r.name_zh}</span></span>
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
      <h2 className="display">{t('idx.title')}</h2>
      <div className="index-cols">
        <div><p className="label" style={{ color: 'var(--bone-faint)' }}>{t('idx.interior')} · {inside.length}</p>{list(inside, 0)}</div>
        <div><p className="label" style={{ color: 'var(--bone-faint)' }}>{t('idx.outdoor')} · {rooms.length - inside.length}</p>{list(group(['balcony', 'ledge']), inside.length)}</div>
      </div>
    </div>
  );
}

export function ExploreToolbar({ onReset, onOverview, onPlan, onExit, onFullscreen, pick, onClearPick, onEdit, studio }: {
  onReset: () => void; onOverview: () => void; onPlan: () => void; onExit: () => void; onFullscreen: () => void;
  pick: Record<string, unknown> | null; onClearPick: () => void; onEdit: () => void; studio: boolean;
}) {
  const { t } = useLang();
  return (
    <>
      {!studio && <p className="hint label">{t('ex.hint')}</p>}
      <div className={`toolbar label${studio ? ' with-studio' : ''}`} role="toolbar" aria-label="Free explore">
        <button onClick={onReset}>{t('ex.reset')}</button>
        <button onClick={onOverview}>{t('ex.overview')}</button>
        <button onClick={onPlan}>{t('ex.plan')}</button>
        <button onClick={onFullscreen}>{t('h.fs')}</button>
        <button className="primary" onClick={onExit}>{t('ex.back')}</button>
      </div>
      {pick && !studio && (
        <div className="pick">
          <button className="pick-x" onClick={onClearPick} aria-label={t('h.close')}>✕</button>
          <div className="label id">{String(pick.id)}</div>
          <div>{String(pick.name)}</div>
          <div className="label" style={{ color: 'var(--bone-dim)' }}>{String(pick.category)} · {String(pick.room ?? '—')} · {String(pick.layer)}</div>
          <button className="pick-edit label" onClick={onEdit}>{t('ex.edit')}</button>
        </div>
      )}
    </>
  );
}
