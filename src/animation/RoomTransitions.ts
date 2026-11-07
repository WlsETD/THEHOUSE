import type { ChapterWindow } from './CameraPath';

/**
 * Scroll-synchronised visibility for chapter text: fades in as the camera arrives on the chapter's
 * first dwelling frame, holds, and fades out as it leaves. Returns opacity 0…1 and a slide offset.
 */
export function chapterVisibility(c: ChapterWindow, p: number, fade = 0.012, prevEnd = -1, nextStart = 2): { o: number; y: number } {
  // never overlap neighbouring chapters: fades are squeezed into the gap between them
  const gapIn = Math.max(0.002, (c.start - prevEnd) / 2), gapOut = Math.max(0.002, (nextStart - c.end) / 2);
  const fin = Math.min(fade, gapIn), fout = Math.min(fade, gapOut);
  const a = c.start, b = c.end;
  if (p < a - fin || p > b + fout) return { o: 0, y: p < a ? 1 : -1 };
  const inF = smooth((p - (a - fin)) / fin);
  const outF = 1 - smooth((p - b) / fout);
  const o = Math.min(inF, outF);
  const y = p < (a + b) / 2 ? 1 - inF : -(1 - outF);
  return { o, y };
}

function smooth(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
