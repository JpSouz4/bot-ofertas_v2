const csv = require('csvtojson');
const path = './DATA/feed.csv';

function groupId() {
    return 'seu-grupo-id@g.us';
}

async function convertCSV() {
    try {
        const jsonArray = await csv().fromFile(path);
        const random = Math.floor(Math.random() * jsonArray.length);
        return jsonArray[random];
    } catch (err) {
        console.error('Erro ao ler CSV:', err);
    }
}

module.exports = {
    convertCSV,
    groupId
};