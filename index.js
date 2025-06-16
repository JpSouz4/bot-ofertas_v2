const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const emoji = require("node-emoji");
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { convertCSV, groupId } = require('./services.js');

const fire = emoji.find('🔥');
const dollar = emoji.find('💵');
const blue_circle = emoji.find('🔵');

// 🔥 Supabase
const supabaseUrl = 'https://bkjbkfujjftzqinwgyzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJramJrZnVqamZ0enFpbndneXpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg5NjUsImV4cCI6MjA2NDYzNDk2NX0.WE58NEs_CAHxCrWt22gcq6rH3d7xfiVXTR45qme51kM';
const supabase = createClient(supabaseUrl, supabaseKey);

// Express
const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeBase64 = '';
let botStatus = '❌ OFF';

// ⬇️ Sessão Supabase
async function downloadFolder(folderName) {
  const { data, error } = await supabase.storage.from('sessions').list(folderName);
  if (error || !data) return;

  if (!fs.existsSync(folderName)) fs.mkdirSync(folderName);

  for (const file of data) {
    const { data: fileData } = await supabase.storage.from('sessions').download(`${folderName}/${file.name}`);
    const content = await fileData.arrayBuffer();
    fs.writeFileSync(`${folderName}/${file.name}`, Buffer.from(content));
  }
}

async function uploadFolder(folderName) {
  if (!fs.existsSync(folderName)) return;
  const files = fs.readdirSync(folderName).filter(f => fs.lstatSync(`${folderName}/${f}`).isFile());

  for (const file of files) {
    const content = fs.readFileSync(`${folderName}/${file}`);
    await supabase.storage.from('sessions').upload(`${folderName}/${file}`, content, { upsert: true });
  }
}

function limparLocal(folderName) {
  if (!fs.existsSync(folderName)) return;
  fs.readdirSync(folderName).forEach(f => fs.unlinkSync(`${folderName}/${f}`));
  fs.rmdirSync(folderName);
}

async function existeSessaoNoSupabase() {
  const { data, error } = await supabase.storage.from('sessions').list('.wwebjs_auth');
  return Array.isArray(data) && data.length > 0;
}

// 🤖 WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--single-process',
      '--no-zygote',
    ]
  }
});

// ✅ QR sempre definido antes do initialize
client.on('qr', async (qr) => {
  const temSessao = await existeSessaoNoSupabase();
  if (!temSessao) {
    qrCodeBase64 = await qrcode.toDataURL(qr);
    qrcode.toFile(path.join(__dirname, 'qrcode.png'), qr);
    console.log('🔁 QR code gerado');
  }
});

client.on('ready', async () => {
  console.log('🤖 Bot WhatsApp ONLINE!');
  botStatus = '✅ ONLINE';
  await uploadFolder('.wwebjs_auth');
  //limparLocal('.wwebjs_auth');

  setInterval(enviarMensagem, 60000);
});

client.on('disconnected', () => {
  console.log('❌ Bot WhatsApp DESCONECTADO');
  botStatus = '❌ OFF';
});

async function enviarMensagem() {
  try {
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      console.log('⚠️ Cliente não está conectado.');
      return;
    }

    const produto = await convertCSV();
    const valorNumerico = parseFloat(produto.Price.replace(/[^\d.,]/g, '').replace(',', '.'));
    const valorFormatado = valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const mensagem = `${fire.emoji} ${produto.ItemName}
${dollar.emoji} Valor: ${valorFormatado}
${produto.Sales} pedidos
Acesse o link: ${produto.OfferLink}
${blue_circle.emoji} Redes Sociais: `;

    await client.sendMessage(groupId(), mensagem);
    console.log('✅ Mensagem enviada!');
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err);
  }
}

// 🌐 Express rotas
app.get('/status', (req, res) => res.send({ status: botStatus }));
app.get('/qrcode', (req, res) => {
  if (qrCodeBase64) return res.send(`<img src="${qrCodeBase64}" />`);
  if (fs.existsSync('./qrcode.png')) return res.sendFile(path.join(__dirname, 'qrcode.png'));
  res.send('QR Code não disponível.');
});
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'views/dashboard.html')));
app.get('/', (req, res) => res.send('🤖 Bot de Ofertas rodando. Acesse /status, /qrcode ou /dashboard'));

// 🧠 Inicialização
app.listen(PORT, async () => {
  console.log(`🚀 Servidor iniciado na porta ${PORT}`);

  const temSessao = await existeSessaoNoSupabase();

  if (temSessao) {
    console.log('🔐 Sessão encontrada. Baixando...');
    await downloadFolder('.wwebjs_auth');
    await new Promise(res => setTimeout(res, 1500)); // Delay p/ estabilidade
  } else {
    console.log('🚨 Nenhuma sessão encontrada. QR será gerado.');
  }

  client.initialize();
});
