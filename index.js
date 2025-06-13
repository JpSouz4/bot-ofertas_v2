const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const emoji = require("node-emoji");
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const {
  convertCSV,
  groupId
} = require('./services.js');

const fire = emoji.find('🔥');
const dollar = emoji.find('💵');
const blue_circle = emoji.find('🔵');

// 🔥 Configurações da Supabase
const supabaseUrl = 'https://bkjbkfujjftzqinwgyzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJramJrZnVqamZ0enFpbndneXpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg5NjUsImV4cCI6MjA2NDYzNDk2NX0.WE58NEs_CAHxCrWt22gcq6rH3d7xfiVXTR45qme51kM';
const supabase = createClient(supabaseUrl, supabaseKey);


// ✅ Função para baixar a sessão da Supabase
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

// ✅ Função para enviar a sessão para Supabase
function uploadFolder(folderName) {
  if (!fs.existsSync(folderName)) return;

  const files = fs.readdirSync(folderName).filter(f => fs.lstatSync(`${folderName}/${f}`).isFile());

  files.forEach(async file => {
    const content = fs.readFileSync(`${folderName}/${file}`);
    await supabase.storage
      .from('sessions')
      .upload(`${folderName}/${file}`, content, { upsert: true });
  });
}

function limparLocal(folderName) {
  if (!fs.existsSync(folderName)) return;
  fs.readdirSync(folderName).forEach(f => fs.unlinkSync(`${folderName}/${f}`));
  fs.rmdirSync(folderName);
}


const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeBase64 = '';
let botStatus = '❌ OFF';

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--single-process',
      '--no-zygote',
    ]
  }
});

async function existeSessaoNoSupabase() {
  const { data, error } = await supabase.storage.from('sessions').list('.wwebjs_auth');

  if (error) {
    console.error('Erro ao verificar sessão:', error);
    return false;
  }

  // Verifica se há arquivos válidos
  return Array.isArray(data) && data.length > 0;
}

async function main() {
  const temSessao = await existeSessaoNoSupabase();

  if (temSessao) {
    console.log('🔐 Sessão encontrada no Supabase. Baixando...');
    await downloadFolder('.wwebjs_auth');
    //await downloadFolder('.wwebjs_cache');
  } else {
    console.log('🚨 Nenhuma sessão encontrada. O QR será gerado.');
    client.on('qr', async (qr) => {
  qrCodeBase64 = await qrcode.toDataURL(qr);
  qrcode.toFile(path.join(__dirname, 'qrcode.png'), qr);
  console.log('QR code atualizado');
});
  }

  client.initialize(); // sua função que instancia o WhatsApp
}

client.on('ready', () => {
  console.log('🤖 Bot WhatsApp ONLINE!');
  botStatus = '✅ ONLINE';
  uploadFolder('.wwebjs_auth');
  uploadFolder('.wwebjs_cache');
  limparLocal('.wwebjs_auth');
  //limparLocal('.wwebjs_cache');
});

client.on('disconnected', () => {
  console.log('❌ Bot WhatsApp DESCONECTADO');
  botStatus = '❌ OFF';
});

async function enviarMensagem() {
    const state = await client.getState();

    if (state === 'CONNECTED') {
        const produto = await convertCSV();

        const valorNumerico = parseFloat(produto.Price.replace(/[^\d.,]/g, '').replace(',', '.'));
        const valorFormatado = valorNumerico.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });

        const mensagem = `${fire.emoji} ${produto.ItemName} 
                      \n ${dollar.emoji} Valor: ${valorFormatado}
                      \n ${produto.Sales} pedidos
                      \n Acesse o link: ${produto.OfferLink}
                      \n ${blue_circle.emoji} Redes Sociais: `;

        await client.sendMessage(groupId(), mensagem)
            .then(() => console.log('Mensagem enviada:', mensagem))
            .catch(err => console.error('Erro ao enviar:', err));

    } else {
        console.log('Bot desconectado.');
        main();
    }
}

// ⏳ Intervalo de envio (a cada 60 minutos → 3600000 ms)
//setInterval(enviarMensagem, 1800000);
setInterval(enviarMensagem, 60000);

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