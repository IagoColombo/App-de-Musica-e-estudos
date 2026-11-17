use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SpotifyCallback {
  redirect_uri: String,
  query: String,
}

#[tauri::command]
async fn spotify_authorize(client_id: String, challenge: String, state: String) -> Result<SpotifyCallback, String> {
  if !client_id.bytes().all(|b| b.is_ascii_alphanumeric()) || client_id.len() != 32 {
    return Err("Client ID inválido.".into());
  }
  if challenge.len() != 43 || !challenge.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') {
    return Err("Desafio de autorização inválido.".into());
  }
  if state.len() != 32 || !state.bytes().all(|b| b.is_ascii_hexdigit()) {
    return Err("Estado de autorização inválido.".into());
  }
  tauri::async_runtime::spawn_blocking(move || {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let redirect_uri = format!("http://127.0.0.1:{}/spotify-callback", listener.local_addr().map_err(|e| e.to_string())?.port());
    let auth_url = format!("https://accounts.spotify.com/authorize?response_type=code&client_id={client_id}&scope=user-read-currently-playing&redirect_uri={}&code_challenge_method=S256&code_challenge={challenge}&state={state}",
      redirect_uri.replace(':', "%3A").replace('/', "%2F"));
    #[cfg(target_os = "windows")]
    std::process::Command::new("rundll32.exe").args(["url.dll,FileProtocolHandler", &auth_url]).spawn().map_err(|e| format!("Não foi possível abrir o navegador: {e}"))?;
    #[cfg(not(target_os = "windows"))]
    return Err("Autorização externa disponível apenas no Windows nesta versão.".into());
    let deadline = Instant::now() + Duration::from_secs(120);
    while Instant::now() < deadline {
      match listener.accept() {
        Ok((mut stream, _)) => {
          stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
          let mut buffer = [0u8; 4096];
          let size = stream.read(&mut buffer).map_err(|e| e.to_string())?;
          let request = String::from_utf8_lossy(&buffer[..size]);
          let path = request.split_whitespace().nth(1).unwrap_or("");
          if !path.starts_with("/spotify-callback?") { continue; }
          let query = path.split_once('?').map(|(_, q)| q.to_string()).unwrap_or_default();
          let body = "<html><body style='font-family:sans-serif;background:#102023;color:#eee;padding:3rem'><h2>Spotify conectado ao LyraFlow</h2><p>Você pode fechar esta aba e voltar ao aplicativo.</p></body></html>";
          let reply = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
          let _ = stream.write_all(reply.as_bytes());
          return Ok(SpotifyCallback { redirect_uri, query });
        }
        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(100)),
        Err(e) => return Err(e.to_string()),
      }
    }
    Err("Tempo de autorização esgotado. Tente conectar novamente.".into())
  }).await.map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![spotify_authorize])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
