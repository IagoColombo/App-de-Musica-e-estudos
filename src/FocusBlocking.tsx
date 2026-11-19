import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';

type Mode = 'windows' | 'extension';
let pendingUpdate: Promise<void> = Promise.resolve();

export function FocusBlocking({ active, domains }: { active: boolean; domains: string[] }) {
  const [mode, setMode] = useState<Mode>(() => localStorage.getItem('lyra:blockMode') === 'extension' ? 'extension' : 'windows');
  const [status, setStatus] = useState('');
  const [retry, setRetry] = useState(0);
  const desktop = Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  useEffect(() => { localStorage.setItem('lyra:blockMode', mode); }, [mode]);
  useEffect(() => {
    if (!desktop) { setStatus('Bloqueio disponível no aplicativo desktop.'); return; }
    let cancelled = false;
    const update = async () => {
      if (cancelled) return;
      setStatus(active ? 'Aplicando bloqueio… Confirme a permissão do Windows, se solicitada.' : 'Verificando desbloqueio…');
      try {
        await invoke('set_focus_state', { active: active && mode === 'extension', domains });
        if (mode === 'windows') {
          const count = await invoke<number>('set_windows_block', { active, domains });
          if (!cancelled) setStatus(active ? `${count} sites registrados no bloqueio do Windows. Recarregue as páginas abertas.` : 'Bloqueio do Windows desativado.');
        } else {
          await invoke('set_windows_block', { active: false, domains: [] });
          if (!cancelled) setStatus(active ? 'A extensão Chrome/Edge aplica o bloqueio em até 30 segundos.' : 'Extensão pronta para a próxima sessão.');
        }
      } catch (error) { if (!cancelled) setStatus(String(error)); }
    };
    pendingUpdate = pendingUpdate.catch(() => {}).then(update);
    return () => { cancelled = true; };
  }, [active, mode, domains.join('|'), desktop, retry]);

  return <div className="focus-blocking">
    <span className="blocking-label">Bloqueio de sites</span><div className="blocking-method" role="group" aria-label="Método de bloqueio"><button aria-pressed={mode === 'windows'} onClick={() => setMode('windows')}>Windows</button><button aria-pressed={mode === 'extension'} onClick={() => setMode('extension')}>Extensão</button></div><div className="blocked-sites">{domains.map(domain => <span key={domain}>{active ? <LockKeyhole size={14} aria-label="Sessão ativa"/> : <LockKeyholeOpen size={14} aria-label="Sessão inativa"/>}{domain}</span>)}</div>
    <p role="status">{status}</p>
    {desktop && <button onClick={() => setRetry(value => value + 1)}>Verificar e reaplicar</button>}
    {mode === 'windows' && desktop && <small>Ao iniciar ou encerrar o bloqueio, confirme a permissão do Windows. A janela do LyraFlow permanece aberta.</small>}
    {mode === 'extension' && <small>Instale a pasta focus-extension no navegador. Veja o README.</small>}
  </div>;
}
