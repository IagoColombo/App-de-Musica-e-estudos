import { KaraokeText } from './Karaoke';
import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export function CinematicControls() {
  const [mode, setMode] = useState(() => localStorage.getItem('lyra:visualMode') || 'normal');
  useEffect(() => {
    document.querySelector('.lyrics-column')?.setAttribute('data-visual-mode', mode);
    localStorage.setItem('lyra:visualMode', mode);
    return () => document.querySelector('.lyrics-column')?.removeAttribute('data-visual-mode');
  }, [mode]);
  return <label className="visual-mode">Visual <select aria-label="Modo visual das letras" value={mode} onChange={event => setMode(event.target.value)}>
    <option value="normal">Normal</option><option value="cinematic">Cinematic</option><option value="immersive">Immersive</option>
  </select></label>;
}

const demoLines = ['A cidade acende devagar', 'Cada luz encontra seu lugar', 'Entre as estrelas e o chão', 'A música conduz o coração'];

export function KaraokeDemo() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const clock = useRef({ time: 0, started: 0 });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!playing || !open) return;
    clock.current = { time, started: performance.now() };
    const timer = setInterval(() => {
      const next = Math.min(24, clock.current.time + (performance.now() - clock.current.started) / 1000);
      setTime(next);
      if (next === 24) setPlaying(false);
    }, 100);
    return () => clearInterval(timer);
  }, [playing, open]);
  const active = Math.min(3, Math.floor(time / 6));
  useGSAP(() => {
    if (!open) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.demo-current span', { y: 16, opacity: 0, scale: .96, stagger: .055, duration: .55, ease: 'power3.out' });
    });
    return () => media.revert();
  }, { scope: root, dependencies: [active, open], revertOnUpdate: true });
  return <div className="karaoke-demo" ref={root}>
    <button aria-expanded={open} onClick={() => { setOpen(!open); setPlaying(false); }}>Demonstração</button>
    {open && <div><p>Letra fictícia · relógio e tempos simulados</p>
      <p className="demo-current"><KaraokeText line={{ at: active * 6, original: demoLines[active], words: demoLines[active].split(' ').map((text, i, words) => ({ at: active * 6 + i * 6 / words.length, text: text + ' ' })) }} position={time} end={(active + 1) * 6}/></p>
      <button onClick={() => { if (time === 24) setTime(0); setPlaying(!playing); }}>{playing ? 'Pausar demonstração' : 'Reproduzir demonstração'}</button>
      <input aria-label="Tempo da demonstração" type="range" min="0" max="24" step=".1" value={time} onChange={event => {
        const next = Number(event.target.value); setTime(next); clock.current = { time: next, started: performance.now() };
      }}/></div>}
  </div>;
}
