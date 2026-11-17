# LyraFlow

Base visual em React, TypeScript e Vite. Usa GSAP para entrada dos painéis e ScrollTrigger para revelar versos ao rolar. A preferência do sistema por movimento reduzido desativa esses efeitos.

## Executar

```bash
npm install
npm run dev
```

## App Windows com Tauri

O projeto já inclui a estrutura Tauri. Para abrir uma janela desktop ou criar um instalador, instale Rust com o toolchain MSVC e o Visual Studio Build Tools com **Desktop development with C++**. O WebView2 já foi detectado neste computador. Depois, execute:

```bash
npm run desktop:dev
npm run desktop:build
```

O instalador NSIS será gerado em `src-tauri/target/release/bundle/nsis/`. Os ícones ainda são os padrões do scaffold Tauri. A janela desktop ainda mostra os mesmos dados locais do front-end; nenhuma permissão para bloquear apps/sites foi adicionada.

Para gerar apenas o executável, use `npm run desktop:exe`. Ele aparece em `src-tauri/target/release/lyraflow.exe`. Neste computador, a compilação do executável passou; o empacotamento NSIS ainda falhou com `Acesso negado` durante a extração do NSIS no cache local do Tauri.

## Conectar Spotify

1. Crie um aplicativo no [Spotify for Developers](https://developer.spotify.com/dashboard).
2. Nas configurações dele, cadastre a URI de redirecionamento `http://127.0.0.1/spotify-callback` (sem porta, conforme o suporte a porta dinâmica em endereços loopback). Copie o **Client ID** público. Não é necessário usar o Client Secret.
3. Abra o LyraFlow desktop, informe o Client ID no painel Spotify e clique em **Conectar Spotify**. Autorize o acesso no navegador. O app pede apenas `user-read-currently-playing`.
4. O painel consulta a faixa em reprodução a cada 15 segundos. A sessão fica somente na memória do aplicativo; ao fechá-lo, conecte novamente. O Client ID é salvo localmente.

O Spotify pode exigir conta Premium do dono do aplicativo em modo de desenvolvimento e limitar os usuários autorizados. A integração lê metadados da faixa; o áudio e as letras do painel local não são substituídos pelo Spotify.

## Estado atual

- Player com reprodução de arquivo de áudio escolhido pelo usuário para cada faixa. Sem arquivo associado, a linha do tempo é simulada. As letras são exemplos locais e só sincronizam com o áudio se o arquivo corresponder à faixa e aos tempos cadastrados.
- `LyricsProxy` consulta `LyricsService`, mantém cache em memória e mostra hits e misses no painel.
- Favoritos, histórico, faixa escolhida para foco e lista de sites persistem no navegador local.
- Modo Estudo / Trabalho com faixa escolhida, temporizador e lista visual de sites. **Ainda não bloqueia aplicativos ou sites.**
- Links de faixas Spotify e vídeos YouTube são identificados e exibidos em players incorporados. A leitura automática da faixa Spotify usa a API oficial após autorização. YouTube não é monitorado fora do app; importação de playlists e letras reais ainda não estão conectadas.

O planejamento completo está no `PROJECT.md`, se copiado para este diretório.