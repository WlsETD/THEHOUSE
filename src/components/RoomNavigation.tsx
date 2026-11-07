import { useEffect, useRef } from 'react';
import type { SceneManager } from '../three/SceneManager';

export interface NavItem { key: string; label: string; progress: number; number: string }

interface Props { items: NavItem[]; active: number; roomCount: number; activeRoomNumber: number; onGo: (p: number) => void; manager: SceneManager | null; hidden: boolean }

export function RoomNavigation({ items, active, roomCount, activeRoomNumber, onGo, manager, hidden }: Props) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!manager) return;
    return manager.onFrame(f => { if (bar.current) bar.current.style.width = `${(f.progress * 100).toFixed(2)}%`; }) as () => void;
  }, [manager]);
  return (
    <>
      <nav className="nav" aria-label="Spaces" hidden={hidden}>
        {items.map((it, i) => (
          <button key={it.key} aria-current={i === active ? 'step' : undefined} onClick={() => onGo(it.progress)}>
            <span className="nm">{it.number && <span className="num">{it.number} </span>}{it.label}</span>
            <span className="bar" />
          </button>
        ))}
      </nav>
      <div className="counter label" hidden={hidden} aria-live="polite">
        <span className="big num">{String(Math.max(1, activeRoomNumber)).padStart(2, '0')} / {String(roomCount).padStart(2, '0')}</span>
        <span>Spaces</span>
        <span className="track" aria-hidden="true"><i ref={bar} /></span>
      </div>
    </>
  );
}
