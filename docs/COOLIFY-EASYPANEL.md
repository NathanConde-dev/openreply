# Deploy no Coolify e EasyPanel

Guia para instalar o OpenReply usando Coolify ou EasyPanel com Docker Compose.

## Coolify

[Coolify](https://coolify.io) é uma plataforma self-hosted de PaaS open-source (alternativa ao Heroku/Vercel).

### Pré-requisitos

- Coolify instalado em seu servidor
- Domínio configurado

### Passo a Passo

1. **Criar Novo Projeto** no Coolify

2. **Adicionar Recurso** → **Docker Compose**

3. **Configurar Repository**:
   - Source: `https://github.com/NathanConde-dev/openreply.git`
   - Branch: `main`
   - Base Directory: `/`
   - Compose File: `docker-compose.yml`

4. **Configurar Variáveis de Ambiente**:

   No Coolify, vá em **Environment Variables** e adicione:

   ```env
   # Básico
   NEXTAUTH_URL=https://app.seudominio.com
   NEXTAUTH_SECRET=<gere com: openssl rand -base64 32>
   CRON_SECRET=<pode ser igual ao NEXTAUTH_SECRET>
   ENCRYPTION_KEY=<gere com: openssl rand -hex 32>
   
   # PostgreSQL (gerado pelo Coolify)
   POSTGRES_USER=openreply
   POSTGRES_PASSWORD=<gere com: openssl rand -base64 32>
   
   # E-mail
   ALLOWED_EMAILS=seu@email.com
   EMAIL_FROM=Seu App <login@seudominio.com>
   RESEND_API_KEY=<sua-api-key-do-resend>
   
   # Instagram/Meta
   INSTAGRAM_APP_ID=<seu-app-id>
   INSTAGRAM_APP_SECRET=<seu-app-secret>
   FACEBOOK_APP_SECRET=<seu-app-secret>
   WEBHOOK_VERIFY_TOKEN=<gere com: openssl rand -base64 32>
   META_GRAPH_API_VERSION=v25.0
   ```

5. **Configurar Domínio**:
   - Adicione seu domínio em **Domains**
   - O Coolify gera SSL automaticamente

6. **Deploy**:
   - Clique em **Deploy**
   - Aguarde o build e deploy

7. **Verificar**:
   - Acesse `https://app.seudominio.com/api/health`
   - Deve retornar status `ok`

### Notas Importantes

- **Volumes persistentes**: O Coolify gerencia volumes automaticamente
- **Logs**: Acesse via interface do Coolify ou `docker compose logs`
- **Restart**: Use a interface do Coolify para restart
- **Caddy não é necessário**: Coolify tem seu próprio proxy reverso

### Troubleshooting

**Build falhou**:
- Verifique se todas as variáveis de ambiente estão definidas
- Veja logs detalhados na interface do Coolify

**Serviço não inicia**:
- Verifique se `DATABASE_URL` e `REDIS_URL` estão corretos
- No Coolify, esses são gerados automaticamente, use:
  ```env
  DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/openreply
  REDIS_URL=redis://redis:6379
  ```

---

## EasyPanel

[EasyPanel](https://easypanel.io) é outra alternativa self-hosted de PaaS, similar ao Coolify.

### Pré-requisitos

- EasyPanel instalado em seu servidor
- Domínio configurado

### Passo a Passo

1. **Criar Novo Projeto** no EasyPanel

2. **Adicionar Serviço** → **Docker Compose**

3. **Configurar Git Repository**:
   - Repository URL: `https://github.com/NathanConde-dev/openreply.git`
   - Branch: `main`
   - Compose File Path: `docker-compose.yml`

4. **Configurar Environment Variables**:

   No EasyPanel, adicione as mesmas variáveis listadas acima (seção Coolify)

5. **Configurar Domínio**:
   - Vá em **Domains** e adicione seu domínio
   - Habilite **SSL** (Let's Encrypt automático)

6. **Deploy**:
   - Clique em **Deploy**
   - Aguarde o processo

7. **Verificar**:
   - Acesse `https://app.seudominio.com/api/health`

### Notas Importantes

- **Volumes**: EasyPanel gerencia volumes automaticamente
- **Logs**: Acesse via interface ou terminal integrado
- **Reverse Proxy**: EasyPanel tem proxy próprio, não precisa do Caddy
- **Auto-deploy**: Configure webhook para deploy automático no push

### Troubleshooting

**Erro de conexão com banco**:
- Verifique se os serviços `postgres` e `redis` estão up
- No EasyPanel, veja status em **Services**

**Porta não acessível**:
- Certifique-se de que o domínio está apontando para o IP correto
- Verifique se o SSL está ativado

---

## Comparação: Coolify vs EasyPanel

| Recurso | Coolify | EasyPanel |
|---------|---------|-----------|
| Interface | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Facilidade | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Open Source | ✅ Sim | ✅ Sim |
| Grátis | ✅ Sim | ✅ Sim |
| Auto SSL | ✅ Sim | ✅ Sim |
| Docker Compose | ✅ Sim | ✅ Sim |
| GitHub Integration | ✅ Sim | ✅ Sim |
| Logs em Tempo Real | ✅ Sim | ✅ Sim |

Ambos são excelentes opções. Escolha baseado em preferência pessoal.

---

## Alternativa: Dokku

[Dokku](https://dokku.com) é um mini-Heroku self-hosted. Funciona diferente (usa buildpacks em vez de Docker Compose), mas também é uma opção.

### Setup Rápido Dokku

```bash
# No servidor Dokku
dokku apps:create openreply

# Adicionar Postgres
dokku postgres:create openreply-db
dokku postgres:link openreply-db openreply

# Adicionar Redis
dokku redis:create openreply-redis
dokku redis:link openreply-redis openreply

# Configurar variáveis
dokku config:set openreply \
  NEXTAUTH_URL=https://app.seudominio.com \
  NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  ENCRYPTION_KEY=$(openssl rand -hex 32) \
  ALLOWED_EMAILS=seu@email.com \
  # ... restante das vars

# Deploy
git remote add dokku dokku@seu-servidor:openreply
git push dokku main
```

---

## Recomendação

Para **maior controle** e **facilidade**:
1. 🥇 **Coolify** — interface moderna, muitas features
2. 🥈 **EasyPanel** — mais simples, menos configuração
3. 🥉 **Dokku** — mais tradicional, estilo Heroku

Para **simplicidade máxima**:
- Use **Railway** (1-click deploy)

Para **controle total**:
- Use **Docker Compose direto** no VPS

---

## Próximos Passos

Após deploy:

1. [Configurar Meta App](META-APP-SETUP.md)
2. Testar webhook: `https://app.seudominio.com/api/webhook`
3. Conectar Instagram no dashboard
4. Criar primeira campanha

---

## Suporte

- 📖 [Documentação VPS](VPS-INSTALL.md)
- 🐛 [Issues](https://github.com/NathanConde-dev/openreply/issues)
- 💬 [Meta Setup](META-APP-SETUP.md)
