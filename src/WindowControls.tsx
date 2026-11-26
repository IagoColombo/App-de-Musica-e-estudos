import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Bell, Maximize2, Minus, X } from 'lucide-react';
import { IconButton } from './ui/Primitives';

const desktop = Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

export function WindowControls({ updateVersion }: { updateVersion: string | null }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [readVersion, setReadVersion] = useState(() => localStorage.getItem('lyra:readUpdate'));
  const unread = Boolean(updateVersion && updateVersion !== readVersion && !showNotifications);
  useEffect(() => {
    if (!showNotifications || !updateVersion) return;
    setReadVersion(updateVersion);
    localStorage.setItem('lyra:readUpdate', updateVersion);
  }, [showNotifications, updateVersion]);
  const appWindow = desktop ? getCurrentWindow() : null;
  return <div className="window-actions">
    <div className="notification-anchor">
      <IconButton label="Notificações" className="notification-button" onClick={() => setShowNotifications(value => !value)}><Bell size={18}/>{unread && <span className="notification-dot"/>}</IconButton>
      {showNotifications && <div className="notification-popover" role="status">{updateVersion ? `LyraFlow ${updateVersion} disponível` : "Sem notificações no momento."}</div>}
    </div>
    <div className="window-controls" aria-label="Controles da janela">
      <IconButton label="Minimizar" disabled={!appWindow} onClick={() => void appWindow?.minimize()}><Minus size={17}/></IconButton>
      <IconButton label="Maximizar ou restaurar" disabled={!appWindow} onClick={() => void appWindow?.toggleMaximize()}><Maximize2 size={15}/></IconButton>
      <IconButton label="Fechar" disabled={!appWindow} onClick={() => void appWindow?.close()}><X size={17}/></IconButton>
    </div>
  </div>;
}
