import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Disc3, Heart, ListMusic, Play, RefreshCw, Waves } from 'lucide-react';
import { formatTime } from './data';
import { getSpotifyPlaylists, getSpotifyPlaylistTracks, hasSpotifyLibraryAccess, playSpotifyTrack, type SpotifyLibraryTrack, type SpotifyPlaylist, type SpotifySession } from './spotify';

type Props = { session: SpotifySession | null; onSessionChange: (session: SpotifySession) => void; onOpenConnection: () => void; onBack: () => void };
const likedSongs: SpotifyPlaylist = { id: '__liked__', name: 'Músicas curtidas', url: 'https://open.spotify.com/collection/tracks', total: 0, owner: 'Sua biblioteca', playableItems: true };

export function SpotifyLibrary({ session, onSessionChange, onOpenConnection, onBack }: Props) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistTotal, setPlaylistTotal] = useState(0);
  const [playlistNext, setPlaylistNext] = useState(false);
  const [selected, setSelected] = useState<SpotifyPlaylist | null>(likedSongs);
  const [tracks, setTracks] = useState<SpotifyLibraryTrack[]>([]);
  const [trackTotal, setTrackTotal] = useState(0);
  const [trackNext, setTrackNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tracksBusy, setTracksBusy] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [trackError, setTrackError] = useState('');
  const [notice, setNotice] = useState('');
  const trackRequest = useRef(0);

  async function loadPlaylists(offset = 0) {
    if (!session || busy) return;
    setBusy(true); setError('');
    try {
      const result = await getSpotifyPlaylists(session, offset);
      onSessionChange(result.session);
      setPlaylists(previous => offset ? [...previous, ...result.page.items] : result.page.items);
      setPlaylistTotal(result.page.total); setPlaylistNext(result.page.next);
      if (!offset && result.page.items.length) setSelected(current => current || result.page.items[0]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function loadTracks(playlist: SpotifyPlaylist, offset = 0) {
    if (!session) return;
    const requestId = ++trackRequest.current;
    setTracksBusy(true); setTrackError('');
    try {
      const result = await getSpotifyPlaylistTracks(session, playlist.id, offset);
      if (requestId !== trackRequest.current) return;
      onSessionChange(result.session);
      setTracks(previous => offset ? [...previous, ...result.page.items] : result.page.items);
      setTrackTotal(result.page.total); setTrackNext(result.page.next);
    } catch (cause) { if (requestId === trackRequest.current) setTrackError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (requestId === trackRequest.current) setTracksBusy(false); }
  }

  useEffect(() => {
    if (!session || !hasSpotifyLibraryAccess(session)) return;
    void loadPlaylists();
  }, [session?.clientId, session?.scopes]);

  useEffect(() => {
    setTracks([]); setTrackTotal(0); setTrackNext(false); setNotice('');
    if (selected?.playableItems) void loadTracks(selected);
  }, [selected?.id, session?.scopes]);

  async function play(track: SpotifyLibraryTrack) {
    if (!session) return;
    setPlayingId(track.id); setNotice('');
    try {
      onSessionChange(await playSpotifyTrack(session, track, selected || undefined, tracks));
      setNotice(`Solicitei a reprodução de “${track.title}” no Spotify.`);
      window.dispatchEvent(new Event('lyra:spotify-refresh'));
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : String(cause)); }
    finally { setPlayingId(null); }
  }

  if (!session || !hasSpotifyLibraryAccess(session)) return <section className="spotify-library spotify-library-empty">
    <div className="library-kicker"><Disc3 size={18}/> SPOTIFY CONNECT</div>
    <h1>Sua música. Seu comando.</h1>
    <p>{session ? 'Sua conexão atual precisa das permissões de playlists e reprodução. Atualize a autorização uma vez.' : 'Conecte sua conta para explorar playlists e escolher músicas sem sair do LyraFlow.'}</p>
    <button onClick={onOpenConnection}>{session ? 'Atualizar permissões' : 'Conectar Spotify'} <ArrowUpRight size={19}/></button>
  </section>;

  return <section className="spotify-library">
    <header className="library-hero"><div className="library-kicker"><span className="library-led"/> CONECTADO AO SPOTIFY <span className="library-kicker-line"/></div><div className="library-hero-main"><div><h1>Em rotação<span>.</span></h1><p>Suas playlists em uma cabine própria. A reprodução acontece no aplicativo Spotify do seu dispositivo.</p></div><Waves className="library-hero-mark" size={110} strokeWidth={.7}/></div><div className="library-hero-footer"><span>{playlistTotal} PLAYLISTS</span><span>CONTROLE REMOTO · SPOTIFY PREMIUM</span><button onClick={onOpenConnection}>Conta e conexão <ArrowUpRight size={16}/></button><button onClick={onBack}><ArrowLeft size={16}/> Voltar ao player</button></div></header>
    <div className="library-layout">
      <div className="library-playlists"><div className="library-section-head"><div><span>01 / COLEÇÃO</span><h2>Playlists</h2></div><button title="Atualizar playlists" aria-label="Atualizar playlists" onClick={() => loadPlaylists()} disabled={busy}><RefreshCw size={17}/></button></div>
        {error && <p className="library-error" role="alert">{error}</p>}
        <div className="library-playlist-list"><button className={`library-playlist liked-songs ${selected?.id === likedSongs.id ? 'selected' : ''}`} onClick={() => setSelected(likedSongs)}><span className="playlist-index">00</span><span className="playlist-art-fallback"><Heart size={25}/></span><span className="playlist-copy"><strong>Músicas curtidas</strong><small>Sua biblioteca · faixas salvas</small></span><ArrowUpRight size={17}/></button>{playlists.map((playlist, index) => <button key={playlist.id} className={`library-playlist ${selected?.id === playlist.id ? 'selected' : ''}`} onClick={() => setSelected(playlist)}><span className="playlist-index">{String(index + 1).padStart(2, '0')}</span>{playlist.image ? <img src={playlist.image} alt=""/> : <span className="playlist-art-fallback"><ListMusic size={25}/></span>}<span className="playlist-copy"><strong>{playlist.name}</strong><small>{playlist.owner} · {playlist.total} faixas</small></span><ArrowUpRight size={17}/></button>)}</div>
        {busy && <p className="library-loading">Carregando playlists…</p>}{!busy && playlists.length === 0 && !error && <p className="library-loading">Nenhuma playlist encontrada nesta conta.</p>}{playlistNext && <button className="library-more" onClick={() => loadPlaylists(playlists.length)} disabled={busy}>Carregar mais playlists</button>}
      </div>
      <div className="library-tracks"><div className="library-section-head"><div><span>02 / SELEÇÃO</span><h2>{selected?.name || 'Escolha uma playlist'}</h2></div>{selected && <a href={selected.url} target="_blank" rel="noopener noreferrer">Abrir no Spotify <ArrowUpRight size={16}/></a>}</div>
        {selected && <p className="library-track-count">{trackTotal || selected.total} FAIXAS · CLIQUE EM UMA MÚSICA PARA TOCAR NO SPOTIFY</p>}
        {notice && <p className="library-notice" role="status">{notice}</p>}{trackError && <p className="library-error" role="alert">{trackError}</p>}
        {selected && !selected.playableItems && <p className="library-loading">Esta playlist aparece na sua biblioteca, mas o Spotify não libera suas faixas para este aplicativo. Abra a playlist no Spotify.</p>}
        <div className="library-track-list">{tracks.map((track, index) => <div className="library-track" key={`${track.id}-${index}`}><button className="library-track-play" onClick={() => play(track)} disabled={playingId !== null} aria-label={`Tocar ${track.title} no Spotify`}><span className="track-index">{String(index + 1).padStart(2, '0')}</span><Play size={15} fill="currentColor"/></button>{track.image ? <img src={track.image} alt=""/> : <span className="track-art-fallback"><Disc3 size={18}/></span>}<div className="library-track-copy"><strong>{track.title}</strong><small>{track.artist} · {track.album}</small></div><span className="track-duration">{formatTime(track.durationMs / 1000)}</span><a href={track.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${track.title} no Spotify`}><ArrowUpRight size={17}/></a></div>)}</div>
        {tracksBusy && <p className="library-loading">Carregando músicas…</p>}{trackNext && <button className="library-more" onClick={() => selected && loadTracks(selected, tracks.length)} disabled={tracksBusy}>Carregar mais músicas</button>}
      </div>
    </div>
  </section>;
}
