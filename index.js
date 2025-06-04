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
const bucket = 'sessions';
const sessionFolder = './.wwebjs_auth';

// ✅ Função para baixar a sessão da Supabase
async function downloadSession() {
    try {
        const { data, error } = await supabase.storage.from('sessions').list('.wwebjs_auth');
        if (error) {
            console.error('Erro ao listar:', error);
            return;
        }

        if (!data || data.length === 0) {
            console.log('⚠️ Nenhuma sessão encontrada na Supabase.');
            return;
        }

        if (!fs.existsSync('./.wwebjs_auth')) {
            fs.mkdirSync('./.wwebjs_auth');
        }

        for (const file of data) {
            if (file.metadata && file.metadata.size === 0) {
                console.log(`⚠️ Ignorando diretório ou arquivo vazio: ${file.name}`);
                continue;
            }

            const { data: fileData, error: downloadError } = await supabase
                .storage
                .from('sessions')
                .download(`.wwebjs_auth/${file.name}`);

            if (downloadError) {
                console.error('Erro no download:', downloadError);
                continue;
            }

            const content = await fileData.arrayBuffer();
            fs.writeFileSync(`./.wwebjs_auth/${file.name}`, Buffer.from(content));
            console.log('✅ Baixado:', file.name);
        }
    } catch (err) {
        console.error('Erro geral no download:', err);
    }
}

// ✅ Função para enviar a sessão para Supabase
function uploadSession() {
    const folder = './.wwebjs_auth';

    if (!fs.existsSync(folder)) {
        console.log('Pasta de sessão não encontrada.');
        return;
    }

    const files = fs.readdirSync(folder).filter(file => {
        return fs.lstatSync(`${folder}/${file}`).isFile();
    });

    files.forEach(async file => {
        const content = fs.readFileSync(`${folder}/${file}`);
        const { error } = await supabase
            .storage
            .from('sessions')
            .upload(`.wwebjs_auth/${file}`, content, { upsert: true });

        if (error) console.error('❌ Erro ao enviar:', error);
        else console.log('✅ Arquivo enviado:', file);
    });
}
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
  uploadSession();
});

client.on('disconnected', () => {
  console.log('❌ Bot WhatsApp DESCONECTADO');
  botStatus = '❌ OFF';
});

// 🔥 Inicializar bot após baixar sessão
downloadSession().then(() => {
  client.initialize();
});

async function enviarMensagem() {
    const state = await client.getState();
    console.log('Estado atual:', state);

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
    }
}

// ⏳ Intervalo de envio (a cada 60 minutos → 3600000 ms)
setInterval(enviarMensagem, 1800000);

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