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

O instalador NSIS será gerado em `src-tauri/target/release/bundle/nsis/`. Feche o LyraFlow antes de compilar: o Windows impede substituir um `.exe` que esteja aberto. Use `npm run desktop:dev` para ver alterações do front-end durante o desenvolvimento; o executável de distribuição só muda após `npm run desktop:build`.

Para gerar apenas o executável, use `npm run desktop:exe`. Ele aparece em `src-tauri/target/release/lyraflow.exe`. Builds publicados de cada commit enviado para `main` estão em [Releases do GitHub](https://github.com/IagoColombo/App-de-Musica-e-estudos/releases); o repositório é privado, então o download requer acesso à conta autorizada. O workflow envia apenas `lyraflow.exe` e o instalador NSIS, nunca os dados locais do usuário.

## Conectar Spotify

1. O **Client ID público deste projeto** é `f2b88e25eefc497f886ba7a8ca13c1db`. A URI de redirecionamento cadastrada no [Spotify for Developers](https://developer.spotify.com/dashboard) é `http://127.0.0.1:47831/spotify-callback`. Não é necessário usar o Client Secret e ele não deve ser publicado.
2. Abra o LyraFlow desktop, informe esse Client ID no painel Spotify da sidebar e clique em **Conectar Spotify**. Autorize o acesso no navegador. O app pede leitura da faixa atual, das playlists e das músicas curtidas, além de permissão para controlar a reprodução no Spotify. Quem já havia conectado uma versão anterior precisa clicar em **Atualizar permissões** uma vez.
3. O painel consulta a faixa em reprodução a cada 5 segundos. A sessão e o Client ID ficam salvos localmente no perfil do LyraFlow; ao reiniciar, o app renova o acesso automaticamente enquanto a autorização do Spotify for válida. **Desconectar** apaga a sessão local. Os tokens não entram no repositório nem nos builds.
4. Clique em **Spotify** na sidebar para ver suas playlists e músicas curtidas. Escolha uma faixa para enviá-la ao aplicativo Spotify que estiver ativo no seu dispositivo. O áudio não é reproduzido dentro do LyraFlow.

O controle de reprodução exige Spotify Premium e um dispositivo ativo. No modo de desenvolvimento da API, playlists seguidas podem aparecer sem liberar sua lista de faixas; playlists suas ou colaborativas são acessíveis. Autorizações antigas ou expiradas podem exigir nova conexão. O player local e suas letras continuam independentes.

## Bloqueio de sites no Chrome ou Edge

1. Abra `chrome://extensions` (Chrome) ou `edge://extensions` (Edge) e ative **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha a pasta `focus-extension` deste projeto.
3. No LyraFlow desktop, configure a lista de sites, ative Estudo / Trabalho e inicie o temporizador. A extensão consulta o app a cada 30 segundos e bloqueia esses domínios enquanto a sessão estiver em andamento. Ao pausar ou fechar o app, a extensão remove as regras na próxima consulta.

O bloqueio atua somente no navegador em que a extensão foi instalada. Não bloqueia outros aplicativos, navegadores sem a extensão ou páginas já abertas até serem recarregadas.

## Bloqueio nativo no Windows

No painel Estudo / Trabalho, escolha **Windows** e inicie uma sessão. O LyraFlow altera apenas um bloco marcado no arquivo `hosts` do Windows; essa alteração exige permissão de administrador. O pedido do Windows executa somente um auxiliar temporário para editar o `hosts`: a janela principal permanece aberta. Ao pausar ou encerrar a sessão, o app pede permissão novamente para remover o bloco. Se o app fechar inesperadamente, reabra-o e desative o modo de foco para restaurar o acesso. Em computadores sem permissão de administrador, use a extensão.

## Estado atual

- Player local com arquivo de áudio escolhido pelo usuário para cada faixa, controles de reprodução aleatória e repetição. Sem arquivo associado, a reprodução e a busca na linha do tempo ficam desativadas. As letras locais são exemplos e só sincronizam com o áudio se o arquivo corresponder à faixa e aos tempos cadastrados.
- `LyricsProxy` consulta `LyricsService`, mantém cache em memória e mostra hits e misses no painel. Quando o Spotify está em foco, o painel mostra a consulta real ao LRCLIB e a tradução via MyMemory.
- Favoritos, histórico, faixa escolhida para foco e lista de sites persistem no navegador local.
- Modo Estudo / Trabalho com playlist local configurável, temporizador e lista de sites. A próxima faixa toca automaticamente quando há áudio associado; a sessão pausa se faltar o arquivo. O modo Windows bloqueia os domínios escolhidos via `hosts`; a extensão bloqueia no Chrome/Edge. Aplicativos não são bloqueados.
- Links de faixas Spotify e vídeos YouTube são identificados e exibidos em players incorporados. Após autorização, o LyraFlow mostra as playlists do Spotify e solicita a reprodução de faixas no cliente Spotify. YouTube não é monitorado fora do app.

O planejamento completo está no `PROJECT.md`, se copiado para este diretório.
