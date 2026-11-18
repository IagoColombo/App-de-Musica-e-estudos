use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SpotifyCallback {
  redirect_uri: String,
  query: String,
}

#[derive(Clone, Default, serde::Serialize)]
struct FocusSnapshot { active: bool, domains: Vec<String> }

struct FocusState(Arc<Mutex<FocusSnapshot>>);

const FOCUS_BEGIN: &str = "# LyraFlow Focus BEGIN";
const FOCUS_END: &str = "# LyraFlow Focus END";
static HOSTS_LOCK: Mutex<()> = Mutex::new(());

fn apply_windows_block(active: bool, domains: Vec<String>) -> std::io::Result<usize> {
  let hosts = std::path::PathBuf::from(std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into()))
    .join("System32\\drivers\\etc\\hosts");
  let original = std::fs::read_to_string(&hosts)?;
  if !active && !original.contains(FOCUS_BEGIN) { return Ok(0); }
  let (before, after) = if let Some((before, rest)) = original.split_once(FOCUS_BEGIN) {
    let (_, after) = rest.split_once(FOCUS_END).ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "Bloco LyraFlow incompleto no hosts"))?;
    (before.trim_end_matches(['\r', '\n']), after.trim_start_matches(['\r', '\n']))
  } else { (original.trim_end_matches(['\r', '\n']), "") };
  let mut content = before.to_string();
  let mut accepted = Vec::new();
  if active {
    for domain in domains {
      let domain = domain.trim().to_ascii_lowercase();
      if valid_domain(&domain) && !accepted.contains(&domain) { accepted.push(domain); }
    }
    content.push_str("\r\n");
    content.push_str(FOCUS_BEGIN);
    content.push_str("\r\n");
    for domain in &accepted {
      content.push_str(&format!("0.0.0.0 {domain}\r\n0.0.0.0 www.{domain}\r\n::1 {domain}\r\n::1 www.{domain}\r\n"));
    }
    content.push_str(FOCUS_END);
  }
  if !after.is_empty() {
    content.push_str("\r\n");
    content.push_str(after.trim_end_matches(['\r', '\n']));
  }
  content.push_str("\r\n");
  std::fs::write(&hosts, content)?;
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    let _ = std::process::Command::new("ipconfig.exe").arg("/flushdns").creation_flags(0x0800_0000).status();
  }
  Ok(accepted.len())
}

#[tauri::command]
async fn set_windows_block(active: bool, domains: Vec<String>) -> Result<usize, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let _guard = HOSTS_LOCK.lock().map_err(|e| e.to_string())?;
    match apply_windows_block(active, domains.clone()) {
      Ok(count) => Ok(count),
      Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
        run_elevated_focus_helper(active, &domains)?;
        let hosts = std::path::PathBuf::from(std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into())).join("System32\\drivers\\etc\\hosts");
        let saved = std::fs::read_to_string(hosts).map_err(|e| e.to_string())?;
        if saved.contains(FOCUS_BEGIN) != active { return Err("O Windows não confirmou o bloqueio. Tente novamente e aceite a permissão.".into()); }
        Ok(if active { domains.iter().filter(|domain| valid_domain(domain)).count() } else { 0 })
      }
      Err(error) => Err(format!("Não foi possível atualizar o bloqueio do Windows: {error}")),
    }
  }).await.map_err(|error| error.to_string())?
}

