const csv = require('csvtojson');
const fs = require('fs');

const path = './DATA/feed.csv';
const historicoPath = './DATA/historico.json';

function groupId() {
    return '5518991229015-1616757881@g.us'; // Substituir pelo ID do seu grupo
}

// Função para carregar o histórico de itens enviados
function carregarHistorico() {
    if (!fs.existsSync(historicoPath)) {
        fs.writeFileSync(historicoPath, JSON.stringify([]));
    }
    const data = fs.readFileSync(historicoPath);
    return JSON.parse(data);
}

// Função para salvar histórico atualizado
function salvarHistorico(historico) {
    fs.writeFileSync(historicoPath, JSON.stringify(historico, null, 2));
}

// Função que escolhe um item que ainda não foi enviado
function escolherItemNaoEnviado(jsonArray, historico) {
    const naoEnviados = jsonArray.filter(item => !historico.includes(item.OfferLink));

    if (naoEnviados.length === 0) {
        console.log('🚫 Todos os itens já foram enviados. Zerar histórico se quiser reiniciar.');
        return null;
    }

    const randomIndex = Math.floor(Math.random() * naoEnviados.length);
    return naoEnviados[randomIndex];
}

async function convertCSV() {
    try {
        const jsonArrayObj = await csv({
            delimiter: ',',
            noheader: false,
            headers: [
                'ItemId',
                'ItemName',
                'Price',
                'Sales',
                'ShopName',
                'CommissionRate',
                'Commission',
                'ProductLink',
                'OfferLink'
            ]
        }).fromFile(path);

        const historico = carregarHistorico();
        const itemSelecionado = escolherItemNaoEnviado(jsonArrayObj, historico);

        if (!itemSelecionado) {
            return null; // Se não houver item novo, retorna nulo
        }

        // Salva no histórico
        historico.push(itemSelecionado.OfferLink);
        salvarHistorico(historico);

        return itemSelecionado;

    } catch (ex) {
        console.error('❌ Erro ao processar CSV:', ex);
        return null;
    }
}


module.exports = {
    convertCSV,
    groupId
};