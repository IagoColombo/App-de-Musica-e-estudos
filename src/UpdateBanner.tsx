import { useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) return;
    let active = true;
    const inspect = async () => {
      try {
        const found = await check();
        if (active) setUpdate(found);
      } catch { /* The app remains usable while offline. Try again at the next interval. */ }
    };
    void inspect();
    const timer = window.setInterval(inspect, 60 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function install() {
    if (!update || installing) return;
    setInstalling(true);
    setMessage('Baixando atualização…');
    try {
      await update.downloadAndInstall(event => {
        if (event.event === 'Finished') setMessage('Instalando atualização…');
      });
      await relaunch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível instalar a atualização.');
      setInstalling(false);
    }
  }

  if (!update) return null;
  return <div className="update-banner" role="status"><span>LyraFlow {update.version} disponível</span><button onClick={install} disabled={installing}>{installing ? message : 'Atualizar agora'}</button>{!installing && message && <small>{message}</small>}</div>;
}
