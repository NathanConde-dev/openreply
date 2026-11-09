# FAQ — Perguntas Frequentes

## Geral

### O que é o OpenReply?

OpenReply é uma ferramenta self-hosted de automação para Instagram. Quando alguém comenta uma palavra-chave no seu post, o app envia um DM automático com seu link/conteúdo.

É uma alternativa open-source ao ManyChat, sem mensalidades.

### Preciso pagar para usar?

O software é **100% gratuito** (licença MIT). Você paga apenas:

- Hospedagem (VPS: ~$5-20/mês ou Railway: ~$5-10/mês)
- Domínio (se não tiver): ~$10-15/ano
- E-mail (opcional): Resend tem plano grátis, ou use seu SMTP

### Posso vender acesso para clientes?

Sim! A licença MIT permite uso comercial. Você pode:

- Hospedar para clientes (SaaS)
- Customizar e revender
- Incluir em pacotes de serviço

Mantenha o copyright original na licença.

### É seguro? Vou ser banido do Instagram?

✅ **Sim, é seguro.** O OpenReply:

- Usa API oficial do Instagram (Meta Graph API)
- Não faz scraping ou automação de navegador
- Respeita rate limits do Instagram
- Nunca pede senha do Instagram

⚠️ **Você deve**:
- Cumprir Termos de Uso do Instagram
- Não enviar spam
- Respeitar limites (750 DMs/hora)
- Ter permissão dos usuários

## Instalação

### Qual é a forma mais fácil de instalar?

1. 🥇 **Railway** — 1 clique, mais caro (~$10/mês)
2. 🥈 **VPS com install.sh** — script automático, mais barato (~$5/mês)
3. 🥉 **Coolify/EasyPanel** — interface visual, intermediate

### Posso rodar em hospedagem compartilhada?

❌ **Não.** Hospedagem compartilhada não suporta:

- Docker
- Redis
- Workers em background
- Webhooks confiáveis

✅ Use VPS (Hostinger VPS, DigitalOcean, etc.)

### Preciso de domínio próprio?

✅ **Sim, para produção.** O Instagram exige HTTPS para webhooks.

Para **testes locais** pode usar `http://localhost:3000`, mas não receberá webhooks reais.

### Qual VPS vocês recomendam?

Todos esses funcionam:

- **Hostinger VPS** — $5-8/mês, Brasil
- **DigitalOcean** — $6/mês, global
- **Hetzner** — €4/mês, Europa
- **Vultr** — $6/mês, global
- **Linode (Akamai)** — $5/mês, global

Mínimo: 1GB RAM, 1 CPU.

### Quanto tempo leva para instalar?

- **Railway**: 5 minutos
- **VPS (com script)**: 10-15 minutos
- **VPS (manual)**: 30-45 minutos

## Configuração

### Onde pego as credenciais do Instagram?

