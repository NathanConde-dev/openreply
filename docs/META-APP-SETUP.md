# Configuração do App na Meta (Facebook/Instagram)

Guia passo a passo para configurar seu aplicativo no Meta Developers para usar com o OpenReply.

## Pré-requisitos

- Conta no Facebook Developers
- Conta Instagram Business ou Creator conectada a uma página do Facebook
- Domínio onde o OpenReply está rodando (ex.: `https://app.seudominio.com`)

## 1. Criar App no Meta Developers

1. Acesse [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Clique em **"Criar app"**
3. Escolha o tipo **"Business"**
4. Preencha:
   - Nome do app: qualquer nome (ex.: "OpenReply Automation")
   - E-mail de contato: seu e-mail
   - Propósito do app: "Myself or my own business"
5. Clique em **"Criar app"**

## 2. Adicionar Produto Instagram

1. No painel do app, procure por **"Instagram"** na lista de produtos
2. Clique em **"Configurar"** em "Instagram Graph API" (ou "Instagram Basic Display")
3. Você será levado para a tela de configuração

## 3. Configurar OAuth Redirect

No painel do app:

1. Vá em **Configurações** → **Básico**
2. Role até a seção **"Instagram Basic Display"** ou **"Instagram Graph API"**
3. Clique em **"Configurar"** (se ainda não configurou)
4. Em **"Valid OAuth Redirect URIs"**, adicione:
   ```
   https://seudominio.com/api/instagram/callback
   ```
   ⚠️ Substitua `seudominio.com` pelo seu domínio real
5. Clique em **"Salvar alterações"**

## 4. Configurar Webhooks

Os webhooks permitem que o Instagram envie notificações de novos comentários e mensagens automaticamente.

### 4.1 Adicionar URL do Webhook

1. No painel do app, vá em **Produtos** → **Webhooks**
2. Clique em **"Adicionar assinatura"** ou **"Criar assinatura"**
3. Escolha **"Instagram"**
4. Preencha:
   - **Callback URL**: `https://seudominio.com/api/webhook`
   - **Verify Token**: o valor da variável `WEBHOOK_VERIFY_TOKEN` do seu `.env`
     - ⚠️ Use EXATAMENTE o mesmo token que está no .env
     - Se não tiver ainda, gere um: `openssl rand -base64 32`

### 4.2 Selecionar Campos

Marque os seguintes campos para receber notificações:

- ☑️ **comments** — novos comentários em posts
- ☑️ **messages** — mensagens diretas (DMs)

### 4.3 Verificar e Salvar

1. Clique em **"Verificar e salvar"**
2. O Meta tentará verificar sua URL enviando uma requisição GET
3. Se der erro, verifique:
   - O app está rodando e acessível publicamente
   - O `WEBHOOK_VERIFY_TOKEN` está correto no .env
   - Não há firewall bloqueando requisições do Meta

## 5. Adicionar Conta Instagram de Teste

Enquanto o app está em modo **Development**, apenas contas de teste podem conectar.

1. Vá em **Funções** → **Funções**
2. Clique em **"Adicionar testadores"** na seção **"Instagram Testers"**
3. Digite o nome de usuário da conta Instagram que você quer conectar
4. Envie o convite
5. **No Instagram**, a conta precisa:
   - Acessar **Configurações** → **Apps e sites** → **Solicitações de tester**
   - Aceitar o convite do seu app

## 6. Copiar Credenciais

1. No painel do app, vá em **Configurações** → **Básico**
2. Copie o **ID do app** e o **Chave secreta do app**
3. Adicione no seu `.env`:
   ```env
   INSTAGRAM_APP_ID=seu-app-id-aqui
   INSTAGRAM_APP_SECRET=sua-chave-secreta-aqui
   ```

## 7. Conectar Conta Instagram no OpenReply

1. Acesse seu OpenReply: `https://seudominio.com`
2. Faça login com o e-mail que você configurou em `ALLOWED_EMAILS`
3. Vá em **Integrações** ou **Configurações**
4. Clique em **"Conectar conta Instagram"**
5. Você será redirecionado para o Meta para autorizar
6. Escolha a conta Instagram de teste
7. Autorize as permissões solicitadas
8. Você será redirecionado de volta ao OpenReply

## 8. Ativar Modo Live (Produção)

⚠️ **Apenas faça isso quando estiver pronto para produção!**

Enquanto em modo Development, apenas contas de teste podem usar o app.

### Requisitos para Modo Live

O Meta exige uma **revisão de app** antes de ativar o modo Live:

1. Preencha a política de privacidade do app
2. Preencha os termos de serviço
3. Envie o app para revisão
4. Aguarde aprovação (pode levar alguns dias)

### Como enviar para revisão

1. No painel do app, vá em **Revisão do app**
2. Selecione as permissões que você precisa:
   - `instagram_basic`
   - `instagram_manage_comments`
   - `instagram_manage_messages`
   - `pages_messaging` (se usar mensagens)
3. Preencha as informações solicitadas:
   - Descrição de como você usa cada permissão
   - Screenshots/vídeos demonstrando o uso
   - Instruções para o revisor testar
4. Envie para revisão

### Após aprovação

1. Vá em **Configurações** → **Básico**
2. No topo da página, mude de **"Development"** para **"Live"**
3. Agora qualquer conta Instagram pode conectar (não apenas testers)

## 9. Validar Configuração

### Testar Webhooks

1. No painel do Meta, vá em **Webhooks**
2. Clique em **"Testar"** ao lado do campo que você configurou (comments ou messages)
3. O Meta enviará um evento de teste
4. Verifique os logs do seu app:
   ```bash
   docker compose logs -f web
   ```
5. Você deve ver algo como:
   ```
   [Webhook] Received test event from Meta
   ```

### Testar Comentário

1. Publique um post no Instagram com a conta conectada
2. Comente no post com uma palavra-chave que você configurou
3. Verifique os logs:
   ```bash
   docker compose logs -f worker
   ```
4. Você deve ver o comentário sendo processado
5. Verifique se o DM foi enviado

### Health Check

Acesse `https://seudominio.com/api/health` e verifique se tudo está OK:

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

## Troubleshooting

### Webhook não está sendo recebido

- Verifique se a URL está acessível publicamente
- Teste manualmente: `curl https://seudominio.com/api/webhook`
- Verifique o `WEBHOOK_VERIFY_TOKEN` no .env
- Veja os logs: `docker compose logs -f web`

### Erro ao conectar conta Instagram

- Verifique se o `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET` estão corretos
- Verifique se o redirect URI está correto no Meta
- Veja os logs: `docker compose logs -f web`

### DM não está sendo enviado

- Verifique se o worker está rodando: `docker compose ps worker`
- Veja os logs do worker: `docker compose logs -f worker`
- Verifique se o Redis está acessível
- Acesse `/api/health` para ver o status

### Token expirou

Tokens do Instagram expiram em ~60 dias. O OpenReply renova automaticamente:

- O worker roda um job diário (3h AM UTC) que renova tokens
- Verifique os logs: `docker compose logs -f worker | grep "Token Refresh"`
- Em caso de erro, reconecte a conta manualmente

## Links Úteis

- [Meta Developers](https://developers.facebook.com)
- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [Webhooks Docs](https://developers.facebook.com/docs/graph-api/webhooks)
- [Instagram Business API](https://developers.facebook.com/docs/instagram-api/overview)

## Suporte

Se precisar de ajuda:

1. Verifique os logs: `docker compose logs -f`
2. Acesse o health check: `/api/health`
3. Consulte a documentação do Meta
4. Abra uma issue no GitHub
