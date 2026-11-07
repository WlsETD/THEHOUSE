interface Props {
  explore: boolean;
  onExplore: () => void;
  onMenu: () => void;
  menuOpen: boolean;
  onFullscreen: () => void;
  isFullscreen: boolean;
}

export function Header({ explore, onExplore, onMenu, menuOpen, onFullscreen, isFullscreen }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-name">WU RESIDENCE</span>
        <span className="brand-sub label">Architecture / Interior Design</span>
      </div>
      <nav className="header-actions" aria-label="Site">
        <button className="hbtn label" aria-pressed={explore} onClick={onExplore} title="Toggle free explore (E)">
          <span className="tick" /><span className="long">{explore ? 'Scroll tour' : 'Free explore'}</span><span className="short">{explore ? 'Tour' : 'Explore'}</span>
        </button>
        <button className="hbtn label" aria-expanded={menuOpen} onClick={onMenu}>
          <span className="tick" />{menuOpen ? 'Close' : 'Index'}
        </button>
        <button className="hbtn label fs-btn" onClick={onFullscreen} aria-pressed={isFullscreen} title="Fullscreen (F)">
          <span className="tick" />{isFullscreen ? 'Exit full' : 'Fullscreen'}
        </button>
      </nav>
    </header>
  );
}
