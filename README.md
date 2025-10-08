# B3 mTLS Proxy

Este é um proxy Node.js que suporta autenticação mTLS para integração com a API B3.

## Por que é necessário?

A API B3 requer autenticação mTLS (Mutual TLS) com certificado cliente. O Deno (usado no Supabase Edge Functions) não suporta mTLS nativamente, então este proxy age como intermediário.

## Como funciona?

1. O Edge Function envia requisições para este proxy
2. O proxy recebe o certificado nos headers
3. O proxy faz a requisição mTLS para a B3
4. Retorna os dados para o Edge Function

## Instalação

```bash
npm install
```

## Executar localmente

```bash
npm start
```

## Deploy

### Railway (Recomendado)

1. Crie conta no [Railway.app](https://railway.app)
2. Clique em "New Project" → "Deploy from GitHub"
3. Conecte este repositório
4. Railway detectará automaticamente o Node.js e fará o deploy
5. Copie a URL pública gerada

### Render

1. Crie conta no [Render.com](https://render.com)
2. Clique em "New" → "Web Service"
3. Conecte este repositório
4. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Clique em "Create Web Service"
6. Copie a URL pública gerada

### Heroku

```bash
heroku create your-b3-proxy
git push heroku main
```

## Configurar no Lovable

Após o deploy, adicione a URL do proxy como secret:

1. Vá em Configurações do Projeto
2. Adicione secret `B3_PROXY_URL` com a URL do seu proxy
   - Exemplo: `https://your-app.railway.app`

## Endpoints

### POST /api/extrato

Busca extrato de operações da B3.

Headers necessários:
- `X-Certificate`: Certificado .p12 em base64
- `X-Certificate-Password`: Senha do certificado

Body:
```json
{
  "dataInicio": "2024-01-01",
  "dataFim": "2024-12-31"
}
```

### GET /health

Health check do serviço.

## Segurança

- O certificado é passado via headers e nunca armazenado
- Arquivos temporários são deletados imediatamente
- Use HTTPS em produção
- Configure CORS adequadamente para seu domínio
