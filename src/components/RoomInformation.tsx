import { useEffect, useRef } from 'react';
import type { SceneManager } from '../three/SceneManager';
import type { ChapterWindow } from '../animation/CameraPath';
import { chapterVisibility } from '../animation/RoomTransitions';
import type { RoomStory, MaterialStory } from '../data/roomData';
import type { Room, Material, SceneObject } from '../data/types';

interface Props {
  manager: SceneManager | null;
  chapters: ChapterWindow[];
  stories: RoomStory[];
  materialStories: MaterialStory[];
  rooms: Room[];
  materials: Record<string, Material>;
  objects: SceneObject[];
  reduced: boolean;
}

/** Room + material panels; opacity and slide are driven every frame from scroll progress. */
export function RoomInformation({ manager, chapters, stories, materialStories, rooms, materials, objects, reduced }: Props) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    if (!manager) return;
    return manager.onFrame(f => {
      chapters.forEach((c, i) => {
        const el = refs.current[i];
        if (!el) return;
        const prev = chapters.slice(0, i).reverse().find(x => x.end > x.start);
        const next = chapters.slice(i + 1).find(x => x.end > x.start);
        const v = manager.cam.mode === 'scroll' ? chapterVisibility(c, f.progress, 0.012, prev?.end ?? -1, next?.start ?? 2) : { o: 0, y: 0 };
        el.style.opacity = v.o.toFixed(3);
        el.style.transform = reduced ? '' : `translate3d(0, ${(v.y * 18).toFixed(1)}px, 0)`;
        el.style.visibility = v.o < 0.01 ? 'hidden' : 'visible';
      });
    }) as () => void;
  }, [manager, chapters, reduced]);

  const roomNo = new Map(stories.map((s, i) => [s.room, i + 1]));
  const roomById = new Map(rooms.map(r => [r.id, r]));
  const objById = new Map(objects.map(o => [o.id, o]));

  return (
    <div className="chapters">
      {chapters.map((c, i) => {
        const story = stories.find(s => s.room === c.chapter);
        const ms = materialStories.find(m => m.key === c.chapter);
        const set = (el: HTMLElement | null) => { refs.current[i] = el; };
        if (story) {
          const r = roomById.get(story.room)!;
          const n = roomNo.get(story.room)!;
          return (
            <article key={c.chapter} ref={set} className="chapter" aria-hidden="true">
              <div className="index label"><span className="n num">{String(n).padStart(2, '0')}</span><span>/ {String(stories.length).padStart(2, '0')}</span></div>
              <h2>{story.title}<span className="zh">{r.name_zh}</span></h2>
              <p className="line">{story.line}</p>
              <p className="concept">{story.concept}</p>
              <dl className="facts label">
                <dt>Area</dt><dd className="area num">{r.area_m2.toFixed(2)} m²</dd>
                <dt>Materials</dt><dd className="mats">{story.materials.map(k => shortName(materials[k]?.name_en ?? k)).join(' / ')}</dd>
                <dt>Features</dt><dd>{story.features.join(' · ')}</dd>
                <dt>Furniture</dt><dd>{story.furniture.join(' · ')}</dd>
              </dl>
            </article>
          );
        }
        if (ms) {
          const keys = [ms.key, ...(ms.with ?? [])].filter(k => materials[k]);
          const usedRooms = new Set<string>();
          let count = 0;
          for (const k of keys) for (const id of materials[k].used_by) {
            const o = objById.get(id); if (!o) continue; count++;
            if (o.room && roomById.get(o.room)?.kind === 'interior') usedRooms.add(roomById.get(o.room)!.name_en);
          }
          const m = materials[ms.key];
          return (
            <article key={c.chapter} ref={set} className="material" aria-hidden="true">
              <div className="label" style={{ color: 'var(--bone-faint)' }}>Material · {m.category}</div>
              <h2 className="display" style={{ fontSize: 'var(--step-3)', margin: '14px 0 0' }}>{ms.title}</h2>
              <p className="concept" style={{ color: 'var(--bone-dim)', lineHeight: 1.6, margin: '16px 0 0' }}>{ms.note}</p>
              <div className="swatches">
                {keys.map(k => <span key={k} className="sw" title={materials[k].name_en} style={swatch(materials[k])} />)}
              </div>
              <p className="where label">{keys.map(k => materials[k].name_en).join(' · ')}<br />
                Applied to {count} objects in {[...usedRooms].slice(0, 5).join(', ')}{usedRooms.size > 5 ? ` +${usedRooms.size - 5}` : ''}</p>
            </article>
          );
        }
        if (c.chapter === 'materials') {
          return (
            <div key={c.chapter} ref={set} className="mat-intro" aria-hidden="true">
              <div className="label" style={{ color: 'var(--bone-dim)' }}>Interlude</div>
              <h2 className="display">Material Experience</h2>
              <p className="label" style={{ color: 'var(--bone-faint)', marginTop: 18 }}>{Object.keys(materials).length} PBR materials · materials.json</p>
            </div>
          );
        }
        return <span key={c.chapter} ref={set} />;
      })}
    </div>
  );
}

function shortName(s: string) { return s.split(',')[0]; }

function swatch(m: Material): React.CSSProperties {
  const tex = m.textures?.baseColor;
  if (tex) return { backgroundImage: `url(./${tex})`, backgroundColor: m.pbr.baseColor_srgb ?? '#888' };
  return { background: m.pbr.baseColor_srgb ?? '#888', opacity: m.pbr.opacity < 1 ? 0.55 : 1 };
}
