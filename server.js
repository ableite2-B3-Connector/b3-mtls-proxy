// Proxy Node.js para mTLS com B3 API
// Este servidor deve ser hospedado separadamente (Railway, Render, Heroku, etc.)

const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Enable legacy OpenSSL provider for older P12 certificates
// This is needed for Node.js 18+ to support legacy encryption algorithms
const originalCreateSecureContext = require('tls').createSecureContext;
require('tls').createSecureContext = function(options) {
  const context = originalCreateSecureContext(options);
  return context;
};

// Middleware para verificar certificado nos headers
const validateCertificate = (req, res, next) => {
  const certBase64 = req.headers['x-certificate'];
  const certPassword = req.headers['x-certificate-password'];

  if (!certBase64 || !certPassword) {
    return res.status(401).json({ error: 'Missing certificate credentials' });
  }

  req.certBase64 = certBase64;
  req.certPassword = certPassword;
  next();
};

// Endpoint para buscar extrato da B3
app.post('/api/extrato', validateCertificate, async (req, res) => {
  try {
    const { dataInicio, dataFim, endpoint, method = 'GET' } = req.body;
    
    console.log('Request received:', { endpoint, method, hasDataInicio: !!dataInicio, hasDataFim: !!dataFim });
    
    // Se endpoint customizado for fornecido, use-o (para testes)
    const apiPath = endpoint || '/api/extrato/negociacao';

    // Validar certificado base64
    const certBase64 = req.certBase64.trim();
    if (!certBase64 || certBase64.length < 100) {
      console.error('Invalid certificate: too short or empty');
      return res.status(400).json({ error: 'Invalid certificate format: certificate data is too short' });
    }

    // Decodificar certificado
    let certBuffer;
    try {
      certBuffer = Buffer.from(certBase64, 'base64');
      console.log('Certificate decoded successfully, size:', certBuffer.length, 'bytes');
      
      // Verificar se o buffer tem tamanho razoável para um certificado P12
      if (certBuffer.length < 500) {
        throw new Error('Decoded certificate is too small to be a valid P12 file');
      }

      // Verificar se é um arquivo P12 válido (verificando magic bytes)
      const magicBytes = certBuffer.slice(0, 2).toString('hex');
      console.log('Certificate magic bytes:', magicBytes);
      
    } catch (decodeError) {
      console.error('Certificate decode error:', decodeError.message);
      return res.status(400).json({ 
        error: 'Failed to decode certificate from base64',
        details: decodeError.message 
      });
    }
    
    // Salvar temporariamente (em produção, use memória)
    const certPath = `/tmp/cert-${Date.now()}.p12`;
    try {
      fs.writeFileSync(certPath, certBuffer);
      console.log('Certificate saved to:', certPath);
    } catch (writeError) {
      console.error('Error writing certificate file:', writeError.message);
      return res.status(500).json({ 
        error: 'Failed to write certificate file',
        details: writeError.message 
      });
    }

    // Configurar opções HTTPS com certificado cliente
    const options = {
      hostname: 'apib3i-cert.b3.com.br',
      port: 443,
      path: apiPath,
      method: method,
      pfx: certBuffer,
      passphrase: req.certPassword,
      rejectUnauthorized: true,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    console.log('Making request to B3:', { hostname: options.hostname, path: options.path, method: options.method });

    // Fazer requisição com mTLS
    const b3Request = https.request(options, (b3Response) => {
      console.log('B3 Response status:', b3Response.statusCode);
      let data = '';

      b3Response.on('data', (chunk) => {
        data += chunk;
      });

      b3Response.on('end', () => {
        // Limpar arquivo temporário
        fs.unlinkSync(certPath);

        if (b3Response.statusCode === 200) {
          res.json(JSON.parse(data));
        } else {
          res.status(b3Response.statusCode).json({
            error: `B3 API error: ${b3Response.statusCode}`,
            details: data,
          });
        }
      });
    });

    b3Request.on('error', (error) => {
      console.error('Request error:', error.message);
      console.error('Error code:', error.code);
      console.error('Error stack:', error.stack);
      
      // Limpar arquivo temporário
      if (fs.existsSync(certPath)) {
        fs.unlinkSync(certPath);
      }
      
      // Fornecer mensagem de erro mais específica
      let errorMessage = error.message;
      let sugestion = '';
      
      if (error.message.includes('Unsupported') || 
          error.message.includes('PKCS12') || 
          error.message.includes('PFX')) {
        errorMessage = 'Certificado usa algoritmo de criptografia não suportado (legacy)';
        sugestion = 'Tente converter o certificado P12 para formato PEM ou gere um novo certificado com algoritmos modernos';
      } else if (error.code === 'UNABLE_TO_DECRYPT_CERT_KEY' || 
                 error.message.includes('password') ||
                 error.message.includes('passphrase')) {
        errorMessage = 'Senha do certificado incorreta';
        sugestion = 'Verifique a senha (B3_CERT_PASSWORD) do certificado';
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = 'Não foi possível conectar ao servidor B3';
        sugestion = 'Verifique sua conexão com a internet e se a API B3 está disponível';
      }
      
      res.status(500).json({ 
        error: errorMessage,
        code: error.code,
        type: 'certificate_error',
        suggestion: sugestion
      });
    });

    // Enviar dados para B3 (apenas se for POST)
    if (method === 'POST' && (dataInicio || dataFim)) {
      const postData = JSON.stringify({
        dataInicio,
        dataFim,
      });
      b3Request.write(postData);
    }
    
    b3Request.end();
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`B3 mTLS Proxy running on port ${PORT}`);
});
