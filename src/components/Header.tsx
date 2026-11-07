import { useLang } from '../i18n';

interface Props {
  explore: boolean;
  onExplore: () => void;
  onMenu: () => void;
  menuOpen: boolean;
  onFullscreen: () => void;
  isFullscreen: boolean;
  studio: boolean;
  onStudio: () => void;
}

export function Header({ explore, onExplore, onMenu, menuOpen, onFullscreen, isFullscreen, studio, onStudio }: Props) {
  const { t, lang, setLang } = useLang();
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-name">{t('brand')}</span>
        <span className="brand-sub label">{t('brand.sub')}</span>
      </div>
      <nav className="header-actions" aria-label="Site">
        <button className="hbtn is-accent" aria-pressed={studio} onClick={onStudio} title="Studio">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12.5 9.8 4.7l1.5 1.5L3.5 14H2zM11 3.5l1-1 1.5 1.5-1 1z" /></svg>
          <span className="long">{t('h.studio')}</span><span className="short">{t('h.studio.s')}</span>
        </button>
        <button className="hbtn" aria-pressed={explore} onClick={onExplore} title="E">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="m10.4 5.6-1.6 3.2-3.2 1.6 1.6-3.2z" /></svg>
          <span className="long">{explore ? t('h.tour') : t('h.explore')}</span><span className="short">{explore ? t('h.tour.s') : t('h.explore.s')}</span>
        </button>
        <button className="hbtn" aria-expanded={menuOpen} onClick={onMenu}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h10" /></svg>
          <span>{menuOpen ? t('h.close') : t('h.index')}</span>
        </button>
        <button className="hbtn fs-btn" onClick={onFullscreen} aria-pressed={isFullscreen} title="F">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" /></svg>
          <span className="long">{isFullscreen ? t('h.fs.exit') : t('h.fs')}</span>
        </button>
        <button className="hbtn lang-btn" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} aria-label={t('lang.aria')}>
          <span>{t('lang')}</span>
        </button>
      </nav>
    </header>
  );
}
