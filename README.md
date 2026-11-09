<div align="center">

# OpenReply (Fork)

Automação de Instagram: comentário → DM automático

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)

[English](README.en.md) | **Português**

</div>

---

**Fork otimizado para instalação fácil em português.**  
Projeto original: [diwenne/openreply](https://github.com/diwenne/openreply) por Diwen Huang.

---

Alguém comenta `LINK` no seu reel, e o OpenReply envia um DM automático com seu link. Essa é a ideia toda. O OpenReply monitora os comentários nos seus posts do Instagram e, quando um comentário contém uma palavra-chave que você configurou, envia uma mensagem privada automaticamente via API oficial do Meta.

OpenReply é software livre (MIT), roda na sua própria infraestrutura, sem limites de usuários ou planos pagos. Custos de hospedagem são por sua conta.

> **Este é um fork otimizado para deploy em português brasileiro.**  
> Inclui instalação simplificada para Railway, VPS (Docker Compose), Coolify/EasyPanel e similares.

## 🚀 Instalação Rápida

### Railway (1 clique)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/PLACEHOLDER)

> 📝 O template do Railway será publicado por Nathan Conde. Link em breve.

[Instruções detalhadas →](docs/RAILWAY-DEPLOY.md)

### VPS / Cloud (Docker Compose)

```bash
# Clone o repositório
git clone https://github.com/NathanConde-dev/openreply.git
cd openreply

# Execute o instalador (gera .env e configura tudo)
chmod +x install.sh
./install.sh

# Inicie os serviços
docker compose up -d

# Veja os logs
docker compose logs -f
```

**Testado em:**
- ✅ Hostinger VPS
- ✅ DigitalOcean Droplets
- ✅ AWS EC2
- ✅ Google Cloud Compute
- ✅ Qualquer VPS com Docker

[Guia completo de instalação VPS →](docs/VPS-INSTALL.md)

### Coolify / EasyPanel

Use o mesmo `docker-compose.yml`. Instruções:  
[Coolify/EasyPanel Deploy →](docs/COOLIFY-EASYPANEL.md)

### Hospedagem Compartilhada

❌ **Não recomendado.** Hospedagem compartilhada (ex.: plano compartilhado Hostinger) não suporta Docker, Redis ou workers em background.  
✅ **Use VPS** (a partir de ~$5/mês) para rodar o OpenReply.

## 📋 Requisitos

### Mínimos

- **Node.js** 20+ (se rodar sem Docker)
- **PostgreSQL** 14+
- **Redis** 6+
- **Domínio** com HTTPS (obrigatório para webhooks do Instagram)
- **Meta App** configurado (ou [Zernio](https://zernio.com))

### Recomendado para Produção

- **VPS** com 1GB+ RAM (Railway, DigitalOcean, Hostinger VPS, etc.)
- **Docker** + **Docker Compose** (instalação mais fácil)
- **Caddy** ou **Nginx** para HTTPS automático (incluído no docker-compose.yml)

## ✨ Funcionalidades

- ✅ **Palavra-chave → DM** — Monitora comentários e envia DM automático
- ✅ **Resposta pública opcional** — Comenta publicamente além do DM
- ✅ **Gatilho por DM** — Responde a DMs com palavras-chave (útil para Stories)
- ✅ **Links rastreados** — Veja quem clicou nos seus links
- ✅ **2 botões de link** — Envie até 2 links com botões clicáveis no DM
- ✅ **Portão de seguidores** — Exige follow antes de enviar o link
- ✅ **Personalização** — Use `{username}` para chamar pelo nome
- ✅ **Rate limiting** — Respeita limite do Instagram (750 DMs/hora)
- ✅ **Múltiplas contas** — Conecte várias contas Instagram
- ✅ **Workspaces e funções** — Owner, admin, membro
- ✅ **Templates de campanha** — Comece de modelos prontos
- ✅ **Interface em português** — Totalmente traduzido
- ✅ **Inbox integrado** — Leia e responda DMs no painel
- ✅ **Logs completos** — Veja cada envio, falha e motivo
- ✅ **Renovação automática de token** — Não expira token do Instagram
- ✅ **Snapshot de seguidores** — Histórico de crescimento automático

## 🔧 Configuração

### 1. App no Meta/Facebook

Você precisa criar um app no [Meta Developers](https://developers.facebook.com):

1. Criar app tipo "Business"
2. Adicionar produto "Instagram"
3. Configurar redirect: `https://seudominio.com/api/instagram/callback`
4. Configurar webhook: `https://seudominio.com/api/webhook`
5. Ativar campos: `comments`, `messages`

[Guia completo passo a passo →](docs/META-APP-SETUP.md)

### 2. Variáveis de Ambiente

O `install.sh` gera automaticamente, mas as principais são:

```env
# URL pública
NEXTAUTH_URL=https://seudominio.com

# Segredos (gerados automaticamente)
NEXTAUTH_SECRET=...
ENCRYPTION_KEY=...

# E-mail permitido para login
ALLOWED_EMAILS=seu@email.com

# Credenciais do Meta App
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
WEBHOOK_VERIFY_TOKEN=...

# Banco de dados (automático no Docker)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

Ver todas: [.env.example](.env.example)

## 📚 Documentação

- [Instalação no Railway](docs/RAILWAY-DEPLOY.md)
- [Instalação em VPS](docs/VPS-INSTALL.md)
- [Coolify/EasyPanel](docs/COOLIFY-EASYPANEL.md)
- [Configuração do Meta App](docs/META-APP-SETUP.md)
- [Docker Compose Reference](docker-compose.yml)
- [FAQ e Troubleshooting](docs/FAQ.md)

## 🤝 Suporte

- 📖 Documentação completa em `docs/`
- 🐛 Issues: [GitHub Issues](https://github.com/NathanConde-dev/openreply/issues)
- 💬 Dúvidas: abra uma issue

## 📹 Tutorial em Vídeo

🎥 Tutorial completo no YouTube por Nathan Conde: **[em breve]**

## 🛠️ Stack Tecnológica

- **Frontend/Backend:** Next.js 16, React 19
- **Banco de dados:** PostgreSQL 16
- **Fila de jobs:** Redis + BullMQ
- **Auth:** NextAuth.js 5 (magic links)
- **Deployment:** Docker + Docker Compose
- **Reverse Proxy:** Caddy (HTTPS automático)

## 📝 Licença

MIT License

Copyright (c) 2026 Anish Raj  
Copyright (c) 2026 Diwen Huang  
Copyright (c) 2026 Nathan Conde (modifications)

Veja [LICENSE](LICENSE) para detalhes.

## 🌟 Créditos

**Projeto original:** [OpenReply](https://github.com/diwenne/openreply) por [Diwen Huang](https://github.com/diwenne)

**Este fork adiciona:**
- Instalação simplificada (Railway 1-click, script VPS)
- Documentação em português brasileiro
- Docker Compose de produção pronto
- HTTPS automático com Caddy
- Jobs agendados internos (sem cron externo)
- Validações de segurança aprimoradas

## ⚠️ Aviso Legal

OpenReply usa a API oficial do Instagram (Meta Graph API). Você é responsável por:

- Cumprir os [Termos de Uso do Instagram](https://help.instagram.com/581066165581870)
- Cumprir as [Políticas da Plataforma Meta](https://developers.facebook.com/docs/development/release/policies/)
- Respeitar limites de taxa (rate limits)
- Não enviar spam ou conteúdo não solicitado

O OpenReply não contorna restrições do Instagram e opera dentro das regras oficiais da API.

---

<div align="center">

**Se este projeto te ajudou, deixe uma ⭐ no repositório!**

[⬆ Voltar ao topo](#openreply-fork)

</div>
