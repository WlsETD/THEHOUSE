import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'zh' | 'en';

/** UI strings. Room and material names come from rooms.json / materials.json (name_zh / name_en). */
const S = {
  'hero.title': { zh: '一個值得親身體驗的空間。', en: 'A Space to Experience.' },
  'hero.sub1': { zh: '圍繞生活的藝術', en: 'Designed Around' },
  'hero.sub2': { zh: '而設計。', en: 'The Art of Living.' },
  'hero.place': { zh: '新北市新店', en: 'Xindian, New Taipei' },
  'hero.project': { zh: '專案 ACL16004', en: 'Project ACL16004' },
  'hero.spaces': { zh: '個空間', en: 'spaces' },
  'hero.cue': { zh: '向下捲動開始參觀', en: 'Scroll to explore' },
  'brand': { zh: '吳公館', en: 'WU RESIDENCE' },
  'brand.sub': { zh: '建築／室內設計', en: 'Architecture / Interior Design' },
  'h.explore': { zh: '自由探索', en: 'Free explore' },
  'h.explore.s': { zh: '探索', en: 'Explore' },
  'h.tour': { zh: '回到導覽', en: 'Scroll tour' },
  'h.tour.s': { zh: '導覽', en: 'Tour' },
  'h.studio': { zh: '設計工作室', en: 'Studio' },
  'h.studio.s': { zh: '工作室', en: 'Studio' },
  'h.index': { zh: '空間索引', en: 'Index' },
  'h.close': { zh: '關閉', en: 'Close' },
  'h.fs': { zh: '全螢幕', en: 'Fullscreen' },
  'h.fs.exit': { zh: '離開全螢幕', en: 'Exit full' },
  'nav.overview': { zh: '總覽', en: 'Overview' },
  'nav.materials': { zh: '材質', en: 'Materials' },
  'nav.final': { zh: '全景', en: 'Final view' },
  'nav.spaces': { zh: '空間', en: 'Spaces' },
  'ch.area': { zh: '面積', en: 'Area' },
  'ch.materials': { zh: '材質', en: 'Materials' },
  'ch.features': { zh: '空間特色', en: 'Features' },
  'ch.furniture': { zh: '家具重點', en: 'Furniture' },
  'mat.label': { zh: '材質', en: 'Material' },
  'mat.applied': { zh: '用於 {n} 個物件：', en: 'Applied to {n} objects in ' },
  'mat.interlude': { zh: '間奏', en: 'Interlude' },
  'mat.experience': { zh: '材質體驗', en: 'Material Experience' },
  'mat.count': { zh: '{n} 種 PBR 材質 · materials.json', en: '{n} PBR materials · materials.json' },
  'fin.label': { zh: '完整總覽', en: 'Final overview' },
  'fin.title': { zh: '吳公館', en: 'Wu Residence' },
  'fin.interior': { zh: '室內', en: 'Interior' },
  'fin.balconies': { zh: '陽台', en: 'Balconies' },
  'fin.spaces': { zh: '空間', en: 'Spaces' },
  'fin.outdoor': { zh: '個戶外', en: 'outdoor' },
  'fin.footprint': { zh: '外框', en: 'Footprint' },
  'fin.explore': { zh: '自由探索', en: 'Explore freely' },
  'fin.studio': { zh: '開啟設計工作室', en: 'Open the studio' },
  'fin.restart': { zh: '回到開頭', en: 'Back to the beginning' },
  'fin.credit': { zh: '以 WebGL 即時算繪；圖面未標註的高度為推估值。', en: 'Rendered live in WebGL; heights not dimensioned on the drawing are assumptions.' },
  'idx.title': { zh: '空間索引', en: 'Index of spaces' },
  'idx.interior': { zh: '室內', en: 'Interior' },
  'idx.outdoor': { zh: '戶外', en: 'Outdoor' },
  'ex.hint': { zh: '拖曳旋轉 · 滾輪或雙指縮放 · 右鍵或雙指平移 · 點選物件查看資料', en: 'Drag to orbit · scroll or pinch to zoom · right-drag or two fingers to pan · click an object for its details' },
  'ex.reset': { zh: '重置視角', en: 'Reset view' },
  'ex.overview': { zh: '總覽', en: 'Overview' },
  'ex.plan': { zh: '平面圖', en: 'Floor plan' },
  'ex.back': { zh: '回到導覽', en: 'Back to tour' },
  'ex.edit': { zh: '編輯此物件材質', en: 'Edit this object' },
  'load.title': { zh: '吳公館 · 平面圖 A-D-11', en: 'Wu Residence · Plan A-D-11' },
  'load.nogl': { zh: '此瀏覽器未開啟或不支援 WebGL，無法顯示即時 3D 模型。', en: 'This browser has WebGL turned off or unavailable, so the live 3D model cannot be shown.' },
  'lang': { zh: 'EN', en: '中文' },
  'lang.aria': { zh: 'Switch to English', en: '切換為中文' },
} as const;

export type Key = keyof typeof S;

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, vars?: Record<string, string | number>) => string; pick: <T>(zh: T, en: T) => T }
const LangCtx = createContext<Ctx | null>(null);

function initial(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'zh') return q;
  try { const s = localStorage.getItem('wu-lang'); if (s === 'en' || s === 'zh') return s; } catch { /* storage unavailable */ }
  return 'zh';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => {
    set(l);
    document.documentElement.lang = l === 'zh' ? 'zh-Hant-TW' : 'en';
    try { localStorage.setItem('wu-lang', l); } catch { /* ignore */ }
  }, []);
  const value = useMemo<Ctx>(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant-TW' : 'en';
    return {
      lang, setLang,
      t: (k, vars) => { let s: string = S[k][lang]; if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, String(b)); return s; },
      pick: (zh, en) => (lang === 'zh' ? zh : en),
    };
  }, [lang, setLang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const c = useContext(LangCtx);
  if (!c) throw new Error('useLang outside LangProvider');
  return c;
}
