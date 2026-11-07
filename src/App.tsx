import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SceneManager } from './three/SceneManager';
import { ScrollController } from './animation/ScrollController';
import { loadProjectData, type ProjectData } from './data/types';
import { ROOM_STORIES, MATERIAL_STORIES } from './data/roomData';
import { ROOM_STORIES_ZH } from './data/roomData.zh';
import { LoadingScreen } from './components/LoadingScreen';
import { Header } from './components/Header';
import { RoomNavigation, type NavItem } from './components/RoomNavigation';
import { RoomInformation } from './components/RoomInformation';
import { HeroOverlay, Finale, IndexMenu, ExploreToolbar } from './components/Overlays';
import { StudioPanel, loadSaved } from './components/StudioPanel';
import { DimLabels, WalkPad, ReportModal } from './components/StudioOverlays';
import { DEFAULT_LIGHTS } from './three/Lighting';
import { Vector3 } from 'three';
import { useLang } from './i18n';

const OVERVIEW = { pos: [19500, 17500, 21500] as [number, number, number], target: [7260, 200, 6136] as [number, number, number], fov: 32 };
const PLAN = { pos: [7260, 23000, 6200] as [number, number, number], target: [7260, 0, 6136] as [number, number, number], fov: 36 };

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<ScrollController | null>(null);
  const exploreFrom = useRef<{ p: import('three').Vector3; t: import('three').Vector3; f: number } | null>(null);
  const [data, setData] = useState<ProjectData | null>(null);
  const [load, setLoad] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mgr, setMgr] = useState<SceneManager | null>(null);
  const [active, setActive] = useState(0);
  const [explore, setExplore] = useState(false);
  const [menu, setMenu] = useState(false);
  const [fs, setFs] = useState(false);
  const [pick, setPick] = useState<Record<string, unknown> | null>(null);
  const [studio, setStudio] = useState(false);
  const [report, setReport] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [, setToolsTick] = useState(0);
  const { lang } = useLang();
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const mobile = useMemo(() => matchMedia('(max-width: 820px)').matches, []);

  // ── boot: data → model → path → scroll ────────────────────────────────
  useEffect(() => {
    let m: SceneManager | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!hasWebGL()) throw new Error('此瀏覽器未開啟或不支援 WebGL，無法顯示即時 3D 模型。 / This browser has WebGL turned off or unavailable, so the live 3D model cannot be shown.');
        const d = await loadProjectData();
        if (cancelled) return;
        setData(d); setLoad(0.05);
        m = new SceneManager(canvasRef.current!);
        await m.load(d.scene.coordinate_system.origin_plan_mm, f => setLoad(0.05 + 0.9 * f), reduced);
        if (cancelled) { m.dispose(); return; }
        m.initStudio(d);
        // design choices made earlier in this browser
        const saved = loadSaved();
        if (saved.surfaces) m.editor.setAll(saved.surfaces);
        if (saved.light) m.lighting.state = { ...DEFAULT_LIGHTS, ...saved.light, rooms: { ...(saved.light.rooms ?? {}) } };
        setLoad(1);
        m.start();
        const sc = new ScrollController(spacerRef.current!, p => { m!.progress = p; }, reduced);
        scrollRef.current = sc;
        m.progress = sc.state.progress;
        setMgr(m);
        (window as unknown as { __wu: unknown }).__wu = { manager: m, scroll: sc }; // read-only hook for automated tests
        setTimeout(() => setReady(true), 350);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; scrollRef.current?.dispose(); m?.dispose(); };
  }, [reduced]);

  const path = mgr?.path ?? null;
  const chapters = path?.chapters ?? [];

  // navigation items built from the path chapters + rooms.json
  const navItems: NavItem[] = useMemo(() => {
    if (!path || !data) return [];
    const items: NavItem[] = [{ key: 'hero', label: 'Overview', zh: '總覽', progress: 0, number: '' }];
    ROOM_STORIES.forEach((s, i) => {
      const c = path.chapters.find(c => c.chapter === s.room);
      if (c) items.push({ key: s.room, label: s.title, zh: ROOM_STORIES_ZH[s.room]?.title ?? data.rooms.rooms.find(r => r.id === s.room)?.name_zh, progress: c.peak, number: String(i + 1).padStart(2, '0') });
    });
    const firstMat = path.chapters.find(c => c.chapter === MATERIAL_STORIES[0].key);
    if (firstMat) items.push({ key: 'materials', label: 'Materials', zh: '材質', progress: firstMat.peak, number: '' });
    const fin = path.chapters.find(c => c.chapter === 'finale');
    if (fin) items.push({ key: 'finale', label: 'Final view', zh: '全景', progress: 1, number: '' });
    return items;
  }, [path, data]);

  const navIndexFor = useCallback((chapter: string) => {
    if (MATERIAL_STORIES.some(m => m.key === chapter) || chapter === 'materials') return navItems.findIndex(n => n.key === 'materials');
    const i = navItems.findIndex(n => n.key === chapter);
    return i;
  }, [navItems]);

  // current chapter → nav highlight (state only changes when the chapter changes)
  useEffect(() => {
    if (!mgr || !path) return;
    let last = -1;
    return mgr.onFrame(f => {
      const c = path.chapters[path.chapterAt(f.progress)];
      let idx = navIndexFor(c.chapter);
      if (idx < 0) {
        // transition chapters belong to the next room
        const next = path.chapters.slice(path.chapterAt(f.progress)).find(x => navIndexFor(x.chapter) >= 0);
        idx = next ? navIndexFor(next.chapter) : 0;
      }
      if (idx !== last) { last = idx; setActive(idx); }
    }) as () => void;
  }, [mgr, path, navIndexFor]);

  const go = useCallback((p: number) => scrollRef.current?.scrollTo(p, !reduced), [reduced]);

  const chapterOf = useCallback((roomId: string) => {
    if (!path) return null;
    const s = ROOM_STORIES.find(s => s.room === roomId || s.includes?.includes(roomId));
    if (!s) return null;
    return path.chapters.find(c => c.chapter === s.room)?.peak ?? null;
  }, [path]);

  // ── explore mode ──────────────────────────────────────────────────────
  const enterExplore = useCallback(() => {
    if (!mgr || !scrollRef.current) return;
    scrollRef.current.lock();
    exploreFrom.current = { p: mgr.cam.camera.position.clone(), t: mgr.cam.look.clone(), f: mgr.cam.camera.fov };
    mgr.cam.enterExplore();
    (mgr.cam.controls.domElement as HTMLElement).style.touchAction = 'none';
    setMenu(false); setExplore(true);
  }, [mgr]);
  const exitExplore = useCallback(() => {
    if (!mgr || !scrollRef.current) return;
    mgr.tools.resetTools();
    setExplore(false); setPick(null);
    (mgr.cam.controls.domElement as HTMLElement).style.touchAction = 'pan-y';
    mgr.cam.exitExplore(mgr.progress, () => scrollRef.current?.unlock());
  }, [mgr]);
  const toggleExplore = useCallback(() => (explore ? exitExplore() : enterExplore()), [explore, enterExplore, exitExplore]);
  const ensureExplore = useCallback(() => { if (!explore) enterExplore(); }, [explore, enterExplore]);

  // studio tools state → re-render (walk pad, labels)
  useEffect(() => { if (mgr) return mgr.tools.onChange(() => setToolsTick(t => t + 1)); }, [mgr]);
  useEffect(() => { mgr?.tools.setLang(lang); }, [mgr, lang]);
  useEffect(() => {
    document.documentElement.classList.toggle('studio-open', studio);
    // keep the picture centred in the part of the screen the studio panel leaves free (desktop only)
    mgr?.setInset(studio && !matchMedia('(max-width: 820px)').matches ? 392 : 0);
  }, [studio, mgr]);

  const resetView = useCallback(() => {
    if (!mgr) return;
    if (mgr.tools.view === 'walk') mgr.tools.exitWalk();
    if (mgr.tools.view !== 'persp') mgr.tools.setView('persp');
    const f = exploreFrom.current; if (f) mgr.cam.flyTo(f.p, f.t, f.f);
  }, [mgr]);
  const flyPlan = useCallback((v: typeof OVERVIEW) => {
    if (!mgr) return;
    if (mgr.tools.view === 'walk') mgr.tools.exitWalk();
    if (mgr.tools.view !== 'persp') mgr.tools.setView('persp');
    mgr.cam.flyToPlan(v.pos, v.target, v.fov);
  }, [mgr]);

  /** go to a space: in the tour, scroll to its chapter; otherwise fly (or walk) there */
  const flyRoom = useCallback((id: string) => {
    if (!mgr || !data) return;
    const tools = mgr.tools;
    if (!explore) {
      const c = chapterOf(id);
      if (c !== null) { go(c); return; }
      enterExplore();
    }
    const rc = (data.cameras as { room_cameras: Record<string, { position_m: number[]; target_m: number[]; fov: number }> }).room_cameras[id];
    if (tools.view === 'walk') { if (rc) tools.walkRoom(id); return; }
    if (tools.view !== 'persp') tools.setView('persp');
    if (rc) { mgr.cam.flyTo(new Vector3(...rc.position_m), new Vector3(...rc.target_m), rc.fov); return; }
    const r = data.rooms.rooms.find(x => x.id === id);
    if (!r) return;
    const cx = r.polygon_m.reduce((a, q) => a + q[0], 0) / r.polygon_m.length, cz = r.polygon_m.reduce((a, q) => a + q[1], 0) / r.polygon_m.length;
    mgr.cam.flyTo(new Vector3(cx + 1.5, 6.5, cz + 4.5), new Vector3(cx, 0, cz), 40);
  }, [mgr, data, explore, enterExplore]);

  const scenePreset = useCallback((n: number) => {
    if (!mgr) return;
    ensureExplore();
    const tools = mgr.tools;
    if (tools.view === 'walk') tools.exitWalk();
    if (tools.view !== 'persp') tools.setView('persp');
    tools.setSection(n === 2);
    if (n <= 2) { mgr.cam.flyToPlan(OVERVIEW.pos, OVERVIEW.target, OVERVIEW.fov); return; }
    const rc = (data!.cameras as { room_cameras: Record<string, { position_m: number[]; target_m: number[]; fov: number }> }).room_cameras[n === 3 ? 'R05_LIVING' : 'R14_MASTER'];
    mgr.cam.flyTo(new Vector3(...rc.position_m), new Vector3(...rc.target_m), rc.fov);
  }, [mgr, data, ensureExplore]);

  const select = useCallback((id: string | null, rec?: Record<string, unknown> | null) => {
    mgr?.tools.select(id);
    setPick(id ? rec ?? { id } : null);
  }, [mgr]);

  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);
  useEffect(() => {
    const f = () => { setFs(!!document.fullscreenElement); setTimeout(() => scrollRef.current?.refresh(), 200); };
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  // keyboard: E explore, F fullscreen, Esc
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const walking = mgr?.tools.view === 'walk';
      if ((e.key === 'e' || e.key === 'E') && !walking) toggleExplore();
      if (e.key === 'f' || e.key === 'F') fullscreen();
      if (e.key === 'Escape') { if (walking) mgr!.tools.exitWalk(); else if (report) setReport(false); else if (explore) exitExplore(); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [toggleExplore, fullscreen, explore, exitExplore, mgr, report]);

  // touch: let the page scroll in tour mode (OrbitControls would otherwise claim the gesture)
  useEffect(() => { if (mgr) (mgr.cam.controls.domElement as HTMLElement).style.touchAction = 'pan-y'; }, [mgr]);

  // click-to-identify (explore, or whenever the studio is open)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !mgr || !(explore || studio)) return;
    let down: [number, number] | null = null;
    const pd = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
    const pu = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      if (mgr.tools.view === 'walk') return;
      const hit = mgr.pick(e.clientX, e.clientY);
      select(hit ? String(hit.id) : null, hit);
    };
    c.addEventListener('pointerdown', pd); c.addEventListener('pointerup', pu);
    return () => { c.removeEventListener('pointerdown', pd); c.removeEventListener('pointerup', pu); };
  }, [mgr, explore, studio, select]);

  const stories = ROOM_STORIES;
  const activeKey = navItems[active]?.key;
  const roomIdx = stories.findIndex(s => s.room === activeKey);
  const activeRoomNumber = roomIdx >= 0 ? roomIdx + 1 : activeKey === 'materials' || activeKey === 'finale' ? stories.length : 1;
  const finaleWin = chapters.find(c => c.chapter === 'finale');

  return (
    <>
      <div className={`stage${explore ? ' is-explore' : ''}`} aria-label="Live 3D model of the Wu Residence">
        <canvas ref={canvasRef} />
      </div>
      <div className="vignette" aria-hidden="true" />
      <div ref={spacerRef} className="scroll-spacer" style={{ ['--film-length' as string]: mobile ? '2300vh' : '2700vh' }} aria-hidden="true" />

      {data && <LoadingScreen progress={load} rooms={data.rooms.rooms} done={ready} error={error} />}
      {!data && <LoadingScreen progress={load} rooms={[]} done={false} error={error} />}

      {ready && data && mgr && (
        <>
          <Header explore={explore} onExplore={toggleExplore} onMenu={() => setMenu(v => !v)} menuOpen={menu} onFullscreen={fullscreen} isFullscreen={fs}
            studio={studio} onStudio={() => setStudio(v => !v)} />
          <HeroOverlay manager={mgr} roomCount={stories.length} />
          <RoomInformation manager={mgr} chapters={chapters} stories={stories} materialStories={MATERIAL_STORIES}
            rooms={data.rooms.rooms} materials={data.materials.materials} objects={data.scene.objects} reduced={reduced} />
          <RoomNavigation items={navItems} active={active} roomCount={stories.length} activeRoomNumber={activeRoomNumber} onGo={go} manager={mgr} hidden={explore || (studio && mobile)} />
          <Finale manager={mgr} window={finaleWin} rooms={data.rooms} scene={data.scene} onExplore={enterExplore} onRestart={() => go(0)} onStudio={() => setStudio(true)} />
          {explore && mgr.tools.view !== 'walk' && (
            <ExploreToolbar
              onReset={resetView}
              onOverview={() => flyPlan(OVERVIEW)}
              onPlan={() => flyPlan(PLAN)}
              onExit={exitExplore} onFullscreen={fullscreen} pick={pick} onClearPick={() => select(null)}
              onEdit={() => { setStudio(true); setFocus('inspector'); }} studio={studio} />
          )}
          <DimLabels manager={mgr} />
          {mgr.tools.view === 'walk' && <WalkPad manager={mgr} onExit={() => mgr.tools.exitWalk()} />}
          {studio && (
            <StudioPanel manager={mgr} data={data} onClose={() => setStudio(false)} ensureExplore={ensureExplore}
              selected={pick ? String(pick.id) : null} onSelect={id => select(id)} onReport={() => setReport(true)}
              onResetView={resetView} onFlyRoom={flyRoom} onScene={scenePreset} focus={focus} />
          )}
          {report && <ReportModal data={data} onClose={() => setReport(false)} />}
          {menu && <IndexMenu rooms={data.rooms.rooms} chapterOf={chapterOf} onGo={go} onClose={() => setMenu(false)} />}
        </>
      )}
    </>
  );
}
