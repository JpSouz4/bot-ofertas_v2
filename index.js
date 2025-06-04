const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');

const {
  convertCSV,
  groupId
} = require('./services.js');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeBase64 = '';
let botStatus = '❌ OFF';

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', async (qr) => {
  qrCodeBase64 = await qrcode.toDataURL(qr);
  qrcode.toFile(path.join(__dirname, 'qrcode.png'), qr);
  console.log('QR code atualizado');
});

client.on('ready', () => {
  console.log('🤖 Bot WhatsApp ONLINE!');
  botStatus = '✅ ONLINE';
});

client.on('disconnected', () => {
  console.log('❌ Bot WhatsApp DESCONECTADO');
  botStatus = '❌ OFF';
});

client.initialize();

app.get('/status', (req, res) => {
  res.send({ status: botStatus });
});

app.get('/qrcode', (req, res) => {
  if (qrCodeBase64) {
    res.send(`<img src="${qrCodeBase64}" />`);
  } else if (fs.existsSync('./qrcode.png')) {
    res.sendFile(path.join(__dirname, 'qrcode.png'));
  } else {
    res.send('QR Code não disponível. Bot já pode estar conectado.');
  }
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/dashboard.html'));
});

app.get('/', (req, res) => {
  res.send('🤖 Bot de Ofertas rodando. Acesse /status, /qrcode ou /dashboard');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});