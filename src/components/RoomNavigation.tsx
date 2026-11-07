import { useEffect, useRef, useState } from 'react';
import type { SceneManager } from '../three/SceneManager';
import { useLang } from '../i18n';

export interface NavItem { key: string; label: string; zh?: string; progress: number; number: string }

interface Props { items: NavItem[]; active: number; roomCount: number; activeRoomNumber: number; onGo: (p: number) => void; manager: SceneManager | null; hidden: boolean }

/**
 * Scene dock — one frosted bar along the bottom edge so it reads over white walls as well as dark sky.
 * Every scene shows its number and name; when they do not fit, the rail scrolls sideways and the
 * list button opens the same scenes as a sidebar.
 */
export function RoomNavigation({ items, active, roomCount, activeRoomNumber, onGo, manager, hidden }: Props) {
  const { lang, t } = useLang();
  const bar = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [drawer, setDrawer] = useState(false);
  const [fits, setFits] = useState(true);
  const name = (it: NavItem) => (lang === 'zh' ? it.zh ?? it.label : it.label);
  useEffect(() => {
    if (!manager) return;
    return manager.onFrame(f => { if (bar.current) bar.current.style.transform = `scaleX(${f.progress.toFixed(4)})`; }) as () => void;
  }, [manager]);
  // does the whole rail fit? (otherwise it scrolls and the sidebar button matters more)
  useEffect(() => {
    const r = rail.current; if (!r) return;
    const check = () => setFits(r.scrollWidth <= r.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check); ro.observe(r);
    return () => ro.disconnect();
  }, [items, lang]);
  // keep the current scene in view when the rail scrolls
  useEffect(() => {
    const r = rail.current, b = r?.children[active] as HTMLElement | undefined;
    if (!r || !b || r.scrollWidth <= r.clientWidth) return;
    r.scrollTo({ left: b.offsetLeft - (r.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' });
  }, [active]);
  useEffect(() => {
    if (!drawer) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [drawer]);
  return (
    <>
      <nav className={`dock${fits ? '' : ' is-scrolling'}`} aria-label="Scenes" hidden={hidden}>
        <span className="dock-progress" aria-hidden="true"><i ref={bar} /></span>
        <button className="dock-list" onClick={() => setDrawer(v => !v)} aria-expanded={drawer} aria-label={t('nav.spaces')}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h10" /></svg>
          <span className="num"><b>{String(Math.max(1, activeRoomNumber)).padStart(2, '0')}</b> / {String(roomCount).padStart(2, '0')}</span>
        </button>
        <div className="dock-rail" ref={rail}>
          {items.map((it, i) => (
            <button key={it.key} className={it.number ? 'is-room' : 'is-section'} aria-current={i === active ? 'step' : undefined}
              onClick={() => onGo(it.progress)}>
              {it.number && <span className="no num">{it.number}</span>}
              <span className="nm">{name(it)}</span>
            </button>
          ))}
        </div>
      </nav>
      {drawer && !hidden && (
        <aside className="scene-drawer" aria-label={t('nav.spaces')}>
          <div className="sd-head label"><span>{t('nav.spaces')}</span><button onClick={() => setDrawer(false)} aria-label={t('h.close')}>✕</button></div>
          <ol>
            {items.map((it, i) => (
              <li key={it.key}>
                <button aria-current={i === active ? 'step' : undefined} onClick={() => { onGo(it.progress); setDrawer(false); }}>
                  <span className="no num">{it.number || '·'}</span>
                  <span className="nm">{name(it)}<small>{lang === 'zh' ? it.label : it.zh}</small></span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </>
  );
}
