import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { SplitText } from 'gsap/SplitText';
import { useRef, type RefObject } from 'react';

gsap.registerPlugin(useGSAP, ScrollToPlugin, SplitText);
export const motion = { quick: .24, standard: .46, reveal: 1.2, ease: 'power3.out', accent: 'power2.inOut' } as const;

export function usePageEntrance(scope: RefObject<HTMLElement | null>, page: string, trackId: string) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const visible = gsap.utils.toArray<HTMLElement>('.intro, .collection, .spotify-account:not([hidden]), .library-hero, .library-layout, .youtube-main-player').filter(el => el.offsetParent !== null);
      gsap.from(visible, { opacity: 0, y: 16, scale: .985, duration: motion.standard, ease: motion.ease, stagger: { amount: .18 }, clearProps: 'transform,opacity' });
    });
    return () => mm.revert();
  }, { scope, dependencies: [page, trackId], revertOnUpdate: true });
}

export function useLyricsAnimation(list: RefObject<HTMLElement | null>, activeIndex: number, trackId: string, playing: boolean) {
  useGSAP(() => {
    const container = list.current;
    if (!container) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const active = activeIndex >= 0
        ? container.querySelector<HTMLElement>(`[aria-current="true"]`)
        : null;
      if (!active) return;
      // ScrollToPlugin accepts an absolute scrollTop for an element container.
      // Using the element itself here made the browser calculate the page offset
      // and could fight the native `scroll-behavior: smooth` rule.
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const centeredTop = active.offsetTop - (container.clientHeight - active.offsetHeight) / 2;
      const targetTop = Math.min(maxScroll, Math.max(0, centeredTop));
      gsap.killTweensOf(container);
      gsap.fromTo(active, { opacity: .5, scale: .97, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: motion.standard, ease: motion.ease });
      if (playing) gsap.to(container, { scrollTo: { y: targetTop, autoKill: false }, duration: .65, ease: motion.ease, overwrite: true });
    });
    mm.add('(prefers-reduced-motion: reduce)', () => {
      const active = activeIndex >= 0 ? container.querySelector<HTMLElement>('[aria-current="true"]') : null;
      if (active && playing) {
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        const centeredTop = active.offsetTop - (container.clientHeight - active.offsetHeight) / 2;
        container.scrollTop = Math.min(maxScroll, Math.max(0, centeredTop));
      }
    });
    return () => {
      gsap.killTweensOf(container);
      mm.revert();
    };
  }, { scope: list, dependencies: [activeIndex, trackId, playing], revertOnUpdate: false });
}

export function useFocusModeTimeline(scope: RefObject<HTMLElement | null>, enabled: boolean) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline();
      tl.to('.focus-card', { scale: enabled ? 1.025 : 1, duration: motion.standard, ease: motion.ease }, 0)
        .to('.proxy-card', { scale: enabled ? .96 : 1, opacity: enabled ? .95 : 1, duration: motion.standard }, 0)
        .to('.player-column, .lyrics-column', { scale: enabled ? .985 : 1, opacity: enabled ? .95 : 1, duration: motion.standard }, 0);
    });
    return () => mm.revert();
  }, { scope, dependencies: [enabled], revertOnUpdate: true });
}

export function useSignalMotion(scope: RefObject<HTMLElement | null>, revision: string, route: string, angle: number) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!document.hasFocus()) return;
      const paths = scope.current?.querySelectorAll('.signal-flow[data-live="true"]');
      const led = scope.current?.querySelector('.signal-chain i[data-live="true"]');
      const needle = scope.current?.querySelector('.meter-needle');
      const timeline = gsap.timeline();
      if (paths?.length) timeline.fromTo(paths, { '--signal-offset': 1 }, { '--signal-offset': 0, duration: motion.quick, stagger: .12 });
      if (led) timeline.fromTo(led, { opacity: .25, scale: .8 }, { opacity: 1, scale: 1, duration: .12, repeat: 2, yoyo: true });
      if (needle) timeline.fromTo(needle, { '--needle-angle': '-70deg' }, { '--needle-angle': `${angle}deg`, duration: .55, ease: 'elastic.out(1,.55)' }, 0);
    });
    return () => mm.revert();
  }, { scope, dependencies: [revision, route, angle], revertOnUpdate: true });
}

