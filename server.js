// Proxy Node.js para mTLS com B3 API
// Este servidor deve ser hospedado separadamente (Railway, Render, Heroku, etc.)

const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

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
    const { dataInicio, dataFim } = req.body;

    // Decodificar certificado
    const certBuffer = Buffer.from(req.certBase64, 'base64');
    
    // Salvar temporariamente (em produção, use memória)
    const certPath = `/tmp/cert-${Date.now()}.p12`;
    fs.writeFileSync(certPath, certBuffer);

    // Configurar opções HTTPS com certificado cliente
    const options = {
      hostname: 'apib3i-cert.b3.com.br',
      port: 443,
      path: '/api/extrato/negociacao',
      method: 'POST',
      pfx: certBuffer,
      passphrase: req.certPassword,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Fazer requisição com mTLS
    const b3Request = https.request(options, (b3Response) => {
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
      console.error('Request error:', error);
      // Limpar arquivo temporário
      if (fs.existsSync(certPath)) {
        fs.unlinkSync(certPath);
      }
      res.status(500).json({ error: error.message });
    });

    // Enviar dados para B3
    const postData = JSON.stringify({
      dataInicio,
      dataFim,
    });

    b3Request.write(postData);
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
