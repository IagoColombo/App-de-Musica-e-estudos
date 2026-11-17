import { invoke } from '@tauri-apps/api/core';

type Callback = { redirectUri: string; query: string };
type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };
export type SpotifySession = { clientId: string; accessToken: string; refreshToken: string; expiresAt: number };
export type SpotifyTrack = { id: string; title: string; artist: string; album: string; image?: string; url: string; progressMs: number; durationMs: number; isPlaying: boolean };

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
  if (!response.ok) throw new Error(`Spotify recusou a autorização (${response.status}).`);
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
  return { clientId, accessToken: token.access_token, refreshToken: token.refresh_token || '', expiresAt: Date.now() + token.expires_in * 1000 };
}

export async function getSpotifyTrack(session: SpotifySession): Promise<{ session: SpotifySession; track: SpotifyTrack | null }> {
  let activeSession = session;
  if (Date.now() > session.expiresAt - 60_000 && session.refreshToken) {
    const token = await exchangeToken(new URLSearchParams({ client_id: session.clientId, grant_type: 'refresh_token', refresh_token: session.refreshToken }));
    activeSession = { ...session, accessToken: token.access_token, refreshToken: token.refresh_token || session.refreshToken, expiresAt: Date.now() + token.expires_in * 1000 };
  }
  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: { Authorization: `Bearer ${activeSession.accessToken}` } });
  if (response.status === 204) return { session: activeSession, track: null };
  if (response.status === 401) throw new Error('A sessão expirou. Conecte o Spotify novamente.');
  if (response.status === 403) throw new Error('A conta ou o aplicativo Spotify não tem acesso a esta API.');
  if (response.status === 429) throw new Error('Limite de consultas do Spotify atingido. Aguarde um pouco.');
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
