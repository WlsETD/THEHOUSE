import { useEffect, useReducer, useRef } from 'react';
import { Vector3 } from 'three';
import type { SceneManager } from '../three/SceneManager';
import type { ProjectData } from '../data/types';
import { useLang } from '../i18n';

/** HTML labels pinned to 3D points (room names, areas and overall dimensions) */
export function DimLabels({ manager }: { manager: SceneManager }) {
  const box = useRef<HTMLDivElement>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => manager.tools.onChange(bump), [manager]);
  useEffect(() => {
    const v = new Vector3();
    return manager.onFrame(() => {
      const el = box.current; if (!el) return;
      const cam = manager.tools.activeCamera;
      const w = innerWidth, h = innerHeight;
      manager.tools.labels.forEach((l, i) => {
        const s = el.children[i] as HTMLElement | undefined; if (!s) return;
        v.copy(l.pos); v.y += l.kind === 'room' ? manager.tools.explode * 0 : 0;
        v.project(cam);
        const vis = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        s.style.visibility = vis ? 'visible' : 'hidden';
        if (vis) s.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
      });
    }) as () => void;
  }, [manager]);
  const labels = manager.tools.dims ? manager.tools.labels : [];
  return (
    <div className="dim-labels" ref={box} aria-hidden="true">
      {labels.map(l => <span key={l.key} className={`dl ${l.kind}`}><b>{l.text}</b>{l.sub && <small>{l.sub}</small>}</span>)}
    </div>
  );
}

/** on-screen controls for the first-person walk (touch screens have no WASD) */
export function WalkPad({ manager, onExit }: { manager: SceneManager; onExit: () => void }) {
  const { pick } = useLang();
  const hold = (f: number, s: number) => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); manager.tools.pad.f = f; manager.tools.pad.s = s; },
    onPointerUp: () => { manager.tools.pad.f = 0; manager.tools.pad.s = 0; },
    onPointerCancel: () => { manager.tools.pad.f = 0; manager.tools.pad.s = 0; },
  });
  return (
    <div className="walkpad" role="group" aria-label={pick('漫遊控制', 'Walk controls')}>
      <p className="label">{pick('WASD 或方向鍵移動 · 拖曳畫面轉頭', 'WASD or arrow keys to move · drag to look')}</p>
      <div className="wp-grid">
        <span />
        <button {...hold(1, 0)} aria-label={pick('前進', 'Forward')}>▲</button>
        <span />
        <button {...hold(0, -1)} aria-label={pick('左移', 'Left')}>◀</button>
        <button {...hold(-1, 0)} aria-label={pick('後退', 'Back')}>▼</button>
        <button {...hold(0, 1)} aria-label={pick('右移', 'Right')}>▶</button>
      </div>
      <button className="wp-exit label" onClick={onExit}>{pick('離開漫遊', 'Exit walk')}</button>
    </div>
  );
}

interface Validation {
  checks: { name: string; status: string; detail: string }[];
  stats: Record<string, number>;
  dimensions: { item: string; drawing_mm: number; model_mm: number; delta_mm: number; status: string }[];
}
interface Assumption { item: string; value_mm: number | string | null; status: string; note?: string }

/** Phase-1 dimension & validation report, read from validation.json and scene.json */
export function ReportModal({ data, onClose }: { data: ProjectData; onClose: () => void }) {
  const { pick } = useLang();
  const [v, set] = useReducer((_: Validation | null, n: Validation | null) => n, null);
  useEffect(() => { fetch('./data/validation.json').then(r => r.json()).then(set).catch(() => set(null)); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [onClose]);
  const sc = data.scene as unknown as { assumptions: Assumption[]; meta: { bbox_plan_mm: number[]; scale: string; drawing: string } };
  const ok = v?.dimensions.filter(d => Math.abs(d.delta_mm) <= 2).length ?? 0;
  const st = (s: string) => ({ assumed: pick('推估', 'assumed'), unknown: pick('未知', 'unknown'), to_confirm: pick('待確認', 'to confirm') }[s] ?? s);
  return (
    <div className="report" role="dialog" aria-modal="true" aria-label={pick('尺寸與驗證報告', 'Dimension & validation report')}>
      <div className="rp-card">
        <div className="rp-head">
          <div>
            <div className="label" style={{ color: 'var(--bone-faint)' }}>{sc.meta.drawing} · {sc.meta.scale} · scene.json / validation.json</div>
            <h2 className="display">{pick('平面圖解析、尺寸校正與不確定性報告', 'Plan analysis, dimension audit & uncertainty')}</h2>
          </div>
          <button className="st-x" onClick={onClose} aria-label={pick('關閉', 'Close')}>✕</button>
        </div>
        {!v ? <p>…</p> : (
          <div className="rp-body">
            <div className="rp-kpis">
              <div><span className="label">{pick('圖面比例', 'Scale')}</span><b>1:50 @ A3</b><small>1 pt = 17.6389 mm</small></div>
              <div><span className="label">{pick('標註尺寸核對', 'Dimensions checked')}</span><b className="num">{ok} / {v.dimensions.length}</b><small>{pick('誤差 ±2 mm 內', 'within ±2 mm')}</small></div>
              <div><span className="label">{pick('物件 / 三角面', 'Objects / triangles')}</span><b className="num">{v.stats.mesh_nodes} / {v.stats.triangles.toLocaleString()}</b><small>{v.stats.lights} {pick('燈光', 'lights')} · {v.stats.cameras} {pick('攝影機', 'cameras')}</small></div>
              <div><span className="label">{pick('總外框', 'Overall')}</span><b className="num">{sc.meta.bbox_plan_mm[2].toLocaleString()} × {sc.meta.bbox_plan_mm[3].toLocaleString()} mm</b></div>
            </div>
            <h3>{pick('一、圖面標註 vs 模型尺寸', '1. Drawing annotations vs model')}</h3>
            <div className="rp-table"><table>
              <thead><tr><th>{pick('項目', 'Item')}</th><th>{pick('圖面', 'Drawing')}</th><th>{pick('模型', 'Model')}</th><th>Δ</th><th>{pick('狀態', 'Status')}</th></tr></thead>
              <tbody>{v.dimensions.map((d, i) => (
                <tr key={i} className={Math.abs(d.delta_mm) > 2 ? 'warn' : ''}><td>{d.item}</td><td className="num">{d.drawing_mm}</td><td className="num">{Math.round(d.model_mm)}</td><td className="num">{d.delta_mm.toFixed(0)}</td><td>{d.status}</td></tr>
              ))}</tbody>
            </table></div>
            <h3>{pick('二、推估與待確認項目（圖面未標註）', '2. Assumed and to-confirm items (not dimensioned)')}</h3>
            <ul className="rp-list">{sc.assumptions.map(a => (
              <li key={a.item}><b>{a.item}</b> <span className={`tag ${a.status}`}>{st(a.status)}</span> {a.value_mm !== null && <span className="num">{a.value_mm} mm</span>}{a.note && <small> — {a.note}</small>}</li>
            ))}</ul>
            <h3>{pick('三、模型品質檢查', '3. Model checks')}</h3>
            <ul className="rp-list">{v.checks.map(c => <li key={c.name}><span className={`tag ${c.status === 'PASS' ? 'pass' : 'fail'}`}>{c.status}</span> <b>{c.name}</b><small> — {c.detail}</small></li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
