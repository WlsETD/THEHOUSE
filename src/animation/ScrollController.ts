import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
// keep scrub smoothing in real time even when a frame is slow (no artificial lag compensation)
gsap.ticker.lagSmoothing(0);

/**
 * Scroll position ⇄ camera progress. A tall spacer element is scrubbed by ScrollTrigger; every scroll
 * offset maps to exactly one progress value, so scrolling up plays the film backwards.
 */
export class ScrollController {
  readonly state = { progress: 0 };
  private tween: gsap.core.Tween;
  private trigger: ScrollTrigger;
  private locked = false;
  private savedY = 0;

  constructor(spacer: HTMLElement, onUpdate: (p: number) => void, reduced: boolean) {
    ScrollTrigger.config({ ignoreMobileResize: true });
    this.tween = gsap.to(this.state, {
      progress: 1, ease: 'none',
      onUpdate: () => onUpdate(this.state.progress),
      scrollTrigger: { trigger: spacer, start: 'top top', end: 'bottom bottom', scrub: reduced ? true : 1.1, invalidateOnRefresh: true },
    });
    this.trigger = this.tween.scrollTrigger!;
  }

  /** document scroll offset for a progress value */
  yFor(p: number) { return this.trigger.start + p * (this.trigger.end - this.trigger.start); }

  scrollTo(p: number, smooth = true) {
    window.scrollTo({ top: this.yFor(p), behavior: smooth ? 'smooth' : 'auto' });
  }

  /** raw scroll progress (without scrub smoothing) */
  get raw() { return this.trigger.progress; }

  /** free-explore: freeze the page so wheel/touch drive the orbit controls instead of the film */
  lock() {
    if (this.locked) return;
    this.locked = true; this.savedY = window.scrollY;
    this.trigger.disable(false);
    document.documentElement.classList.add('is-locked');
  }
  unlock() {
    if (!this.locked) return;
    this.locked = false;
    document.documentElement.classList.remove('is-locked');
    window.scrollTo(0, this.savedY);
    this.trigger.enable(false);
    ScrollTrigger.refresh();
  }

  refresh() { ScrollTrigger.refresh(); }
  dispose() { this.tween.scrollTrigger?.kill(); this.tween.kill(); }
}
