import { useRef } from 'react';
import { useSignalMotion } from './useLyraMotion';

export function SignalChain({ route, latency, label, revision }: {
  route: 'idle' | 'cache' | 'local' | 'external' | 'error';
  latency?: number;
  label: string;
  revision: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const node = { idle: -1, cache: 0, local: 1, external: 2, error: -1 }[route];
  const angle = -70 + Math.min(1000, Math.max(0, latency ?? 0)) * .14;
  useSignalMotion(root, revision, route, angle);

  return <div className="signal-module" ref={root} data-route={route}>
    <div className="signal-chain" aria-hidden="true">
      <svg viewBox="0 0 300 43" preserveAspectRatio="none">
        <path className="signal-wire" d="M50 14 C84 14 112 38 150 14 M150 14 C184 14 212 38 250 14"/>
        <path className="signal-flow" data-live={node >= 1} pathLength="1" d="M50 14 C84 14 112 38 150 14"/>
        <path className="signal-flow" data-live={node >= 2} pathLength="1" d="M150 14 C184 14 212 38 250 14"/>
        {route === 'error' && <path className="signal-break" d="m187 12 10 12m0-12-10 12"/>}
      </svg>
      {['Cache', 'Serviço local', 'API externa'].map((name, index) =>
        <span key={name}><i data-live={index === node}/>{name}</span>
      )}
    </div>
    <div className="signal-readout">
      <strong role="status">{label}{node >= 0 && <span className="sr-only"> · {['Cache', 'Serviço local', 'API externa'][node]}</span>}</strong>
      <div className="signal-meter">
        <svg viewBox="0 0 84 40" aria-hidden="true">
          <path d="M7 34 Q42 -21 77 34" className="meter-scale"/>
          <g className="meter-needle" style={{ '--needle-rest': `${angle}deg` } as React.CSSProperties}>
            <path d="M42 35 V8"/><circle cx="42" cy="35" r="3"/>
          </g>
        </svg>
        <span className="latency">{latency === undefined ? '…' : `${latency} ms`}</span>
      </div>
    </div>
  </div>;
}
