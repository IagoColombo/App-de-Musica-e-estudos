import { useEffect, useState } from 'react';
import { Pause, Play, Shuffle, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { spotifyPlayerCommand, spotifyRequest, type SpotifySession, type SpotifyTrack } from './spotify';

export function SpotifyControls({ session, track, onSessionChange }: { session: SpotifySession | null; track: SpotifyTrack; onSessionChange: (session: SpotifySession) => void }) {
  const [volume, setVolume] = useState(72);
  const [shuffle, setShuffle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!session) return;
    let active = true;
    void spotifyRequest(session, '/me/player').then(async result => {
      if (!result.response.ok || !active) return;
      const state = await result.response.json() as { shuffle_state?: boolean; device?: { volume_percent?: number } };
      if (!active) return;
      setShuffle(Boolean(state.shuffle_state));
      if (typeof state.device?.volume_percent === 'number') setVolume(state.device.volume_percent);
    }).catch(() => {});
    return () => { active = false; };
  }, [session?.clientId]);
  async function command(path: string, method: 'PUT' | 'POST', body?: object) {
    if (!session || busy) return;
    setBusy(true); setError('');
    try {
      onSessionChange(await spotifyPlayerCommand(session, path, method, body));
      window.dispatchEvent(new Event('lyra:spotify-refresh'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  return <div className="spotify-remote" aria-label="Controles do Spotify">
    <div className="spotify-remote-buttons">
      <button aria-label="Alternar ordem aleatória" aria-pressed={shuffle} disabled={busy} onClick={() => { const next = !shuffle; setShuffle(next); void command(`shuffle?state=${next}`, 'PUT'); }}><Shuffle size={19}/></button>
      <button aria-label="Faixa anterior" disabled={busy} onClick={() => void command('previous', 'POST')}><SkipBack size={21}/></button>
      <button aria-label={track.isPlaying ? 'Pausar Spotify' : 'Reproduzir Spotify'} disabled={busy} onClick={() => void command(track.isPlaying ? 'pause' : 'play', 'PUT')}><span className="spotify-remote-play">{track.isPlaying ? <Pause size={23} fill="currentColor"/> : <Play size={23} fill="currentColor"/>}</span></button>
      <button aria-label="Próxima faixa" disabled={busy} onClick={() => void command('next', 'POST')}><SkipForward size={21}/></button>
    </div>
    <label className="spotify-remote-volume"><Volume2 size={17}/><input aria-label="Volume do Spotify" type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))} onPointerUp={() => void command(`volume?volume_percent=${volume}`, 'PUT')} onKeyUp={() => void command(`volume?volume_percent=${volume}`, 'PUT')}/><span>{volume}%</span></label>
    {error && <small role="alert">{error}</small>}
  </div>;
}
