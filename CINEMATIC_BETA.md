# Cinematic Karaoke Beta

A branch parte da Premium Motion Beta com a correção de origem do YouTube.

## Implementação

O seletor Visual oferece Normal, Cinematic e Immersive, com preferência persistida. Immersive expande a seção de letras, mantendo o seletor acessível para sair. A reprodução segue nos players existentes. A demonstração usa letra fictícia e um relógio identificado como simulado, com pausa e busca independentes dos serviços externos.

O hook existente useLyricsAnimation coordena a entrada e a centralização. SplitText é usado para texto simples, com revert na limpeza. Texto com spans temporizados conserva seus próprios elementos. KaraokeText constrói uma timeline pausada por verso e busca a posição informada pelo player, inclusive após retrocesso. A timeline não é reconstruída a cada atualização de progresso. A paleta já existente alimenta os gradientes e o destaque tipográfico.

Timestamps LRC por palavra são usados quando válidos. Timestamps por linha produzem preenchimento estimado. O Spotify ainda extrapola entre suas consultas, sujeito à frequência das atualizações remotas. O modo demonstrativo possui timings sintéticos explicitamente identificados.

## Avaliação

Execute npm ci e npm run dev na branch feature/cinematic-karaoke-beta. Use o seletor Visual e abra Demonstração na seção de letras. Para comparar com a apresentação anterior, escolha Normal. O controle Karaokê continua disponível.

Build TypeScript/Vite aprovado. Chromium validou modos, preferência persistida, pausa e busca da demonstração, fechamento durante reprodução e movimento reduzido em viewport de 390 px. O teste local existente validou áudio WAV, pausa, busca por verso, troca de faixa, teclado e parser sem exceções JavaScript.

O teste reproduzível está em tests/cinematic_browser.py. Requer Python com playwright instalado, Chromium em /usr/bin/chromium e Vite em 127.0.0.1:5173. Execute python tests/cinematic_browser.py.

## Limitações desta implementação

Esta versão oferece uma primeira composição visual. O fundo usa gradientes estáticos dependentes da paleta, sem movimento ambiental. A entrada por palavra acontece na demonstração e em versos simples divididos por SplitText. Versos com apenas timestamps por linha mantêm preenchimento por verso. A frequência de atualização segue os clocks existentes, portanto a continuidade visual ainda depende da cadência de cada fonte.

Reprodução real autenticada no Spotify, mudança externa de dispositivo, validação visual em WebView2/Tauri e medição de FPS em hardware modesto continuam pendentes. Rust/Cargo indisponível no ambiente de execução. O modo Immersive expande as letras e oferece saída pelo seletor, mas os transportes existentes ficam fora da área expandida.

## Arquivos

src/CinematicKaraoke.tsx, src/Karaoke.tsx, src/App.tsx, src/useLyraMotion.ts, src/styles/immersive.css, tests/cinematic_browser.py e este documento.

## Ajuste após avaliação visual

Cinematic tornou-se o visual único da seção. O seletor foi removido e preferências antigas de modo não alteram a apresentação. O verso ativo usa a cor da paleta e preenchimento na tipografia, com fundo e borda de seleção transparentes. Build e teste Chromium atualizados passaram.