#[cfg(target_os = "windows")]
fn run_elevated_focus_helper(active: bool, domains: &[String]) -> Result<(), String> {
  use std::os::windows::process::CommandExt;
  const CREATE_NO_WINDOW: u32 = 0x0800_0000;
  let exe = std::env::current_exe().map_err(|e| e.to_string())?;
  let quoted_exe = exe.to_string_lossy().replace('\'', "''");
  let mode = if active { "on" } else { "off" };
  let safe_domains: Vec<String> = domains.iter().map(|domain| domain.trim().to_ascii_lowercase()).filter(|domain| valid_domain(domain)).collect();
  let arguments = format!("--lyraflow-focus-helper {mode} {}", safe_domains.join(","));
  let script = format!("$ErrorActionPreference='Stop'; try {{ $p=Start-Process -FilePath '{quoted_exe}' -ArgumentList '{arguments}' -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode }} catch {{ exit 3 }}");
  let status = std::process::Command::new("powershell.exe")
    .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &script])
    .creation_flags(CREATE_NO_WINDOW)
    .status().map_err(|e| format!("Não foi possível pedir permissão ao Windows: {e}"))?;
  if status.success() { Ok(()) } else { Err("Permissão de administrador recusada ou bloqueio não aplicado.".into()) }
}

#[cfg(not(target_os = "windows"))]
fn run_elevated_focus_helper(_active: bool, _domains: &[String]) -> Result<(), String> {
  Err("Bloqueio nativo disponível apenas no Windows.".into())
}

fn valid_domain(domain: &str) -> bool {
  domain.len() <= 253 && domain.split('.').count() >= 2 && domain.split('.').all(|part| {
    !part.is_empty() && !part.starts_with('-') && !part.ends_with('-') && part.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
  })
}

#[tauri::command]
fn set_focus_state(state: tauri::State<'_, FocusState>, active: bool, domains: Vec<String>) -> Result<(), String> {
  let valid: Vec<String> = domains.into_iter().filter(|domain| {
    !domain.is_empty() && domain.len() <= 253 && domain.split('.').count() >= 2 &&
    domain.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'.' || byte == b'-')
  }).collect();
  *state.0.lock().map_err(|e| e.to_string())? = FocusSnapshot { active, domains: valid };
  Ok(())
}

fn serve_focus(state: Arc<Mutex<FocusSnapshot>>) {
  let Ok(listener) = TcpListener::bind("127.0.0.1:47832") else { return };
  for connection in listener.incoming() {
    let Ok(mut stream) = connection else { continue };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let mut buffer = [0u8; 1024];
    let Ok(size) = stream.read(&mut buffer) else { continue };
    if !String::from_utf8_lossy(&buffer[..size]).starts_with("GET /focus ") { continue }
    let snapshot = state.lock().map(|state| state.clone()).unwrap_or_default();
    let body = serde_json::to_string(&snapshot).unwrap_or_else(|_| "{\"active\":false,\"domains\":[]}".into());
    let reply = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
    let _ = stream.write_all(reply.as_bytes());
  }
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
    // Spotify's dashboard currently validates loopback callbacks more reliably
    // when a concrete port is registered. Keep this port local and stable.
    let listener = TcpListener::bind("127.0.0.1:47831").map_err(|e| format!("Não foi possível abrir a porta local 47831: {e}"))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let redirect_uri = format!("http://127.0.0.1:{}/spotify-callback", listener.local_addr().map_err(|e| e.to_string())?.port());
    let auth_url = format!("https://accounts.spotify.com/authorize?response_type=code&client_id={client_id}&scope=user-read-currently-playing%20playlist-read-private%20playlist-read-collaborative%20user-library-read%20user-modify-playback-state&redirect_uri={}&code_challenge_method=S256&code_challenge={challenge}&state={state}",
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
  let mut args = std::env::args().skip(1);
  if args.next().as_deref() == Some("--lyraflow-focus-helper") {
    let active = args.next().as_deref() == Some("on");
    let domains = args.next().unwrap_or_default().split(',').filter(|value| !value.is_empty()).map(str::to_owned).collect();
    std::process::exit(if apply_windows_block(active, domains).is_ok() { 0 } else { 1 });
  }
  let focus_state = Arc::new(Mutex::new(FocusSnapshot::default()));
  let focus_server_state = focus_state.clone();
  std::thread::spawn(move || serve_focus(focus_server_state));
  tauri::Builder::default()
    .manage(FocusState(focus_state))
    .invoke_handler(tauri::generate_handler![spotify_authorize, set_focus_state, set_windows_block])
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
