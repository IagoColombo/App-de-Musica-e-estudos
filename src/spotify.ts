import { invoke } from '@tauri-apps/api/core';

type Callback = { redirectUri: string; query: string };
type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
export type SpotifySession = { clientId: string; accessToken: string; refreshToken: string; expiresAt: number; scopes: string };
export type SpotifyTrack = { id: string; title: string; artist: string; album: string; image?: string; url: string; progressMs: number; durationMs: number; isPlaying: boolean };
export type SpotifyPlaylist = { id: string; name: string; image?: string; url: string; total: number; owner: string; playableItems: boolean };
export type SpotifyLibraryTrack = { id: string; uri: string; title: string; artist: string; album: string; image?: string; url: string; durationMs: number };
export type SpotifyPage<T> = { items: T[]; total: number; next: boolean };
const SESSION_KEY = 'lyra:spotifySession';
const REQUESTED_SCOPES = 'user-read-currently-playing user-read-playback-state playlist-read-private playlist-read-collaborative user-library-read user-modify-playback-state';
export const LIBRARY_SCOPES = ['user-read-playback-state', 'playlist-read-private', 'playlist-read-collaborative', 'user-library-read', 'user-modify-playback-state'];

export function loadSpotifySession(): SpotifySession | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (value && /^[a-zA-Z0-9]{32}$/.test(value.clientId) && typeof value.refreshToken === 'string' && value.refreshToken && typeof value.accessToken === 'string' && Number.isFinite(value.expiresAt)) {
      return { ...value, scopes: typeof value.scopes === 'string' ? value.scopes : '' };
    }
  } catch { /* Ignore an interrupted or invalid saved session. */ }
  return null;
}
export function saveSpotifySession(session: SpotifySession) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function clearSpotifySession() { localStorage.removeItem(SESSION_KEY); }
export function hasSpotifyLibraryAccess(session: SpotifySession) { return LIBRARY_SCOPES.every(scope => session.scopes.split(' ').includes(scope)); }

function randomHex() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function exchangeToken(params: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: string } | null;
    if (error?.error === 'invalid_grant') throw new Error('A autorização do Spotify expirou. Conecte novamente.');
    throw new Error(`Spotify recusou a autorização (${response.status}).`);
  }
  return response.json();
}

export async function connectSpotify(clientId: string): Promise<SpotifySession> {
  if (!/^[a-zA-Z0-9]{32}$/.test(clientId)) throw new Error('Informe um Client ID válido de 32 caracteres.');
  if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) throw new Error('A conexão com Spotify está disponível no aplicativo desktop.');
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(digest));
  const state = randomHex();
  const callback = await invoke<Callback>('spotify_authorize', { clientId, challenge, state });
  const query = new URLSearchParams(callback.query);
  if (query.get('state') !== state) throw new Error('A resposta do Spotify não corresponde a esta conexão.');
  if (query.has('error')) throw new Error('A autorização do Spotify foi cancelada ou recusada.');
  const code = query.get('code');
  if (!code) throw new Error('O Spotify não enviou um código de autorização.');
  const token = await exchangeToken(new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: callback.redirectUri, code_verifier: verifier }));
  return { clientId, accessToken: token.access_token, refreshToken: token.refresh_token || '', expiresAt: Date.now() + token.expires_in * 1000, scopes: token.scope || REQUESTED_SCOPES };
}

async function refreshSpotifySession(session: SpotifySession): Promise<SpotifySession> {
  const token = await exchangeToken(new URLSearchParams({ client_id: session.clientId, grant_type: 'refresh_token', refresh_token: session.refreshToken }));
  const next = { ...session, accessToken: token.access_token, refreshToken: token.refresh_token || session.refreshToken, expiresAt: Date.now() + token.expires_in * 1000, scopes: token.scope || session.scopes };
  saveSpotifySession(next);
  return next;
}

