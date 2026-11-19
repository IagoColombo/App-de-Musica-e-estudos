import { useEffect, useRef, useState } from 'react';
import { clearSpotifySession, connectSpotify, getSpotifyTrack, hasSpotifyLibraryAccess, loadSpotifySession, saveSpotifySession, type SpotifySession, type SpotifyTrack } from './spotify';

export function SpotifyPanel({ onConnectionChange, onSessionChange, onOpenLibrary }: { onConnectionChange?: (connected: boolean) => void; onSessionChange?: (session: SpotifySession | null) => void; onOpenLibrary?: () => void }) {
  const [clientId, setClientId] = useState(() => localStorage.getItem('lyra:spotifyClientId') || 'f2b88e25eefc497f886ba7a8ca13c1db');
  const [connected, setConnected] = useState(() => Boolean(loadSpotifySession()));
  const [busy, setBusy] = useState(false);
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [error, setError] = useState('');
  const session = useRef<SpotifySession | null>(loadSpotifySession());
  const checking = useRef(false);

  useEffect(() => { localStorage.setItem('lyra:spotifyClientId', clientId.trim()); }, [clientId]);
  useEffect(() => {
    if (session.current) { onConnectionChange?.(true); onSessionChange?.(session.current); void refresh(); }
  }, []);

  async function refresh() {
    if (!session.current || checking.current) return;
    checking.current = true;
    const previous = loadSpotifySession() || session.current;
    session.current = previous;
    try {
      const result = await getSpotifyTrack(previous);
      if (session.current === previous) {
        session.current = result.session;
        saveSpotifySession(result.session);
        onSessionChange?.(result.session);
        setTrack(result.track);
        window.dispatchEvent(new CustomEvent('lyra:spotify-track', { detail: result.track }));
        setError('');
      }
    } catch (cause) {
      if (session.current === previous) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (message.includes('autorização do Spotify expirou') || message.includes('sessão do Spotify expirou')) disconnect();
        setError(message);
      }
    } finally { checking.current = false; }
  }

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(refresh, 5_000);
    window.addEventListener('lyra:spotify-refresh', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('lyra:spotify-refresh', refresh); };
  }, [connected]);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      session.current = await connectSpotify(clientId.trim());
      saveSpotifySession(session.current);
      setConnected(true);
      onConnectionChange?.(true);
      onSessionChange?.(session.current);
      onOpenLibrary?.();
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  function disconnect() {
    session.current = null;
    clearSpotifySession();
    setConnected(false);
    onConnectionChange?.(false);
    onSessionChange?.(null);
    setTrack(null);
    window.dispatchEvent(new CustomEvent('lyra:spotify-track', { detail: null }));
    setError('');
  }

  return <div className="spotify-card">
    <div className="spotify-heading"><h3>Spotify</h3><span className={connected ? 'connected' : ''}>{connected ? 'Conectado' : 'Desconectado'}</span></div>
    {!connected ? <><p>Conecte para ver suas playlists e controlar a reprodução no Spotify.</p><label>Client ID<input value={clientId} onChange={event => setClientId(event.target.value)} placeholder="Client ID do Spotify for Developers" autoComplete="off"/></label><button className="spotify-action" disabled={busy} onClick={connect}>{busy ? 'Aguardando autorização…' : 'Conectar Spotify'}</button></> : <>
      {track ? <div className="spotify-track">{track.image && <img src={track.image} alt="Capa do álbum"/>}<div><strong>{track.title}</strong><span>{track.artist}</span><small>{track.isPlaying ? 'Em reprodução' : 'Pausada'} · {track.album}</small><a href={track.url} target="_blank" rel="noopener noreferrer">Abrir no Spotify ↗</a></div></div> : <p>Nenhuma faixa em reprodução foi encontrada.</p>}
      {session.current && !hasSpotifyLibraryAccess(session.current) && <p className="spotify-permission-note">Autorize as novas permissões para abrir playlists e escolher músicas.</p>}
      <button className="spotify-library-open" onClick={onOpenLibrary}>Explorar minhas playlists <span aria-hidden="true">↗</span></button>
      {session.current && !hasSpotifyLibraryAccess(session.current) && <button className="spotify-permission-button" disabled={busy} onClick={connect}>{busy ? 'Aguardando autorização…' : 'Atualizar permissões'}</button>}
      <div className="spotify-actions"><button onClick={refresh}>Atualizar</button><button onClick={disconnect}>Desconectar</button></div>
    </>}
    {error && <small className="spotify-error" role="alert">{error}</small>}
    <small className="spotify-footnote">Letra consultada para a faixa atual, quando disponível.</small>
  </div>;
}
