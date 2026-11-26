import { formatTime } from './data';
import { usePlaybackProgress } from './SpotifyLyrics';
import { useState } from 'react';
import { Pause, Play, Shuffle, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { spotifyPlayerCommand, type SpotifySession, type SpotifyTrack } from './spotify';

export function SpotifyControls({ session, track, onSessionChange }: { session: SpotifySession | null; track: SpotifyTrack; onSessionChange: (session: SpotifySession) => void }) {
  const progress = usePlaybackProgress(track);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unavailable = !session || !session.scopes.split(' ').includes('user-modify-playback-state');
  const disabled = unavailable || busy;
  const volume = track.volumePercent;
  const shuffle = Boolean(track.shuffle);
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
      <button aria-label="Alternar ordem aleatória" aria-pressed={shuffle} disabled={disabled} onClick={() => { const next = !shuffle; void command(`shuffle?state=${next}`, 'PUT'); }}><Shuffle size={19}/></button>
      <button aria-label="Faixa anterior" disabled={disabled || track.disallows?.skipping_prev} onClick={() => void command('previous', 'POST')}><SkipBack size={21}/></button>
      <button aria-label={track.isPlaying ? 'Pausar Spotify' : 'Reproduzir Spotify'} disabled={disabled || (track.isPlaying ? track.disallows?.pausing : track.disallows?.resuming)} onClick={() => void command(track.isPlaying ? 'pause' : 'play', 'PUT')}><span className="spotify-remote-play">{track.isPlaying ? <Pause size={23} fill="currentColor"/> : <Play size={23} fill="currentColor"/>}</span></button>
      <button aria-label="Próxima faixa" disabled={disabled || track.disallows?.skipping_next} onClick={() => void command('next', 'POST')}><SkipForward size={21}/></button>
    </div>
    <div className="youtube-timeline"><span>{formatTime(progress / 1000)}</span>
      <input aria-label="Posição no Spotify" type="range" min="0" max={Math.max(1, track.durationMs)} step="1000" value={progress}
        disabled={disabled || !track.durationMs || track.disallows?.seeking}
        onChange={event => void command(`seek?position_ms=${event.target.value}`, 'PUT')}/>
      <span>{formatTime(track.durationMs / 1000)}</span></div>
    {volume !== undefined && track.supportsVolume !== false ? <label className="spotify-remote-volume"><Volume2 size={17}/>
      <input aria-label="Volume do Spotify" type="range" min="0" max="100" value={volume} disabled={disabled}
        onChange={event => void command(`volume?volume_percent=${event.target.value}`, 'PUT')}/><span>{volume}%</span></label>
      : <small>Volume indisponível neste dispositivo.</small>}
    {!unavailable && (track.disallows?.seeking || track.disallows?.skipping_next || track.disallows?.skipping_prev || (track.isPlaying ? track.disallows?.pausing : track.disallows?.resuming)) && <small>Alguns controles estão indisponíveis para esta reprodução.</small>}
    {unavailable && <small>Autorize o controle do player para usar os comandos do Spotify.</small>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
