# Deploy no Railway

Este guia explica como fazer deploy do OpenReply no Railway para uso próprio (self-hosted).

## Arquitetura

O deploy consiste em 4 serviços:

1. **web** — servidor Next.js (público, exposto na internet)
2. **worker** — processador de DMs e jobs em background (privado)
3. **Postgres** — banco de dados (privado)
4. **Redis** — fila de jobs (privado)

Apenas o serviço `web` precisa estar exposto publicamente. Os demais (worker, Postgres, Redis) ficam na rede privada do Railway.

## Passo a passo

### 1. Criar projeto no Railway

1. Acesse [railway.app](https://railway.app) e crie um novo projeto
2. Escolha "Empty Project"

### 2. Adicionar Postgres

1. Clique em "+ New"
2. Selecione "Database" → "Add PostgreSQL"
3. O Railway cria automaticamente e expõe a variável `DATABASE_URL`

### 3. Adicionar Redis

1. Clique em "+ New"
2. Selecione "Database" → "Add Redis"
3. O Railway cria automaticamente e expõe a variável `REDIS_URL`

### 4. Adicionar serviço Web

1. Clique em "+ New"
2. Selecione "GitHub Repo" e conecte este repositório (ou "Empty Service" se preferir deploy manual)
3. Configure as variáveis de ambiente (veja seção abaixo)
4. Em "Settings" → "Networking", habilite um domínio público (Generate Domain)
5. Em "Settings" → "Deploy", configure:
   - **Build Command**: `npm ci && npm run build && npx prisma migrate deploy`
   - **Start Command**: `npm run start`
6. Em "Settings", configure `PORT` (Railway injeta automaticamente)

### 5. Adicionar serviço Worker

1. Clique em "+ New"
2. Selecione "GitHub Repo" e escolha o mesmo repositório (ou clone do web)
3. Configure as mesmas variáveis de ambiente do serviço web (exceto `NEXTAUTH_URL`)
4. Em "Settings" → "Deploy", configure:
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm run worker`
5. Em "Settings" → "Networking", mantenha privado (sem domínio público)

## Variáveis de ambiente

### Serviço Web

Configure estas variáveis no serviço **web**:

#### Obrigatórias

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | URL do Postgres | `${{Postgres.DATABASE_URL}}` (referência Railway) |
| `REDIS_URL` | URL do Redis | `${{Redis.REDIS_URL}}` (referência Railway) |
| `NEXTAUTH_URL` | URL pública do app | `https://seu-app.up.railway.app` |
| `NEXTAUTH_SECRET` | Segredo de 32+ chars | Gere com `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Chave hex de 32 bytes (64 chars) | Gere com `openssl rand -hex 32` |
| `ALLOWED_EMAILS` | Emails permitidos (separados por vírgula) | `seu@email.com,outro@email.com` |
| `INSTAGRAM_APP_ID` | App ID do Facebook/Meta | Da Meta App Dashboard (veja nota abaixo) |
| `INSTAGRAM_APP_SECRET` | App Secret do Facebook/Meta | Da Meta App Dashboard |

**Nota sobre INSTAGRAM_APP_ID:** Se seu app foi criado recentemente (out/nov 2026+) e usa "API setup with Unified login" em vez de "API setup with Instagram login", use o **Meta App ID** (não há Instagram App ID separado). Configure também `META_LOGIN_CONFIG_ID` (veja seção Opcionais).

#### Opcionais (email)

Escolha **UM** dos métodos:

**Opção 1: Resend (padrão)**

| Variável | Descrição |
|----------|-----------|
| `RESEND_API_KEY` | API key do Resend |
| `EMAIL_FROM` | Remetente dos emails de login |

**Opção 2: SMTP próprio**

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `EMAIL_SERVER` | URL SMTP completa | `smtp://user:pass@smtp.gmail.com:587` |
| `EMAIL_FROM` | Remetente dos emails de login | `Seu App <login@seudominio.com>` |

#### Opcionais (avançado)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `CRON_SECRET` | Bearer token para `/api/cron/*` | Usa `NEXTAUTH_SECRET` se não definido |
| `META_GRAPH_API_VERSION` | Versão da Meta Graph API | `v25.0` |
| `META_LOGIN_CONFIG_ID` | ID de configuração do Meta Unified Login (apenas para apps novos out/nov 2026+) | - |

**Sobre META_LOGIN_CONFIG_ID:** Apps criados recentemente (out/nov 2026+) não têm mais "API setup with Instagram login" no painel da Meta. O painel mostra "API setup with Unified login is not available for newer apps. Your app uses API setup with Unified login instead." Nesses casos:

1. Use o **Meta App ID** como `INSTAGRAM_APP_ID` (não há Instagram App ID separado)
2. Crie uma configuração no Facebook Login for Business (dashboard da Meta)
3. Configure a variação de login como "General" e o tipo de token como "System-user access token (SUAT)" com expiração "Never"
4. Adicione o asset de negócio "Instagram account" como obrigatório
5. Adicione as permissões: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `instagram_content_publish`, `instagram_manage_insights`, `instagram_manage_events`, `ads_management`, `ads_read`
6. Copie o Configuration ID e defina como `META_LOGIN_CONFIG_ID`

Quando `META_LOGIN_CONFIG_ID` está definido, o OpenReply usa o fluxo de autorização do Facebook em vez do Instagram.

### Serviço Worker

Configure as mesmas variáveis do serviço **web**, **EXCETO**:

- ❌ Não precisa de `NEXTAUTH_URL` (o worker não serve HTTP)
- ✅ Precisa de todas as outras (DATABASE_URL, REDIS_URL, ENCRYPTION_KEY, etc.)

Use referências do Railway para conectar aos bancos:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

## Configuração na Meta (Facebook App)

### 1. Criar App na Meta

1. Acesse [developers.facebook.com](https://developers.facebook.com/apps)
2. Crie um novo app do tipo "Business"
3. Adicione o caso de uso apropriado (veja nota abaixo)

**Nota sobre apps novos (out/nov 2026+):** Apps criados recentemente não têm mais acesso ao "Instagram API with Instagram login". O painel mostra "API setup with Unified login" em vez disso. Nesse caso, siga as instruções adicionais na seção "Meta Unified Login" abaixo.

### 2. Configurar OAuth Redirect

**Para apps com Instagram Login (apps antigos):**

1. Vá em **Configurações básicas** → **Instagram Basic Display** ou **Instagram API**
2. Em **Valid OAuth Redirect URIs**, adicione:
   ```
   https://seu-app.up.railway.app/api/instagram/callback
   ```

**Para apps com Unified Login (apps novos out/nov 2026+):**

1. Vá em **Facebook Login for Business** → **Settings**
2. Na configuração que você criou, adicione em **Valid OAuth Redirect URIs**:
   ```
   https://seu-app.up.railway.app/api/instagram/callback
   ```

### 3. Configurar Webhooks

1. Vá em **Webhooks** → **Instagram**
2. Configure:
   - **Callback URL**: `https://seu-app.up.railway.app/api/webhook`
   - **Verify Token**: qualquer string secreta (você define)
   - **Campos**: marque `comments` e `messages`
3. Guarde o **Verify Token** — você precisará configurá-lo no app

### 4. Adicionar tester

1. Vá em **Funções** → **Funções**
2. Adicione a conta Instagram que você quer conectar como "Instagram Tester"
3. A conta precisa aceitar o convite no Instagram

### 5. Modo Live

Quando estiver pronto para produção:

1. Complete a revisão de app da Meta
2. Ative o modo "Live" (por padrão fica em Development)
3. Apenas contas de tester funcionam em modo Development

## Meta Unified Login (Apps Novos out/nov 2026+)

Se você criou seu app Meta recentemente e o painel mostra "API setup with Unified login is not available for newer apps", siga estas etapas adicionais:

### 1. Encontrar seus IDs

No Meta App Dashboard:

- **App ID**: Vá em Settings → Basic. Este é seu `INSTAGRAM_APP_ID` (não há Instagram App ID separado para apps novos)
- **App Secret**: Na mesma página, clique em "Show" ao lado de App Secret. Este é seu `INSTAGRAM_APP_SECRET`
- **Facebook App Secret**: Este é o mesmo que o App Secret acima. Use o mesmo valor para `FACEBOOK_APP_SECRET`

### 2. Criar Configuração de Login

1. No painel da Meta, vá em **Facebook Login for Business**
2. Clique em **Create Configuration**
3. Configure:
   - **Login variation**: General
   - **Access token type**: System-user access token (SUAT)
   - **Expiration**: Never
   - **Business assets**: Marque "Instagram account" como **Required**
   - **Permissions**: Adicione as seguintes permissões:
     - `instagram_basic`
     - `instagram_manage_messages`
     - `instagram_manage_comments`
     - `instagram_content_publish`
     - `instagram_manage_insights`
     - `instagram_manage_events`
     - `ads_management` (opcional)
     - `ads_read` (opcional)
4. Salve a configuração
5. Copie o **Configuration ID** e defina como `META_LOGIN_CONFIG_ID` no Railway

### 3. Registrar URL de Callback

Na configuração que você criou:

1. Vá em **Settings**
2. Em **Valid OAuth Redirect URIs**, adicione:
   ```
   https://seu-app.up.railway.app/api/instagram/callback
   ```

### 4. Configurar Webhook

O webhook funciona da mesma forma que com Instagram Login:

1. Vá em **Webhooks** → **Instagram**
2. Configure:
   - **Callback URL**: `https://seu-app.up.railway.app/api/webhook`
   - **Verify Token**: o valor de `WEBHOOK_VERIFY_TOKEN`
   - **Campos**: marque `comments` e `messages`

**Nota importante:** Com o Unified Login, a inscrição do webhook para a conta Instagram é feita automaticamente pela configuração de caso de uso. Certifique-se de que o webhook está subscrito ao evento `instagram` no nível do app.

## Verificar deployment

### Health check

Após o deploy, acesse:

```
https://seu-app.up.railway.app/api/health
```

Resposta esperada (status 200):

```json
{
  "status": "ok",
  "checks": {
    "database": { "status": "ok" },
    "redis": { "status": "ok" },
    "queue": { "status": "ok", "counts": {...} },
    "worker": { "healthy": true, ... }
  }
}
```

### Logs

Verifique os logs em Railway:

- **Web**: deve mostrar `ready started server on 0.0.0.0:3000`
- **Worker**: deve mostrar `[DM Worker] Started` e `[Token Refresh] Scheduled daily at 3 AM UTC`

## Renovação automática do token Instagram

O token do Instagram expira em ~60 dias. Este deploy inclui renovação automática:

- O **worker** agenda um job diário (3h AM UTC) que renova tokens que expiram nos próximos 10 dias
- Não precisa de cron externo ou serviço adicional
- Logs aparecem com prefixo `[Token Refresh]`

Se um token falhar ao renovar, um evento é registrado no banco (`operationalEvent` table) com `source = TOKEN_REFRESH`.

## Troubleshooting

### Worker não está processando jobs

1. Verifique se o serviço worker está rodando (não crashou)
2. Veja os logs do worker em Railway
3. Acesse `/api/health` e verifique se `worker.healthy = true`

### Migrações do Prisma não rodaram

O comando de build do serviço **web** inclui `npx prisma migrate deploy`. Se falhar:

1. Verifique se `DATABASE_URL` está correta
2. Rode manualmente: `npx prisma migrate deploy` no shell do Railway
3. Ou use Railway CLI: `railway run npx prisma migrate deploy`

### Emails de login não chegam

**Se usando Resend:**
- Verifique se `RESEND_API_KEY` está correto
- Verifique se o domínio em `EMAIL_FROM` está verificado no Resend

**Se usando SMTP:**
- Verifique se `EMAIL_SERVER` tem o formato correto: `smtp://user:pass@host:porta`
- Teste a conexão SMTP externamente

### ALLOWED_EMAILS vazio em produção

Por segurança, o app **bloqueia login** em produção se `ALLOWED_EMAILS` estiver vazio. 

Configure a variável com emails separados por vírgula:

```
ALLOWED_EMAILS=seu@email.com,outro@email.com
```

## Estrutura de comandos

### Web (Next.js)

```bash
# Build
npm ci                 # usa .npmrc (legacy-peer-deps=true) para resolver peer deps
npm run build          # = prisma generate && next build
npx prisma migrate deploy

# Start
npm run start          # = next start (porta $PORT)
```

**Nota sobre peer dependencies:** O projeto usa `.npmrc` com `legacy-peer-deps=true` para resolver conflitos de peer dependencies entre nodemailer 10.4.0 (corrigida vulnerabilidade crítica) e next-auth beta.32. Isso é necessário no node:20-slim (npm 10) usado no Dockerfile.

### Worker

```bash
# Build
npm ci
npm run build          # = prisma generate && next build (gera Prisma client)

# Start
npm run worker         # = tsx worker/dm-worker.ts
```

O Dockerfile suporta ambos os modos — o comando de start é definido no Railway por serviço.

## Segredos

Gere as chaves necessárias:

```bash
# NEXTAUTH_SECRET (32+ caracteres)
openssl rand -base64 32

# ENCRYPTION_KEY (32 bytes = 64 chars hex)
openssl rand -hex 32
```

Nunca commite esses valores no repositório — adicione apenas no Railway.

## Domínio customizado (opcional)

1. No Railway, vá em Settings → Networking do serviço **web**
2. Clique em "Custom Domain"
3. Adicione seu domínio e configure o DNS (CNAME para o domínio gerado pelo Railway)
4. Atualize `NEXTAUTH_URL` para o novo domínio

## Suporte

- **Documentação oficial**: [README.md](./README.md)
- **Issues**: [github.com/diwen-app/openreply/issues](https://github.com/diwen-app/openreply/issues)
- **Documentação Railway**: [docs.railway.app](https://docs.railway.app)
