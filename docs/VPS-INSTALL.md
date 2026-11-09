# Instalação em VPS (Docker Compose)

Guia completo para instalar o OpenReply em qualquer VPS usando Docker Compose.

**Testado em:** Hostinger VPS, DigitalOcean, AWS EC2, Google Cloud, Vultr, Linode

## Pré-requisitos

- VPS com Ubuntu 20.04+ ou Debian 11+ (mínimo 1GB RAM)
- Domínio apontando para o IP do VPS
- Acesso SSH root ou sudo

## Passo 1: Preparar o Servidor

### 1.1 Conectar via SSH

```bash
ssh root@seu-ip-aqui
```

### 1.2 Atualizar Sistema

```bash
apt update && apt upgrade -y
```

### 1.3 Instalar Docker

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | bash

# Iniciar Docker
systemctl enable docker
systemctl start docker

# Verificar
docker --version
```

### 1.4 Instalar Docker Compose

```bash
# Docker Compose já vem com Docker Engine moderno
docker compose version
```

Se não estiver instalado:

```bash
apt install docker-compose-plugin -y
```

### 1.5 (Opcional) Criar Usuário Não-Root

```bash
# Criar usuário
adduser openreply

# Adicionar ao grupo docker
usermod -aG docker openreply

# Mudar para o usuário
su - openreply
```

## Passo 2: Clonar Repositório

```bash
# Clone
git clone https://github.com/NathanConde-dev/openreply.git
cd openreply
```

## Passo 3: Executar Instalador

```bash
# Tornar executável
chmod +x install.sh

# Executar
./install.sh
```

O instalador irá perguntar:

1. **Domínio**: `https://app.seudominio.com` ou `http://seu-ip:3000` para teste
2. **Seu e-mail**: para login (ex.: `seu@email.com`)
3. **E-mail FROM**: remetente dos magic links (ex.: `login@seudominio.com`)
4. **Email provider**: Resend, SMTP ou configurar depois
5. **Instagram App ID e Secret**: do Meta Developers

O instalador gera automaticamente:
- ✅ `.env` com todos os segredos
- ✅ `NEXTAUTH_SECRET` (32 bytes)
- ✅ `ENCRYPTION_KEY` (64 hex chars)
- ✅ `POSTGRES_PASSWORD` (25 chars)
- ✅ `WEBHOOK_VERIFY_TOKEN` (32 bytes)

## Passo 4: Configurar Domínio

### Opção A: Usar Caddy (HTTPS Automático - Recomendado)

1. Edite `.env` e descomente:

```env
DOMAIN=app.seudominio.com
ACME_EMAIL=seu@email.com
WEB_PORT=3000
```

2. Edite `docker-compose.yml` e descomente o serviço `caddy`:

```yaml
caddy:
  image: caddy:2-alpine
  restart: unless-stopped
  ports:
    - '80:80'
    - '443:443'
    - '443:443/udp'
  environment:
    DOMAIN: ${DOMAIN}
    EMAIL: ${ACME_EMAIL}
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile:ro
    - caddy_data:/data
    - caddy_config:/config
  depends_on:
    - web
  networks:
    - openreply-public
```

3. Descomente os volumes do Caddy também:

```yaml
volumes:
  caddy_data:
    driver: local
  caddy_config:
    driver: local
```

4. **Configure DNS**: Adicione registro A apontando seu domínio para o IP do VPS

5. **Abra portas no firewall**:

```bash
# Ubuntu/Debian (ufw)
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# CentOS/Rocky (firewalld)
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

### Opção B: Sem Caddy (Nginx/Traefik separado ou IP direto)

Se você já tem um reverse proxy ou quer acessar direto por IP:

1. No `.env`, mantenha:

```env
NEXTAUTH_URL=http://seu-ip:3000  # ou seu domínio
```

2. No `docker-compose.yml`, a porta 3000 já está exposta:

```yaml
ports:
  - '3000:3000'  # ou '${WEB_PORT:-3000}:3000'
```

3. **Abra porta no firewall**:

```bash
ufw allow 3000/tcp
```

⚠️ **Instagram exige HTTPS** para webhooks. Use Caddy ou configure seu próprio SSL.

## Passo 5: Iniciar Serviços

```bash
# Iniciar em background
docker compose up -d

# Ver logs
docker compose logs -f

# Ver apenas um serviço
docker compose logs -f web
docker compose logs -f worker
```

### Verificar Status

```bash
# Ver serviços rodando
docker compose ps

# Deve mostrar:
# web     - Up (healthy)
# worker  - Up (healthy)
# postgres - Up (healthy)
# redis   - Up (healthy)
# caddy   - Up (se habilitado)
```

## Passo 6: Verificar Instalação

### Health Check

```bash
curl http://localhost:3000/api/health
# ou
curl https://app.seudominio.com/api/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "checks": {
    "database": { "status": "ok" },
    "redis": { "status": "ok" },
    "queue": { "status": "ok" },
    "worker": { "healthy": true }
  }
}
```

### Logs do Worker

```bash
docker compose logs worker | grep "Started"
```

Deve mostrar:

```
[DM Worker] Started
[Token Refresh] Scheduled daily at 3 AM UTC
[Follower Snapshot] Scheduled daily at 4 AM UTC
```

## Passo 7: Configurar Meta App

Siga o guia completo: [META-APP-SETUP.md](META-APP-SETUP.md)

Resumo:

1. Vá em [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Crie app tipo "Business"
3. Configure:
   - Redirect: `https://app.seudominio.com/api/instagram/callback`
   - Webhook: `https://app.seudominio.com/api/webhook`
   - Verify Token: (copie de `WEBHOOK_VERIFY_TOKEN` no `.env`)
   - Campos: `comments`, `messages`

