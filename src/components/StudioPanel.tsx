import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import type { SceneManager } from '../three/SceneManager';
import type { ProjectData, Material, Room } from '../data/types';
import { DesignEditor, SURFACES, SWATCHES, ANY_FINISH, THEMES, type SurfaceDef, type FinishState, type Swatch } from '../three/DesignEditor';
import { LAYERS, fmtLen, type Unit, type ViewMode } from '../three/StudioTools';
import { DEFAULT_LIGHTS, type LightState } from '../three/Lighting';
import { exportGLB, exportOBJ, exportPNG, exportSceneJson, exportDesign } from '../three/exporters';
import { useLang } from '../i18n';

interface Props {
  manager: SceneManager;
  data: ProjectData;
  onClose: () => void;
  ensureExplore: () => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onReport: () => void;
  onResetView: () => void;
  onFlyRoom: (id: string) => void;
  onScene: (n: number) => void;
  focus: string | null;
}

const SAVE_KEY = 'wu-design-v1';
export function loadSaved(): { surfaces?: Record<string, FinishState>; light?: LightState } {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}'); } catch { return {}; }
}
function save(m: SceneManager) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ surfaces: m.editor.states, light: m.lighting.state })); } catch { /* storage unavailable */ }
}

const short = (s: string) => s.split(/[（(,]/)[0].trim();
const hh = (t: number) => `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.round((t % 1) * 60)).padStart(2, '0')}`;

export function StudioPanel(p: Props) {
  const { manager: m, data } = p;
  const { lang, pick } = useLang();
  const zh = lang === 'zh';
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [open, setOpen] = useState<Record<string, boolean>>({ materials: true, lighting: false, view: false, modes: false, spaces: false, layers: false, inspector: false, export: false });
  const [scope, setScope] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>('walls');
  const [busy, setBusy] = useState<string | null>(null);
  const mats = data.materials.materials;
  const rooms = data.rooms.rooms;
  const roomById = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);
  const interior = rooms.filter(r => r.kind === 'interior');

  useEffect(() => {
    const a = m.editor.onChange(() => { save(m); bump(); });
    const b = m.tools.onChange(bump);
    return () => { a(); b(); };
  }, [m]);
  // a picked object opens the inspector
  useEffect(() => { if (p.selected) setOpen(o => ({ ...o, inspector: true })); }, [p.selected]);
  useEffect(() => { if (p.focus) setOpen(o => ({ ...o, [p.focus!]: true })); }, [p.focus]);

  const toggle = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }));
  const L = m.lighting.state;
  const setLight = (patch: Partial<LightState>) => { m.lighting.state = { ...m.lighting.state, ...patch }; save(m); bump(); };
  const tools = m.tools;
  const view = (v: ViewMode) => { p.ensureExplore(); tools.setView(v); };
  const matName = (k: string) => (mats[k] ? short(zh ? mats[k].name_zh : mats[k].name_en) : k);
  const roomName = (r: Room) => (zh ? r.name_zh : r.name_en);
  const run = async (k: string, fn: () => Promise<void> | void) => { setBusy(k); try { await fn(); } finally { setBusy(null); } };

  const surfaces = m.editor.surfacesIn(scope);

  return (
    <aside className="studio" aria-label={pick('設計工作室', 'Design studio')}>
      <div className="st-head">
        <div>
          <div className="st-title">{pick('設計工作室', 'Design Studio')}</div>
          <div className="st-sub label">{pick('即時修改材質、燈光與視角', 'Live materials, lighting & views')}</div>
        </div>
        <button className="st-x" onClick={p.onClose} aria-label={pick('關閉', 'Close')}>✕</button>
      </div>
      <div className="st-units label" role="radiogroup" aria-label={pick('單位', 'Units')}>
        <span>{pick('單位', 'Units')}</span>
        {(['mm', 'm', 'ft'] as Unit[]).map(u => <button key={u} role="radio" aria-checked={tools.unit === u} onClick={() => tools.setUnit(u)}>{u}</button>)}
        <button className="st-report" onClick={p.onReport}>{pick('尺寸與驗證報告', 'Dimension report')}</button>
      </div>

      <div className="st-body">
        {/* 1 — materials */}
        <Section n={1} id="materials" title={pick('材質', 'Materials')} open={open.materials} onToggle={toggle}>
          <div className="st-row">
            <label className="st-field">
              <span className="label">{pick('套用範圍', 'Apply to')}</span>
              <select value={scope ?? ''} onChange={e => setScope(e.target.value || null)}>
                <option value="">{pick('全室', 'Whole home')}</option>
                {interior.map(r => <option key={r.id} value={r.id}>{roomName(r)}</option>)}
              </select>
            </label>
            {scope && <button className="st-btn" onClick={() => p.onFlyRoom(scope)}>{pick('前往', 'Go')}</button>}
          </div>
          <div className="st-label label">{pick('風格主題', 'Themes')}</div>
          <div className="st-chips">
            {THEMES.map(t => (
              <button key={t.key} className="chip" onClick={() => m.editor.setAll(t.states)}>{zh ? t.zh : t.en}</button>
            ))}
          </div>
          <p className="st-note">{pick('主題名稱取自簡報第 7 頁；簡報沒有色號，色彩為本網站的詮釋。', 'Theme names come from the deck (p.7); it gives no colour values, so these are this site’s interpretation.')}</p>
          <ul className="st-surfaces">
            {surfaces.map(s => (
              <SurfaceRow key={s.key} s={s} scope={scope} editor={m.editor} mats={mats} open={edit === s.key}
                onOpen={() => setEdit(edit === s.key ? null : s.key)} zh={zh} matName={matName} />
            ))}
          </ul>
          <div className="st-row">
            <button className="st-btn ghost" onClick={() => m.editor.setAll({})}>{pick('全部材質回到原設計', 'Reset all materials')}</button>
          </div>
        </Section>

        {/* 2 — lighting */}
        <Section n={2} id="lighting" title={pick('燈光與日照', 'Lighting & daylight')} open={open.lighting} onToggle={toggle}>
          <div className="st-label label">{pick('日照時間', 'Time of day')}
            <b className="num">{L.time === null ? pick('校正值', 'Calibrated') : hh(L.time)}</b></div>
          <input type="range" min={5} max={22} step={0.25} value={L.time ?? 14.5} onChange={e => setLight({ time: +e.target.value })} aria-label={pick('日照時間', 'Time of day')} />
          <div className="st-chips">
            {[[null, pick('校正值', 'Calibrated')], [8, pick('早晨', 'Morning')], [12, pick('中午', 'Noon')], [16.5, pick('傍晚', 'Afternoon')], [18.25, pick('黃昏', 'Dusk')], [20.5, pick('夜晚', 'Night')]].map(([v, l]) => (
              <button key={String(v)} className="chip" aria-pressed={L.time === v} onClick={() => setLight({ time: v as number | null })}>{l as string}</button>
            ))}
          </div>
          {m.lighting.sun && (
            <p className="st-note num">{pick('太陽高度', 'Sun elevation')} {m.lighting.sun.elevation.toFixed(0)}° · {pick('方位', 'azimuth')} {m.lighting.sun.azimuth.toFixed(0)}° · {pick('北緯 25°、今日日期；圖面無指北，以圖面上方為北', 'lat 25° N, today’s date; the plan has no north arrow, page-up is taken as north')}</p>
          )}
          <Slider label={pick('環境漫射光', 'Ambient light')} value={L.ambient} min={0} max={1.6} onChange={v => setLight({ ambient: v })} />
          <div className="st-row between">
            <span className="label">{pick('室內燈光', 'Interior lights')}</span>
            <Switch on={L.on} onChange={v => setLight({ on: v })} label={pick('室內燈光', 'Interior lights')} />
          </div>
          <Slider label={pick('亮度', 'Brightness')} value={L.dim} min={0} max={1.5} onChange={v => setLight({ dim: v })} disabled={!L.on} />
          <div className="st-label label">{pick('色溫', 'Colour temperature')}</div>
          <div className="st-chips">
            {[null, 2700, 3000, 3500, 4000].map(c => (
              <button key={String(c)} className="chip" aria-pressed={L.cct === c} onClick={() => setLight({ cct: c })}>
                {c === null ? pick('原設計', 'As designed') : `${c}K`}
              </button>
            ))}
          </div>
          <div className="st-label label">{pick('各空間開關', 'Room switches')}</div>
          <ul className="st-switches">
            {m.lighting.lightRooms.map(id => {
              const r = roomById.get(id); if (!r) return null;
              const on = L.rooms[id] !== false;
              return (
                <li key={id}>
                  <button className="st-link" onClick={() => p.onFlyRoom(id)}>{roomName(r)}</button>
                  <Switch on={on} disabled={!L.on} onChange={v => setLight({ rooms: { ...L.rooms, [id]: v } })} label={roomName(r)} />
                </li>
              );
            })}
          </ul>
          <div className="st-row">
            <button className="st-btn ghost" onClick={() => setLight({ rooms: {} })}>{pick('全部開燈', 'All on')}</button>
            <button className="st-btn ghost" onClick={() => setLight({ rooms: Object.fromEntries(m.lighting.lightRooms.map(r => [r, false])) })}>{pick('全部關燈', 'All off')}</button>
            <button className="st-btn ghost" onClick={() => setLight({ ...DEFAULT_LIGHTS, rooms: {} })}>{pick('燈光回到原設定', 'Reset lighting')}</button>
          </div>
          <p className="st-note">{pick('白天從空中俯瞰時天花板會升起，室內燈光效果不明顯；進入房間或切到夜晚可看清楚。', 'By day, in the cut-away aerial views, interior lights barely read; go into a room or switch to night to see them.')}</p>
        </Section>

        {/* 3 — view */}
        <Section n={3} id="view" title={pick('視角與投影', 'Camera & projection')} open={open.view} onToggle={toggle}>
          <div className="st-grid">
            <button className="st-btn" onClick={() => { p.ensureExplore(); p.onResetView(); }}>{pick('重置視角', 'Reset')}</button>
            <button className="st-btn" aria-pressed={tools.view === 'persp'} onClick={() => view('persp')}>{pick('透視', 'Perspective')}</button>
            <button className="st-btn" aria-pressed={tools.view === 'top'} onClick={() => view('top')}>{pick('俯視（正交）', 'Top (ortho)')}</button>
            <button className="st-btn" aria-pressed={tools.view === 'front'} onClick={() => view('front')}>{pick('正視（南）', 'Front (south)')}</button>
            <button className="st-btn" aria-pressed={tools.view === 'side'} onClick={() => view('side')}>{pick('側視（東）', 'Side (east)')}</button>
            <button className="st-btn" onClick={() => { p.ensureExplore(); tools.rotate(20); }}>⟲ {pick('左旋', 'Left')}</button>
            <button className="st-btn" onClick={() => { p.ensureExplore(); tools.rotate(-20); }}>⟳ {pick('右旋', 'Right')}</button>
            <button className="st-btn" onClick={() => { p.ensureExplore(); tools.zoom(0.75); }}>＋ {pick('放大', 'Zoom in')}</button>
            <button className="st-btn" onClick={() => { p.ensureExplore(); tools.zoom(1.33); }}>－ {pick('縮小', 'Zoom out')}</button>
          </div>
          <div className="st-label label">{pick('快速場景', 'Scenes')}</div>
          <div className="st-grid">
            {[pick('1 鳥瞰', '1 Aerial'), pick('2 剖切', '2 Section'), pick('3 客餐廳', '3 Living & dining'), pick('4 主臥區', '4 Master suite')].map((l, i) => (
              <button key={l} className="st-btn" onClick={() => p.onScene(i + 1)}>{l}</button>
            ))}
          </div>
        </Section>

        {/* 4 — modes */}
        <Section n={4} id="modes" title={pick('檢視模式', 'Inspection modes')} open={open.modes} onToggle={toggle}>
          <div className="st-row between">
            <span>{pick('第一人稱漫遊（視高 1650 mm）', 'First-person walk (eye 1650 mm)')}</span>
            <Switch on={tools.view === 'walk'} onChange={v => { p.ensureExplore(); if (v) tools.setView('walk'); else tools.exitWalk(); }} label="walk" />
          </div>
          <div className="st-row between"><span>{pick('平面圖疊加（A-D-11）', 'Plan overlay (A-D-11)')}</span><Switch on={tools.overlay} onChange={v => { p.ensureExplore(); void tools.setOverlay(v); }} label="overlay" /></div>
          <div className="st-row between"><span>{pick('剖切（高度 900 mm）', 'Section cut at 900 mm')}</span><Switch on={tools.section} onChange={v => { p.ensureExplore(); tools.setSection(v); }} label="section" /></div>
          <div className="st-row between"><span>{pick('尺寸標註', 'Dimensions')}</span><Switch on={tools.dims} onChange={v => { p.ensureExplore(); tools.setDims(v); }} label="dims" /></div>
          <Slider label={pick('垂直分解', 'Exploded view')} value={tools.explode} min={0} max={1} onChange={v => { p.ensureExplore(); tools.setExplode(v); }}
            hint={pick('0% 原始組裝 → 100% 樓板／牆／櫃／家具分離', '0 % assembled → 100 % floor / walls / joinery / furniture apart')} />
        </Section>

        {/* 5 — spaces */}
        <Section n={5} id="spaces" title={pick(`依空間切換（${rooms.length} 區）`, `Go to a space (${rooms.length})`)} open={open.spaces} onToggle={toggle}>
          <div className="st-grid two">
            {rooms.map(r => (
              <button key={r.id} className="st-btn left" onClick={() => p.onFlyRoom(r.id)}>
                <span>{roomName(r)}</span><small className="num">{r.area_m2.toFixed(1)} m²</small>
              </button>
            ))}
          </div>
          <p className="st-note">{pick('漫遊模式中，點選空間會直接走進該空間。', 'In walk mode, picking a space walks you into it.')}</p>
        </Section>

        {/* 6 — layers */}
        <Section n={6} id="layers" title={pick('圖層與類別', 'Layers')} open={open.layers} onToggle={toggle}>
          <ul className="st-switches">
            {LAYERS.map(l => (
              <li key={l.key}><span>{zh ? l.zh : l.en}</span><Switch on={!tools.hidden.has(l.key)} onChange={v => tools.setLayer(l.key, v)} label={l.en} /></li>
            ))}
          </ul>
        </Section>

        {/* 7 — inspector */}
        <Section n={7} id="inspector" title={pick('選取物件', 'Selected object')} open={open.inspector} onToggle={toggle}>
          {p.selected ? <Inspector id={p.selected} m={m} data={data} zh={zh} matName={matName} unit={tools.unit} onClear={() => p.onSelect(null)} roomName={id => { const r = roomById.get(id); return r ? roomName(r) : id; }} />
            : <p className="st-note">{pick('在 3D 畫面點選任意牆、門窗、櫃體或家具，即可查看尺寸並單獨更換材質。', 'Click any wall, door, cabinet or piece of furniture in the 3D view to see its size and change its finish on its own.')}</p>}
        </Section>

        {/* 8 — export */}
        <Section n={8} id="export" title={pick('匯出', 'Export')} open={open.export} onToggle={toggle}>
          <div className="st-grid two">
            <button className="st-btn" disabled={!!busy} onClick={() => run('glb', () => exportGLB(m))}>{busy === 'glb' ? '…' : pick('glTF 模型 (.glb)', 'glTF (.glb)')}</button>
            <button className="st-btn" disabled={!!busy} onClick={() => run('obj', () => exportOBJ(m))}>{busy === 'obj' ? '…' : 'OBJ (.obj)'}</button>
            <button className="st-btn" onClick={() => run('json', exportSceneJson)}>scene.json</button>
            <button className="st-btn" onClick={() => exportPNG(m)}>{pick('目前畫面 PNG', 'View as PNG')}</button>
            <button className="st-btn wide" onClick={() => exportDesign(designSummary(m, mats, rooms))}>{pick('匯出設計選項（JSON）', 'Design options (JSON)')}</button>
          </div>
          <p className="st-note">{pick('glTF 會帶上目前的材質與可見圖層；OBJ 只含幾何。尺寸、ID 與座標不變。', 'glTF carries the current finishes and visible layers; OBJ is geometry only. Sizes, IDs and coordinates are unchanged.')}</p>
        </Section>
      </div>
    </aside>
  );
}

