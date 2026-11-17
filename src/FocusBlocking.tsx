import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

type Mode = 'windows' | 'extension';

export function FocusBlocking({ active, domains }: { active: boolean; domains: string[] }) {
  const [mode, setMode] = useState<Mode>(() => localStorage.getItem('lyra:blockMode') === 'extension' ? 'extension' : 'windows');
  const [status, setStatus] = useState('');
  const desktop = Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  useEffect(() => { localStorage.setItem('lyra:blockMode', mode); }, [mode]);
  useEffect(() => {
    if (!desktop) { setStatus('Bloqueio disponível no aplicativo desktop.'); return; }
    let cancelled = false;
    const update = async () => {
      try {
        await invoke('set_focus_state', { active: active && mode === 'extension', domains });
        if (mode === 'windows') {
          await invoke('set_windows_block', { active, domains });
          if (!cancelled) setStatus(active ? `${domains.length} sites bloqueados no Windows.` : 'Bloqueio do Windows desativado.');
        } else {
          await invoke('set_windows_block', { active: false, domains: [] }).catch(() => {});
          if (!cancelled) setStatus(active ? 'A extensão Chrome/Edge aplica o bloqueio em até 30 segundos.' : 'Extensão pronta para a próxima sessão.');
        }
      } catch (error) { if (!cancelled) setStatus(String(error)); }
    };
    update();
    return () => { cancelled = true; };
  }, [active, mode, domains.join('|'), desktop]);

  return <div className="focus-blocking">
    <label>Bloqueio de sites<select value={mode} onChange={event => setMode(event.target.value as Mode)}><option value="windows">Windows · permissão ao iniciar</option><option value="extension">Extensão Chrome/Edge</option></select></label>
    <p role="status">{status}</p>
    {mode === 'windows' && desktop && <small>Ao iniciar ou encerrar o bloqueio, confirme a permissão do Windows. A janela do LyraFlow permanece aberta.</small>}
    {mode === 'extension' && <small>Instale a pasta focus-extension no navegador. Veja o README.</small>}
  </div>;
}
