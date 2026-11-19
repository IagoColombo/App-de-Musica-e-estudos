# Busca do YouTube para LyraFlow

Este Worker guarda a chave do YouTube no Cloudflare. A chave não entra no código do aplicativo.

1. Entre na sua conta Cloudflare: `npx wrangler login`.
2. Na pasta `worker`, publique: `npx wrangler deploy`.
3. Configure a chave nova como segredo: `npx wrangler secret put YOUTUBE_API_KEY` e cole-a apenas no prompt local. Não use a chave antiga mostrada no chat.
4. Copie a URL `https://lyraflow-youtube-search.<sua-conta>.workers.dev` informada pelo deploy.
5. Na raiz do LyraFlow, configure `VITE_YOUTUBE_SEARCH_URL` com essa URL em `.env.local`. Remova `VITE_YOUTUBE_API_KEY` desse arquivo, pois uma variável `VITE_` com a chave seria embutida no executável.
6. Reinicie `npm run desktop:dev` ou gere um novo instalador.

O endpoint público é `/search?q=nome`. Ele não revela a chave, mas qualquer pessoa com a URL pode consumir a cota. Para uso restrito, adicione autenticação ou limites antes de compartilhar o executável.
