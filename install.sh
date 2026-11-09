#!/bin/bash
set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Instalação do OpenReply (Fork)${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não encontrado!${NC}"
    echo "Instale o Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Verificar se Docker Compose está instalado
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose não encontrado!${NC}"
    echo "Instale o Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker e Docker Compose encontrados${NC}"
echo ""

# Verificar se .env já existe
if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env já existe!${NC}"
    read -p "Deseja sobrescrevê-lo? (s/N): " overwrite
    if [[ ! $overwrite =~ ^[Ss]$ ]]; then
        echo -e "${BLUE}Instalação cancelada.${NC}"
        exit 0
    fi
    mv .env .env.backup.$(date +%s)
    echo -e "${GREEN}✓ Backup do .env anterior criado${NC}"
fi

# Coletar informações do usuário
echo -e "${BLUE}Vamos configurar seu ambiente:${NC}"
echo ""

# Domínio
read -p "Domínio (ex.: app.seudominio.com) ou http://localhost:3000 para teste local: " DOMAIN
if [[ -z "$DOMAIN" ]]; then
    DOMAIN="http://localhost:3000"
fi

# Validar se é http:// ou https://
if [[ ! "$DOMAIN" =~ ^https?:// ]]; then
    DOMAIN="https://$DOMAIN"
fi

# Email permitido
echo ""
read -p "Seu e-mail (permitido para login): " USER_EMAIL
if [[ -z "$USER_EMAIL" ]]; then
    echo -e "${RED}❌ E-mail é obrigatório!${NC}"
    exit 1
fi

# Email FROM para magic links
echo ""
read -p "E-mail remetente para magic links (ex.: login@seudominio.com): " EMAIL_FROM
if [[ -z "$EMAIL_FROM" ]]; then
    EMAIL_FROM="OpenReply <login@example.com>"
fi

# Resend API Key (opcional)
echo ""
echo -e "${YELLOW}Configuração de e-mail para magic links:${NC}"
echo "1. Resend (https://resend.com) - recomendado"
echo "2. SMTP próprio (Gmail, SendGrid, etc.)"
echo "3. Configurar depois"
read -p "Escolha (1/2/3): " EMAIL_CHOICE

RESEND_API_KEY=""
EMAIL_SERVER=""

case $EMAIL_CHOICE in
    1)
        read -p "Resend API Key (re_...): " RESEND_API_KEY
        ;;
    2)
        read -p "URL do servidor SMTP (ex.: smtps://user%40gmail.com:senha@smtp.gmail.com:465): " EMAIL_SERVER
        ;;
    *)
        echo -e "${YELLOW}⚠️  Configure EMAIL depois no .env${NC}"
        ;;
esac

# Meta App
echo ""
echo -e "${YELLOW}Credenciais do Meta/Facebook App:${NC}"
echo "(Pegue em: https://developers.facebook.com/apps)"
read -p "Instagram App ID: " INSTAGRAM_APP_ID
read -p "Instagram App Secret: " INSTAGRAM_APP_SECRET

if [[ -z "$INSTAGRAM_APP_ID" ]] || [[ -z "$INSTAGRAM_APP_SECRET" ]]; then
    echo -e "${RED}❌ Credenciais do Instagram são obrigatórias!${NC}"
    exit 1
fi

# Gerar segredos
echo ""
echo -e "${BLUE}Gerando segredos aleatórios...${NC}"

NEXTAUTH_SECRET=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_VERIFY_TOKEN=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

echo -e "${GREEN}✓ Segredos gerados${NC}"

# Criar .env
echo ""
echo -e "${BLUE}Criando arquivo .env...${NC}"

cat > .env << EOF
# Gerado automaticamente em $(date)
# NÃO compartilhe este arquivo - contém segredos!

# =============================================================================
# CONFIGURAÇÃO BÁSICA
# =============================================================================

NEXTAUTH_URL=$DOMAIN
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
CRON_SECRET=$CRON_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# =============================================================================
# BANCO DE DADOS E FILA
# =============================================================================

POSTGRES_USER=openreply
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://openreply:$POSTGRES_PASSWORD@postgres:5432/openreply
REDIS_URL=redis://redis:6379

# =============================================================================
# E-MAIL (Magic Links para login)
# =============================================================================

EOF

if [[ -n "$RESEND_API_KEY" ]]; then
    echo "RESEND_API_KEY=$RESEND_API_KEY" >> .env
elif [[ -n "$EMAIL_SERVER" ]]; then
    echo "EMAIL_SERVER=$EMAIL_SERVER" >> .env
fi

cat >> .env << EOF
EMAIL_FROM=$EMAIL_FROM

# =============================================================================
# CONTROLE DE ACESSO
# =============================================================================

ALLOWED_EMAILS=$USER_EMAIL

# =============================================================================
# INSTAGRAM / META API
# =============================================================================

META_GRAPH_API_VERSION=v25.0
INSTAGRAM_APP_ID=$INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET=$INSTAGRAM_APP_SECRET
FACEBOOK_APP_SECRET=$INSTAGRAM_APP_SECRET
WEBHOOK_VERIFY_TOKEN=$WEBHOOK_VERIFY_TOKEN

# =============================================================================
# DOCKER COMPOSE (Caddy)
# =============================================================================

# Descomente as linhas abaixo para habilitar o Caddy (HTTPS automático)
# E descomente o serviço "caddy" no docker-compose.yml
# DOMAIN=seudominio.com
# ACME_EMAIL=$USER_EMAIL
# WEB_PORT=3000  # Porta interna, Caddy expõe 80/443
EOF

echo -e "${GREEN}✓ Arquivo .env criado${NC}"

# Resumo
echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Configuração completa!${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo -e "${GREEN}Próximos passos:${NC}"
echo ""
echo "1. Configure seu app no Meta/Facebook Developers:"
echo "   - Redirect URI: $DOMAIN/api/instagram/callback"
echo "   - Webhook URL: $DOMAIN/api/webhook"
echo "   - Webhook Verify Token: (use o valor de WEBHOOK_VERIFY_TOKEN no .env)"
echo "   - Campos do webhook: comments, messages"
echo ""
echo "2. Inicie os serviços:"
echo -e "   ${YELLOW}docker compose up -d${NC}"
echo ""
echo "3. Veja os logs:"
echo -e "   ${YELLOW}docker compose logs -f${NC}"
echo ""
echo "4. Acesse o aplicativo:"
echo -e "   ${YELLOW}$DOMAIN${NC}"
echo ""
echo "5. Health check:"
echo -e "   ${YELLOW}$DOMAIN/api/health${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "- Guarde o arquivo .env em local seguro"
echo "- NUNCA commite o .env no Git"
echo "- Para HTTPS, configure Caddy no docker-compose.yml"
echo ""
echo -e "${BLUE}Documentação completa: docs/META-APP-SETUP.md${NC}"
echo ""
