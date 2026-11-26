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

export function useLyricsAnimation(list: RefObject<HTMLElement | null>, activeIndex: number, trackId: string, viewKey = "") {
  const follow = useRef<(() => void) | null>(null);
  useGSAP(() => {
    const container = list.current;
    if (!container) return;
    let resume: number | undefined;
    let tween: gsap.core.Tween | undefined;
    const align = () => {
      const active = container.querySelector<HTMLElement>('[aria-current="true"]');
      if (!active || resume !== undefined) return;
      const topInset = parseFloat(getComputedStyle(container).paddingTop);
      const target = container.scrollTop + active.getBoundingClientRect().top
        - container.getBoundingClientRect().top - container.clientTop - topInset;
      if (Math.abs(target - container.scrollTop) < 1) return;
      tween?.kill();
      tween = gsap.to(container, { scrollTo: { y: Math.max(0, target), autoKill: true },
        duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : .35, ease: motion.ease });
    };
    const suspend = () => {
      tween?.kill();
      window.clearTimeout(resume);
      resume = window.setTimeout(() => { resume = undefined; align(); }, 4000);
    };
    const inputs = ['wheel', 'touchmove', 'pointerdown', 'keydown'];
    inputs.forEach(type => container.addEventListener(type, suspend, { passive: true }));
    follow.current = align;
    return () => {
      follow.current = null;
      tween?.kill();
      window.clearTimeout(resume);
      inputs.forEach(type => container.removeEventListener(type, suspend));
    };
  }, { dependencies: [trackId, viewKey], revertOnUpdate: true });
  useGSAP(() => { follow.current?.(); }, { dependencies: [activeIndex, trackId, viewKey] });
}

export function useBrandPlayback(mark: RefObject<HTMLSpanElement | null>, playing: boolean) {
  useGSAP(() => {
    const bars = mark.current?.querySelectorAll('i');
    if (!playing || !bars?.length) return;

    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const durations = [.37, .45, .33, .49, .4];
      bars.forEach((bar, index) => {
        gsap.to(bar, {
          scaleY: index % 2 === 0 ? .45 : 1.18,
          transformOrigin: 'center',
          duration: durations[index % durations.length],
          delay: index * .07,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });
    });
    return () => media.revert();
  }, { scope: mark, dependencies: [playing], revertOnUpdate: true });
}

export function useButtonMotion(scope: RefObject<HTMLElement | null>) {
  useGSAP(() => {
    const root = scope.current;
    if (!root) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const selector = '.controls button, .spotify-remote-buttons button, .song-title button, .youtube-main-player button, .lyrics-column .panel-heading button';
      const tweens = new Map<Element, gsap.core.Tween>();
      const animate = (event: Event) => {
        const button = event.target instanceof Element && event.target.closest<HTMLButtonElement>(selector);
        if (!button || button.disabled) return;
        if (event instanceof PointerEvent && event.relatedTarget instanceof Node && button.contains(event.relatedTarget)) return;
        const icon = button.querySelector('svg') ?? button;
        tweens.get(button)?.kill();
        const complete = () => { tweens.delete(button); };
        const tween = event.type === 'click'
          ? gsap.fromTo(icon, { scale: .86, opacity: .72 }, { scale: 1, opacity: 1, duration: .22, clearProps: 'transform,opacity', onComplete: complete })
          : gsap.to(icon, { scale: event.type === 'pointerdown' ? .94 : event.type === 'pointerover' ? 1.06 : 1,
              duration: .14, onComplete: complete });
        tweens.set(button, tween);
      };
      const events = ['pointerover', 'pointerout', 'pointerdown', 'pointerup', 'pointercancel', 'click'];
      events.forEach(type => root.addEventListener(type, animate));
      return () => {
        events.forEach(type => root.removeEventListener(type, animate));
        tweens.forEach(tween => tween.kill());
        root.querySelectorAll(selector).forEach(button => gsap.set(button.querySelector('svg') ?? button, { clearProps: 'transform,opacity' }));
      };
    });
    return () => media.revert();
  }, { scope });
}

export function useFocusModeTimeline(scope: RefObject<HTMLElement | null>, enabled: boolean) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline();
      tl.to('.proxy-card', { opacity: enabled ? .95 : 1, duration: motion.standard }, 0)
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