Em [developers.facebook.com/apps](https://developers.facebook.com/apps):

1. Crie app tipo "Business"
2. Adicione produto "Instagram"
3. Copie **App ID** e **App Secret**

[Guia completo aqui](META-APP-SETUP.md)

### O que é o WEBHOOK_VERIFY_TOKEN?

É um token que **você inventa** para verificar webhooks. Gere com:

```bash
openssl rand -base64 32
```

Use o **mesmo valor** em:
- Arquivo `.env` → `WEBHOOK_VERIFY_TOKEN`
- Meta App Dashboard → Webhooks → Verify Token

### Preciso aprovar o app no Meta?

**Modo Development** (padrão):
- ❌ Não precisa aprovação
- ⚠️ Apenas contas de teste podem usar
- ✅ Funciona para você testar

**Modo Live** (produção):
- ✅ Precisa revisão do Meta
- ✅ Qualquer conta pode usar
- ⏱️ Leva alguns dias para aprovar

[Como enviar para revisão](META-APP-SETUP.md#8-ativar-modo-live-produção)

### Como adiciono múltiplos e-mails permitidos?

No `.env`, separe por vírgula:

```env
ALLOWED_EMAILS=email1@gmail.com,email2@empresa.com,email3@outro.com
```

## Funcionalidades

### Posso enviar imagens ou vídeos no DM?

❌ Não no momento. A API do Instagram para private replies só permite:

- Texto
- Até 2 botões com links
- Emojis

### Quantas contas Instagram posso conectar?

✅ **Ilimitadas.** Conecte quantas quiser.

Cada conta tem:
- Limite próprio de 750 DMs/hora
- Token próprio com expiração
- Campanhas independentes

### O app renova o token automaticamente?

✅ **Sim!** O worker roda job diário (3h AM UTC) que renova tokens que expiram nos próximos 10 dias.

Você não precisa reconectar manualmente.

### Como funciona o follow gate?

1. Usuário comenta no post
2. App verifica se ele segue você
3. **Se segue**: envia link automaticamente
4. **Se não segue**: pede para seguir e tocar botão
5. **No toque**: verifica de novo, envia link se seguindo

API do Instagram pode demorar ~20-60s para refletir novo follow.

### Posso agendar mensagens?

❌ Não diretamente. O OpenReply responde a **comentários** em tempo real.

Mas você pode:
- Agendar publicação de post (via Instagram)
- Quando comentarem, DM sai automático

### Funciona com Stories?

✅ **Sim!** Configure campanha com **"DM Trigger"** ativado.

Quando alguém responder seu Story com uma palavra-chave, o app envia o DM.

## Problemas Comuns

### Webhook não está chegando

**Verificações:**

```bash
# 1. App está acessível?
curl https://seudominio.com/api/webhook

# 2. SSL está ativo?
curl https://seudominio.com  # deve retornar 200

# 3. Firewall aberto?
ufw status  # portas 80 e 443 devem estar abertas

# 4. Verify token correto?
# Compare .env com Meta App Dashboard
```

**Solução:**
- Use HTTPS (obrigatório)
- Verifique se Caddy/Nginx está rodando
- Teste manualmente no Meta Dashboard

### DM não está sendo enviado

**Verificações:**

```bash
# 1. Worker está rodando?
docker compose ps worker  # deve estar Up

# 2. Logs do worker
docker compose logs -f worker

# 3. Health check
curl https://seudominio.com/api/health
```

**Causas comuns:**
- Worker não está rodando
- Redis não conectado
- Token do Instagram expirado
- Conta não é Business/Creator

### "Cannot connect to database"

**Soluções:**

```bash
# 1. Postgres está rodando?
docker compose ps postgres

# 2. Restart
docker compose restart postgres

# 3. Testar conexão
docker compose exec postgres psql -U openreply -d openreply -c "SELECT 1"

# 4. Ver logs
docker compose logs postgres
```

### Token do Instagram expirou

**Sintomas:**
- Erro "Invalid OAuth access token"
- Campanhas param de funcionar

**Soluções:**

1. **Automático** (recomendado):
   - Worker renova tokens automaticamente
   - Veja logs: `docker compose logs worker | grep "Token Refresh"`

2. **Manual**:
   - Vá em Integrações no dashboard
   - Clique em "Reconectar Instagram"
   - Autorize novamente

### App está lento

**Otimizações:**

1. **Aumentar RAM** do VPS (mínimo 1GB, recomendado 2GB)

2. **Aumentar workers** em `lib/queue/dm-worker.ts`:
   ```typescript
   concurrency: 10,  // aumentar de 5
   ```

3. **Redis persistence**: configure RDB em vez de AOF

4. **CDN**: use Cloudflare na frente

### Erro ao conectar Instagram

**Verificações:**

1. ✅ App está em modo Development OU Live
2. ✅ Conta Instagram é Business/Creator
3. ✅ Conta Instagram está como tester (se Development)
4. ✅ `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET` corretos
5. ✅ Redirect URI configurado: `https://seudominio.com/api/instagram/callback`

**Solução:**
- Vá no Meta Dashboard e verifique cada item acima

## Atualização

### Como atualizar para nova versão?

```bash
cd openreply
docker compose down
git pull origin main
docker compose build
docker compose up -d
```

### Vou perder dados ao atualizar?

❌ **Não!** Dados ficam em volumes Docker persistentes:

- `postgres_data` — banco de dados
- `redis_data` — fila

Só perderia se deletar os volumes manualmente.

### Como fazer backup?

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U openreply openreply > backup-$(date +%Y%m%d).sql

# Backup .env (IMPORTANTE!)
cp .env .env.backup

# Backup Redis (opcional)
docker compose exec redis redis-cli SAVE
docker compose cp redis:/data/dump.rdb redis-backup-$(date +%Y%m%d).rdb
```

**Agende backup automático** com cron:

```bash
crontab -e

# Adicione (backup diário às 3h AM):
0 3 * * * cd /home/openreply/openreply && docker compose exec postgres pg_dump -U openreply openreply > backup-$(date +\%Y\%m\%d).sql
```

## Performance

### Quantos DMs posso enviar por hora?

**Limite do Instagram**: 750 DMs/hora por conta

**Limite do OpenReply**: configurável, padrão respeita o do Instagram

Para múltiplas contas, cada uma tem limite próprio.

### Posso processar milhares de comentários?

✅ **Sim**, mas:

- Use VPS com 2GB+ RAM
- Aumente concurrency do worker
- Considere múltiplos workers (Kubernetes)

Para volume muito alto (10k+ comentários/dia), considere escalar horizontalmente.

### Como monitoro performance?

**Ferramentas:**

1. **Health Check**: `https://seudominio.com/api/health`
2. **Logs**: `docker compose logs -f`
3. **Recursos**: `docker stats`
4. **Uptime**: UptimeRobot, Healthchecks.io

**Métricas importantes:**
- Worker heartbeat age (< 1 min)
- Queue depth (< 100 waiting)
- Redis memory usage
- Postgres connections

## Segurança

### É seguro guardar tokens no banco?

✅ **Sim.** Tokens são criptografados com `ENCRYPTION_KEY` (AES-256).

⚠️ **Guarde o .env em segurança!** Se alguém pegar sua `ENCRYPTION_KEY`, pode descriptografar tokens.

### Devo expor Postgres/Redis?

❌ **Não!** No `docker-compose.yml`, apenas `web` tem porta pública.

Postgres e Redis ficam na rede interna do Docker.

### Como protejo o painel admin?

1. **ALLOWED_EMAILS**: apenas e-mails autorizados podem logar
2. **Magic links**: sem senha para roubar
3. **HTTPS**: obrigatório em produção
4. **Firewall**: feche portas desnecessárias

Opcionalmente:
- IP whitelist no Caddy/Nginx
- 2FA (não implementado nativamente)

## Customização

### Posso mudar o nome do app?

✅ **Sim!** Edite:

- `package.json` → `name`
- `README.md` → título
- `app/layout.tsx` → `<title>`

Não há marca registrada, faça fork à vontade.

### Posso adicionar funcionalidades?

✅ **Sim!** O código é MIT, você pode:

- Modificar qualquer coisa
- Adicionar features
- Integrar com outras APIs
- Rebranding completo

Contribuições upstream são bem-vindas (pull requests).

### Como adiciono outra língua na interface?

Veja [docs/localization.md](localization.md) no repositório original.

Atualmente suportado:
- 🇧🇷 Português (Brasil)
- 🇺🇸 Inglês
- 🇨🇳 Chinês Tradicional
- 🇷🇺 Russo

## Suporte

### Onde consigo ajuda?

1. 📖 [Documentação](../README.md)
2. 🐛 [GitHub Issues](https://github.com/NathanConde-dev/openreply/issues)
3. 💬 [Meta Setup](META-APP-SETUP.md)
4. 🎥 [Tutorial em Vídeo](#) (em breve)

### Posso contratar suporte?

Este fork é mantido por Nathan Conde. Para suporte pago ou consultoria, abra uma issue no GitHub.

### Como contribuo com o projeto?

1. Fork o repositório
2. Crie branch para sua feature
3. Faça commit com mensagens claras
4. Abra Pull Request
5. Aguarde review

Contribuições são bem-vindas! 🎉

---

**Não encontrou sua pergunta?**  
[Abra uma issue no GitHub](https://github.com/NathanConde-dev/openreply/issues)