export async function spotifyRequest(session: SpotifySession, path: string, init?: RequestInit): Promise<{ session: SpotifySession; response: Response }> {
  const stored = loadSpotifySession();
  const mostRecent = stored?.clientId === session.clientId && stored.expiresAt > session.expiresAt ? stored : session;
  let activeSession = Date.now() > mostRecent.expiresAt - 60_000 ? await refreshSpotifySession(mostRecent) : mostRecent;
  const request = (token: string) => fetch(`https://api.spotify.com/v1${path}`, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  let response = await request(activeSession.accessToken);
  if (response.status === 401 && activeSession.refreshToken) {
    activeSession = await refreshSpotifySession(activeSession);
    response = await request(activeSession.accessToken);
  }
  if (response.status === 401) throw new Error('A sessão do Spotify expirou. Conecte novamente.');
  if (response.status === 429) throw new Error('Limite de consultas do Spotify atingido. Tente mais tarde.');
  return { session: activeSession, response };
}

export async function getSpotifyTrack(session: SpotifySession): Promise<{ session: SpotifySession; track: SpotifyTrack | null }> {
  const { session: activeSession, response } = await spotifyRequest(session, '/me/player/currently-playing');
  if (response.status === 204) return { session: activeSession, track: null };
  if (response.status === 403) throw new Error('A conta ou o aplicativo Spotify não tem acesso a esta API.');
  if (!response.ok) throw new Error(`Falha ao consultar o Spotify (${response.status}).`);
  const data = await response.json();
  if (data.currently_playing_type !== 'track' || !data.item) return { session: activeSession, track: null };
  return { session: activeSession, track: {
    id: data.item.id,
    title: data.item.name,
    artist: data.item.artists?.map((artist: { name: string }) => artist.name).join(', ') || '',
    album: data.item.album?.name || '',
    image: data.item.album?.images?.[0]?.url,
    url: data.item.external_urls?.spotify || `https://open.spotify.com/track/${data.item.id}`,
    progressMs: data.progress_ms || 0,
    durationMs: data.item.duration_ms || 0,
    isPlaying: Boolean(data.is_playing),
  } };
}

export async function getSpotifyPlaylists(session: SpotifySession, offset = 0): Promise<{ session: SpotifySession; page: SpotifyPage<SpotifyPlaylist> }> {
  const { session: activeSession, response } = await spotifyRequest(session, `/me/playlists?limit=50&offset=${offset}`);
  if (!response.ok) throw new Error(`Não foi possível carregar suas playlists (${response.status}).`);
  const data = await response.json();
  return { session: activeSession, page: { total: data.total || 0, next: Boolean(data.next), items: (data.items || []).filter(Boolean).map((item: any) => ({
    id: item.id, name: item.name, image: item.images?.[0]?.url, url: item.external_urls?.spotify || `https://open.spotify.com/playlist/${item.id}`,
    total: item.items?.total ?? item.tracks?.total ?? 0, owner: item.owner?.display_name || item.owner?.id || 'Spotify', playableItems: Boolean(item.items || item.tracks),
  })) } };
}

export async function getSpotifyPlaylistTracks(session: SpotifySession, playlistId: string, offset = 0): Promise<{ session: SpotifySession; page: SpotifyPage<SpotifyLibraryTrack> }> {
  const savedTracks = playlistId === '__liked__';
  const path = savedTracks ? `/me/tracks?limit=50&offset=${offset}` : `/playlists/${encodeURIComponent(playlistId)}/items?limit=50&offset=${offset}`;
  const { session: activeSession, response } = await spotifyRequest(session, path);
  if (response.status === 403) throw new Error(savedTracks ? 'O Spotify não liberou suas músicas curtidas. Atualize as permissões da conta.' : 'O Spotify permite visualizar as faixas apenas de playlists suas ou colaborativas neste tipo de aplicativo.');
  if (!response.ok) throw new Error(`Não foi possível carregar as faixas (${response.status}).`);
  const data = await response.json();
  return { session: activeSession, page: { total: data.total || 0, next: Boolean(data.next), items: (data.items || []).map((entry: any) => entry.item || entry.track).filter((item: any) => item?.type === 'track' && item?.id).map((item: any) => ({
    id: item.id, uri: item.uri || `spotify:track:${item.id}`, title: item.name, artist: item.artists?.map((artist: { name: string }) => artist.name).join(', ') || '',
    album: item.album?.name || '', image: item.album?.images?.[0]?.url, url: item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`, durationMs: item.duration_ms || 0,
  })) } };
}

export async function spotifyPlayerCommand(session: SpotifySession, path: string, method: 'PUT' | 'POST', body?: object): Promise<SpotifySession> {
  const { session: activeSession, response } = await spotifyRequest(session, `/me/player/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (response.status === 404) throw new Error('Abra o Spotify em um dispositivo e inicie uma faixa antes de tocar pelo LyraFlow.');
  if (response.status === 403) throw new Error('A reprodução remota exige Spotify Premium e a permissão de controlar o player.');
  if (!response.ok) throw new Error(`O Spotify recusou o comando (${response.status}).`);
  return activeSession;
}

export async function playSpotifyTrack(session: SpotifySession, track: SpotifyLibraryTrack, playlist?: SpotifyPlaylist, visibleTracks: SpotifyLibraryTrack[] = []): Promise<SpotifySession> {
  const context = playlist && playlist.id !== '__liked__';
  const selectedIndex = visibleTracks.findIndex(item => item.id === track.id);
  return spotifyPlayerCommand(session, 'play', 'PUT', context
    ? { context_uri: `spotify:playlist:${playlist.id}`, offset: { uri: track.uri } }
    : { uris: selectedIndex >= 0 ? visibleTracks.slice(selectedIndex, selectedIndex + 100).map(item => item.uri) : [track.uri] });
}
