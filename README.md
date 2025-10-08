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
