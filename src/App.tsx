import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SceneManager } from './three/SceneManager';
import { ScrollController } from './animation/ScrollController';
import { loadProjectData, type ProjectData } from './data/types';
import { ROOM_STORIES, MATERIAL_STORIES } from './data/roomData';
import { LoadingScreen } from './components/LoadingScreen';
import { Header } from './components/Header';
import { RoomNavigation, type NavItem } from './components/RoomNavigation';
import { RoomInformation } from './components/RoomInformation';
import { HeroOverlay, Finale, IndexMenu, ExploreToolbar } from './components/Overlays';

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
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const mobile = useMemo(() => matchMedia('(max-width: 820px)').matches, []);

  // ── boot: data → model → path → scroll ────────────────────────────────
  useEffect(() => {
    let m: SceneManager | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!hasWebGL()) throw new Error('This browser has WebGL turned off or unavailable, so the live 3D model cannot be shown.');
        const d = await loadProjectData();
        if (cancelled) return;
        setData(d); setLoad(0.05);
        m = new SceneManager(canvasRef.current!);
        await m.load(d.scene.coordinate_system.origin_plan_mm, f => setLoad(0.05 + 0.9 * f), reduced);
        if (cancelled) { m.dispose(); return; }
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
    const items: NavItem[] = [{ key: 'hero', label: 'Overview', progress: 0, number: '' }];
    ROOM_STORIES.forEach((s, i) => {
      const c = path.chapters.find(c => c.chapter === s.room);
      if (c) items.push({ key: s.room, label: s.title, progress: c.peak, number: String(i + 1).padStart(2, '0') });
    });
    const firstMat = path.chapters.find(c => c.chapter === MATERIAL_STORIES[0].key);
    if (firstMat) items.push({ key: 'materials', label: 'Materials', progress: firstMat.peak, number: '' });
    const fin = path.chapters.find(c => c.chapter === 'finale');
    if (fin) items.push({ key: 'finale', label: 'Final view', progress: 1, number: '' });
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
    setExplore(false); setPick(null);
    (mgr.cam.controls.domElement as HTMLElement).style.touchAction = 'pan-y';
    mgr.cam.exitExplore(mgr.progress, () => scrollRef.current?.unlock());
  }, [mgr]);
  const toggleExplore = useCallback(() => (explore ? exitExplore() : enterExplore()), [explore, enterExplore, exitExplore]);

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
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'e' || e.key === 'E') toggleExplore();
      if (e.key === 'f' || e.key === 'F') fullscreen();
      if (e.key === 'Escape' && explore) exitExplore();
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [toggleExplore, fullscreen, explore, exitExplore]);

  // touch: let the page scroll in tour mode (OrbitControls would otherwise claim the gesture)
  useEffect(() => { if (mgr) (mgr.cam.controls.domElement as HTMLElement).style.touchAction = 'pan-y'; }, [mgr]);

  // click-to-identify in explore mode
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !mgr || !explore) return;
    let down: [number, number] | null = null;
    const pd = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
    const pu = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      setPick(mgr.pick(e.clientX, e.clientY));
    };
    c.addEventListener('pointerdown', pd); c.addEventListener('pointerup', pu);
    return () => { c.removeEventListener('pointerdown', pd); c.removeEventListener('pointerup', pu); };
  }, [mgr, explore]);

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
          <Header explore={explore} onExplore={toggleExplore} onMenu={() => setMenu(v => !v)} menuOpen={menu} onFullscreen={fullscreen} isFullscreen={fs} />
          <HeroOverlay manager={mgr} roomCount={stories.length} />
          <RoomInformation manager={mgr} chapters={chapters} stories={stories} materialStories={MATERIAL_STORIES}
            rooms={data.rooms.rooms} materials={data.materials.materials} objects={data.scene.objects} reduced={reduced} />
          <RoomNavigation items={navItems} active={active} roomCount={stories.length} activeRoomNumber={activeRoomNumber} onGo={go} manager={mgr} hidden={explore} />
          <Finale manager={mgr} window={finaleWin} rooms={data.rooms} scene={data.scene} onExplore={enterExplore} onRestart={() => go(0)} />
          {explore && (
            <ExploreToolbar
              onReset={() => { const f = exploreFrom.current; if (f) mgr.cam.flyTo(f.p, f.t, f.f); }}
              onOverview={() => mgr.cam.flyToPlan(OVERVIEW.pos, OVERVIEW.target, OVERVIEW.fov)}
              onPlan={() => mgr.cam.flyToPlan(PLAN.pos, PLAN.target, PLAN.fov)}
              onExit={exitExplore} onFullscreen={fullscreen} pick={pick} onClearPick={() => setPick(null)} />
          )}
          {menu && <IndexMenu rooms={data.rooms.rooms} chapterOf={chapterOf} onGo={go} onClose={() => setMenu(false)} />}
        </>
      )}
    </>
  );
}