## Passo 8: Primeiro Acesso

1. Acesse: `https://app.seudominio.com`
2. Clique em **"Entrar"**
3. Digite o e-mail que você configurou em `ALLOWED_EMAILS`
4. Você receberá um magic link por e-mail
5. Clique no link para fazer login
6. Conecte sua conta Instagram em **Integrações**

## Comandos Úteis

### Gerenciar Serviços

```bash
# Parar tudo
docker compose down

# Reiniciar
docker compose restart

# Reiniciar apenas um serviço
docker compose restart web

# Ver logs em tempo real
docker compose logs -f

# Ver uso de recursos
docker stats
```

### Atualizar para Nova Versão

```bash
# Parar serviços
docker compose down

# Puxar última versão
git pull origin main

# Rebuildar imagens
docker compose build

# Subir novamente
docker compose up -d

# Ver logs
docker compose logs -f
```

### Backup

```bash
# Backup do PostgreSQL
docker compose exec postgres pg_dump -U openreply openreply > backup.sql

# Backup do Redis (opcional)
docker compose exec redis redis-cli SAVE
docker compose cp redis:/data/dump.rdb ./redis-backup.rdb

# Backup do .env (IMPORTANTE!)
cp .env .env.backup
```

### Restaurar Backup

```bash
# Restaurar PostgreSQL
docker compose exec -T postgres psql -U openreply openreply < backup.sql

# Restaurar Redis
docker compose cp ./redis-backup.rdb redis:/data/dump.rdb
docker compose restart redis
```

## Troubleshooting

### Erro: "Cannot connect to database"

```bash
# Ver status do Postgres
docker compose ps postgres

# Ver logs
docker compose logs postgres

# Testar conexão
docker compose exec postgres psql -U openreply -d openreply -c "SELECT 1"
```

### Erro: "Worker não está processando jobs"

```bash
# Ver se worker está rodando
docker compose ps worker

# Reiniciar worker
docker compose restart worker

# Ver logs
docker compose logs -f worker
```

### Erro: "Cannot access Redis"

```bash
# Testar Redis
docker compose exec redis redis-cli ping
# Deve retornar: PONG

# Reiniciar Redis
docker compose restart redis
```

### Porta 80/443 já em uso

Se você já tem outro serviço usando essas portas:

1. Opção 1: Pare o serviço existente
2. Opção 2: Mude as portas do Caddy no `docker-compose.yml`:

```yaml
ports:
  - '8080:80'    # HTTP na porta 8080
  - '8443:443'   # HTTPS na porta 8443
```

3. Opção 3: Use seu reverse proxy existente e aponte para `localhost:3000`

### Webhook não está chegando

1. Teste se a URL está acessível:

```bash
curl https://app.seudominio.com/api/webhook
```

2. Verifique firewall:

```bash
ufw status
```

3. Verifique Caddy:

```bash
docker compose logs caddy
```

4. Teste o verify token:

```bash
curl "https://app.seudominio.com/api/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=test"
```

## Segurança

### Firewall Mínimo

```bash
# Permitir SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### SSL/TLS

Use Caddy (recomendado) ou configure manualmente:

- **Let's Encrypt** via Certbot
- **Cloudflare** como proxy
- **Outro provedor** de certificados

### Manter Atualizado

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Atualizar Docker
apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin -y

# Atualizar OpenReply
cd openreply
git pull origin main
docker compose build
docker compose up -d
```

## Monitoramento

### Logs Centralizados

Configure Watchtower para updates automáticos:

```yaml
# Adicione ao docker-compose.yml
watchtower:
  image: containrrr/watchtower
  restart: unless-stopped
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  command: --interval 86400 --label-enable
```

### Uptime Monitoring

Use ferramentas como:

- **UptimeRobot** (gratuito)
- **Healthchecks.io** (gratuito)
- **Cronitor**

Configure para monitorar: `https://app.seudominio.com/api/health`

## Performance

### Para VPS com 1GB RAM

Limite recursos no `docker-compose.yml`:

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          memory: 512M
  worker:
    deploy:
      resources:
        limits:
          memory: 256M
```

### Para alto volume

Se você espera milhares de comentários/dia:

1. Aumente RAM para 2GB+
2. Aumente workers do BullMQ em `lib/queue/dm-worker.ts`:

```typescript
concurrency: 10,  // aumentar de 5 para 10
```

3. Configure Redis persistence mais agressiva

## Próximos Passos

1. [Configurar Meta App](META-APP-SETUP.md)
2. [Criar primeira campanha](../README.md#funcionalidades)
3. [Monitorar logs e health check](../README.md#troubleshooting)
4. [Backup regular](##backup)

## Suporte

- 📖 [Documentação completa](../README.md)
- 🐛 [Issues no GitHub](https://github.com/NathanConde-dev/openreply/issues)
- 💬 [Meta App Setup](META-APP-SETUP.md)
