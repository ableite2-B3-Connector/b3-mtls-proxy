# Troubleshooting B3 mTLS Proxy

## Erro: "Unsupported PKCS12 PFX data"

Este erro ocorre quando o certificado P12/PFX usa algoritmos de criptografia legados que não são suportados por padrão no Node.js 18+.

### Solução 1: Converter Certificado para PEM (Recomendado)

1. **Extrair o certificado e chave privada do arquivo P12:**

```bash
# Extrair certificado
openssl pkcs12 -in seu-certificado.p12 -out certificado.pem -clcerts -nokeys

# Extrair chave privada
openssl pkcs12 -in seu-certificado.p12 -out chave-privada.pem -nocerts -nodes

# Combinar em um único arquivo
cat certificado.pem chave-privada.pem > certificado-completo.pem
```

2. **Converter de volta para P12 com algoritmos modernos:**

```bash
openssl pkcs12 -export \
  -in certificado.pem \
  -inkey chave-privada.pem \
  -out novo-certificado.p12 \
  -legacy
```

3. **Gerar novo Base64:**

```bash
base64 -i novo-certificado.p12 -o certificado-base64.txt
```

4. **Atualizar o secret `B3_CERT_BASE64`** com o novo conteúdo

### Solução 2: Usar Node.js com OpenSSL Legacy Provider

Se você controla o ambiente do proxy (Railway/Render), adicione ao `package.json`:

```json
{
  "scripts": {
    "start": "NODE_OPTIONS='--openssl-legacy-provider' node server.js"
  }
}
```

Ou configure a variável de ambiente:
```bash
NODE_OPTIONS=--openssl-legacy-provider
```

### Solução 3: Obter Novo Certificado da B3

Se possível, solicite à B3 um novo certificado gerado com algoritmos modernos:
- RSA 2048+ bits
- AES-256 encryption
- SHA-256 ou superior

## Outros Erros Comuns

### "UNABLE_TO_DECRYPT_CERT_KEY"
- **Causa:** Senha do certificado incorreta
- **Solução:** Verifique o secret `B3_CERT_PASSWORD`

### "ECONNREFUSED" ou "ENOTFOUND"
- **Causa:** Não consegue conectar ao servidor B3
- **Solução:** 
  - Verifique conexão com internet
  - Confirme que a URL da B3 está correta: `apib3i-cert.b3.com.br`
  - Verifique se não há firewall bloqueando

### "Certificate is too short"
- **Causa:** Base64 do certificado está incompleto
- **Solução:**
  - Regenere o base64: `base64 -i certificado.p12`
  - Copie TODO o conteúdo (incluindo possíveis quebras de linha)
  - Cole no secret `B3_CERT_BASE64` sem adicionar espaços

## Verificação do Certificado

Para verificar se seu certificado P12 é válido:

```bash
# Ver informações do certificado
openssl pkcs12 -info -in seu-certificado.p12 -noout

# Testar senha
openssl pkcs12 -in seu-certificado.p12 -noout -password pass:sua-senha
```

## Logs Úteis

Ao testar, verifique os logs do proxy no Render/Railway para identificar:
- `Certificate decoded successfully` - Base64 OK
- `Certificate magic bytes` - Formato do arquivo
- `Making request to B3` - Tentativa de conexão
- Qualquer erro relacionado a TLS/SSL

## Suporte

Se após todas as tentativas o erro persistir, verifique:
1. Que o certificado foi emitido pela B3
2. Que o certificado ainda está válido (não expirou)
3. Que você tem as credenciais corretas (client_id, client_secret)