export function useAlbumTransition(scope: RefObject<HTMLElement | null>, accent: string, tint: string, trackId: string) {
  const previous = useRef({ accent, tint });
  useGSAP(() => {
    const target = scope.current?.querySelector('.content');
    if (!target) return;
    const start = previous.current;
    previous.current = { accent, tint };
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(target, { '--accent': start.accent, '--bg-tint': start.tint }, { '--accent': accent, '--bg-tint': tint, duration: document.hasFocus() ? motion.reveal : 0, ease: motion.accent });
    });
    mm.add('(prefers-reduced-motion: reduce)', () => gsap.set(target, { '--accent': accent, '--bg-tint': tint }));
    return () => mm.revert();
  }, { scope, dependencies: [accent, tint], revertOnUpdate: true });

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const root = scope.current;
      if (!root || !document.hasFocus()) return;
      const art = root.querySelector('.spotify-main-player img') ?? root.querySelector('.artwork');
      const title = root.querySelector('.spotify-main-player h2') ?? root.querySelector('.song-title h2');
      if (art) gsap.fromTo(art, { opacity: .5, rotation: -3, scale: .97 }, { opacity: 1, rotation: 0, scale: 1, duration: motion.standard, ease: motion.ease, clearProps: 'transform,opacity' });
      if (title) {
        const split = SplitText.create(title, { type: 'words' });
        gsap.from(split.words, { opacity: 0, y: 14, duration: motion.standard, stagger: { amount: .16 }, ease: motion.ease, onComplete: () => split.revert() });
        return () => split.revert();
      }
    });
    return () => mm.revert();
  }, { scope, dependencies: [trackId], revertOnUpdate: true });
}

export function useChannelRail(scope: RefObject<HTMLElement | null>, page: string) {
  useGSAP(() => {
    const marker = scope.current?.querySelector<HTMLElement>('.channel-marker');
    const current = scope.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!marker || !current) return;
    const move = () => {
      const animate = document.hasFocus() && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      gsap.to(marker, { y: current.offsetTop + (current.offsetHeight - marker.offsetHeight) / 2, opacity: 1, duration: animate ? motion.quick : 0, ease: motion.ease, overwrite: true });
    };
    move();
    const observer = new ResizeObserver(move);
    observer.observe(scope.current!);
    return () => { observer.disconnect(); gsap.killTweensOf(marker); };
  }, { scope, dependencies: [page] });
}

export function useFocusDisplay(scope: RefObject<HTMLElement | null>, time: string, running: boolean) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!document.hasFocus()) return;
      const digits = scope.current?.querySelectorAll('.timer-digit');
      const changed = Array.from(digits ?? []).filter(digit => !digit.hasAttribute('data-shown'));
      changed.forEach(digit => digit.setAttribute('data-shown', 'true'));
      if (changed.length) gsap.from(changed, { yPercent: 85, opacity: .3, duration: motion.quick, clearProps: 'transform,opacity' });
    });
    return () => mm.revert();
  }, { scope, dependencies: [time], revertOnUpdate: true });

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!document.hasFocus()) return;
      if (running) gsap.from('.on-air i', { scale: .45, opacity: .4, duration: motion.standard, clearProps: 'transform,opacity' });
      const plugs = scope.current?.querySelectorAll('.blocked-sites svg');
      if (plugs?.length) gsap.from(plugs, { y: -4, opacity: .45, stagger: { amount: .18 }, duration: motion.quick, ease: 'back.out(1.5)', clearProps: 'transform,opacity' });
    });
    return () => mm.revert();
  }, { scope, dependencies: [running], revertOnUpdate: true });
}

export function useShelfEntrance(scope: RefObject<HTMLElement | null>, size: number) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!document.hasFocus()) return;
      const records = scope.current?.querySelectorAll('.library-playlist');
      if (records?.length) gsap.from(records, { y: 12, opacity: 0, duration: motion.standard, stagger: { amount: .25 }, clearProps: 'transform,opacity' });
    });
    return () => mm.revert();
  }, { scope, dependencies: [size], revertOnUpdate: true });
}
