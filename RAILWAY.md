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
| `INSTAGRAM_APP_ID` | App ID do Facebook/Meta | Da Meta App Dashboard |
| `INSTAGRAM_APP_SECRET` | App Secret do Facebook/Meta | Da Meta App Dashboard |

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
3. Adicione o produto "Instagram Basic Display" ou "Instagram API"

### 2. Configurar OAuth Redirect

No painel da Meta App:

1. Vá em **Configurações básicas** → **Instagram Basic Display**
2. Em **Valid OAuth Redirect URIs**, adicione:
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
npm ci
npm run build          # = prisma generate && next build
npx prisma migrate deploy

# Start
npm run start          # = next start (porta $PORT)
```

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