function Section({ n, id, title, open, onToggle, children }: { n: number; id: string; title: string; open: boolean; onToggle: (k: string) => void; children: ReactNode }) {
  return (
    <section className={`st-sec${open ? ' is-open' : ''}`}>
      <button className="st-sec-h" aria-expanded={open} onClick={() => onToggle(id)}>
        <span className="num">{String(n).padStart(2, '0')}</span><span>{title}</span><i aria-hidden="true" />
      </button>
      {open && <div className="st-sec-b">{children}</div>}
    </section>
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button className="switch" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}><i /></button>;
}

function Slider({ label, value, min, max, onChange, disabled, hint }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean; hint?: string }) {
  return (
    <label className={`st-slider${disabled ? ' is-off' : ''}`}>
      <span className="label">{label}<b className="num">{Math.round(value * 100)}%</b></span>
      <input type="range" min={min} max={max} step={0.01} value={value} disabled={disabled} onChange={e => onChange(+e.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function FinishTile({ k, mat, on, label, onClick }: { k: string; mat?: Material; on: boolean; label: string; onClick: () => void }) {
  const tex = mat?.textures?.baseColor;
  const style = tex ? { backgroundImage: `url(./${tex})`, backgroundColor: mat?.pbr.baseColor_srgb ?? '#999' } : { background: mat?.pbr.baseColor_srgb ?? '#999' };
  return (
    <button className="tile" aria-pressed={on} onClick={onClick} title={label} data-k={k}>
      <span className="sw" style={style} /><span className="tl">{label}</span>
    </button>
  );
}

function Swatches({ list, value, onPick, zh }: { list: Swatch[]; value: string | null; onPick: (hex: string | undefined) => void; zh: boolean }) {
  return (
    <div className="st-swatches">
      {list.map(c => (
        <button key={c.hex} className="dot" aria-pressed={value?.toLowerCase() === c.hex} style={{ background: c.hex }} title={(zh ? c.zh : c.en) + (c.note ? ` — ${c.note}` : '')} onClick={() => onPick(c.hex)} />
      ))}
      <label className="dot custom" title={zh ? '自訂顏色' : 'Custom colour'}>
        <input type="color" value={value ?? '#ffffff'} onChange={e => onPick(e.target.value)} />
        <span>＋</span>
      </label>
      {value && <button className="st-link" onClick={() => onPick(undefined)}>{zh ? '清除顏色' : 'Clear colour'}</button>}
    </div>
  );
}

function SurfaceRow({ s, scope, editor, mats, open, onOpen, zh, matName }: {
  s: SurfaceDef; scope: string | null; editor: DesignEditor; mats: Record<string, Material>; open: boolean; onOpen: () => void; zh: boolean; matName: (k: string) => string;
}) {
  const room = s.perRoom ? scope : null;
  const cur = editor.current(s, room);
  const st = editor.stateFor(s.key, room);
  const key = DesignEditor.stateKey(s.key, room);
  const thumb = mats[cur.finish]?.textures?.baseColor;
  return (
    <li className={`surf${open ? ' is-open' : ''}`}>
      <button className="surf-h" onClick={onOpen} aria-expanded={open}>
        <span className="sw" style={thumb ? { backgroundImage: `url(./${thumb})`, backgroundColor: cur.color ?? undefined } : { background: cur.color ?? mats[cur.finish]?.pbr.baseColor_srgb ?? '#999' }}>
          {thumb && cur.color && <i style={{ background: cur.color }} />}
        </span>
        <span className="surf-n">{zh ? s.zh : s.en}<small>{cur.mixed && !st.finish ? (zh ? '依空間不同' : 'varies by room') : matName(cur.finish)}{cur.color ? ' · ' + cur.color : ''}</small></span>
        {Object.keys(st).length > 0 && <span className="badge label">{zh ? '已修改' : 'edited'}</span>}
      </button>
      {open && (
        <div className="surf-b">
          {scope && !s.perRoom && <p className="st-note">{zh ? '牆面與門片為相鄰房間共用，這裡的設定會套用到全室。' : 'Shared between rooms, so this applies to the whole home.'}</p>}
          <div className="st-label label">{zh ? '材質' : 'Finish'}</div>
          <div className="tiles">
            {s.finishes.filter(f => mats[f]).map(f => (
              <FinishTile key={f} k={f} mat={mats[f]} on={(st.finish ?? (cur.mixed ? '' : cur.finish)) === f} label={matName(f)} onClick={() => editor.set(key, { finish: f })} />
            ))}
          </div>
          <div className="st-label label">{zh ? '顏色' : 'Colour'}</div>
          <Swatches list={s.colors} value={st.color ?? null} zh={zh} onPick={hex => editor.set(key, { color: hex })} />
          <div className="st-row">
            <button className="st-btn ghost" onClick={() => (room ? editor.set(key, null) : editor.resetSurface(s.key))}>{zh ? '回到原設計' : 'Reset'}</button>
          </div>
        </div>
      )}
    </li>
  );
}

function Inspector({ id, m, data, zh, matName, unit, onClear, roomName }: {
  id: string; m: SceneManager; data: ProjectData; zh: boolean; matName: (k: string) => string; unit: Unit; onClear: () => void; roomName: (id: string) => string;
}) {
  const o = data.scene.objects.find(x => x.id === id) as (ProjectData['scene']['objects'][number] & { bbox_mm?: { min: number[]; max: number[] }; source?: string; info?: { note?: string } }) | undefined;
  const keys = m.editor.objectMaterials(id);
  const [mk, setMk] = useState<string | null>(null);
  if (!o) return null;
  const b = o.bbox_mm;
  const c = b ? [0, 1, 2].map(i => (b.min[i] + b.max[i]) / 2) : null;
  const src: Record<string, string> = { drawn: zh ? '圖面標註／量測' : 'drawn on A-D-11', derived: zh ? '由圖面推導' : 'derived from the drawing', assumed: zh ? '推估（圖面未標註）' : 'assumed (not dimensioned)' };
  const sel = mk ?? keys[0] ?? null;
  const st = sel ? m.editor.states[DesignEditor.objectKey(id, sel)] ?? {} : {};
  return (
    <div className="insp">
      <div className="insp-h"><b>{o.name}</b><button className="st-link" onClick={onClear}>{zh ? '取消選取' : 'Clear'}</button></div>
      <dl>
        <dt>ID</dt><dd className="num">{o.id}</dd>
        <dt>{zh ? '類別' : 'Category'}</dt><dd>{o.category} · {o.layer === 'design' ? (zh ? '設計層' : 'design layer') : (zh ? '依圖面' : 'as drawn')}</dd>
        <dt>{zh ? '所屬空間' : 'Room'}</dt><dd>{o.room ? roomName(o.room) : '—'}</dd>
        <dt>{zh ? '尺寸 W×D×H' : 'Size W×D×H'}</dt><dd className="num">{fmtLen(o.size_mm[0], unit)} × {fmtLen(o.size_mm[2], unit)} × {fmtLen(o.size_mm[1], unit)}</dd>
        {c && <><dt>{zh ? '中心座標 X, Y, Z' : 'Centre X, Y, Z'}</dt><dd className="num">{c.map(v => fmtLen(v, unit)).join(', ')}</dd></>}
        <dt>{zh ? '材質' : 'Materials'}</dt><dd>{o.materials.map(matName).join(' / ')}</dd>
        {o.source && <><dt>{zh ? '來源依據' : 'Source'}</dt><dd>{src[o.source] ?? o.source}</dd></>}
        {o.info?.note && <><dt>{zh ? '備註' : 'Note'}</dt><dd>{o.info.note}</dd></>}
      </dl>
      <p className="st-note">{zh ? '座標為平面毫米：X 向東、Z 向南（圖面向下）、Y 為高度。' : 'Plan coordinates in mm: X east, Z south (down the drawing), Y height.'}</p>
      {keys.length > 0 && sel && (
        <>
          <div className="st-label label">{zh ? '更換這個物件的材質' : 'Change this object’s finish'}</div>
          {keys.length > 1 && (
            <div className="st-chips">{keys.map(k => <button key={k} className="chip" aria-pressed={k === sel} onClick={() => setMk(k)}>{matName(k)}</button>)}</div>
          )}
          <div className="tiles">
            {ANY_FINISH.filter(f => data.materials.materials[f]).map(f => (
              <FinishTile key={f} k={f} mat={data.materials.materials[f]} on={(st.finish ?? sel) === f} label={matName(f)} onClick={() => m.editor.set(DesignEditor.objectKey(id, sel), { finish: f })} />
            ))}
          </div>
          <Swatches list={[...SWATCHES.PAINTS.slice(0, 6), ...SWATCHES.TINTS.slice(2, 6)]} value={st.color ?? null} zh={zh} onPick={hex => m.editor.set(DesignEditor.objectKey(id, sel), { color: hex })} />
          <div className="st-row"><button className="st-btn ghost" onClick={() => keys.forEach(k => m.editor.set(DesignEditor.objectKey(id, k), null))}>{zh ? '此物件回到原設計' : 'Reset this object'}</button></div>
        </>
      )}
    </div>
  );
}

/** a readable record of every change, for the designer */
function designSummary(m: SceneManager, mats: Record<string, Material>, rooms: Room[]) {
  const rn = new Map(rooms.map(r => [r.id, `${r.name_zh} ${r.name_en}`]));
  const changes = Object.entries(m.editor.states).map(([k, v]) => {
    const [surf, scope] = k.startsWith('obj:') ? [k, '*'] : k.split('@');
    const def = SURFACES.find(s => s.key === surf);
    return {
      key: k,
      surface: def ? `${def.zh} ${def.en}` : surf,
      scope: scope === '*' ? 'whole home 全室' : rn.get(scope) ?? scope,
      finish: v.finish ? { key: v.finish, name_zh: mats[v.finish]?.name_zh, name_en: mats[v.finish]?.name_en } : 'as designed',
      colour: v.color ?? null,
    };
  });
  return {
    project: 'ACL16004 新店吳公館', drawing: 'A-D-11_01', exported: new Date().toISOString(),
    note: 'Design options chosen in the website studio. Geometry, IDs and dimensions are unchanged from Phase 1; only finishes and lighting differ.',
    materials: changes,
    lighting: m.lighting.state,
  };
}
