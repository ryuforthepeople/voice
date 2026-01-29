const fs = require('fs');
const path = require('path');

const pubDir = path.join(__dirname, '..', 'public');
const dataRaw = fs.readFileSync(path.join(pubDir, 'data.js'), 'utf8');
const healthRaw = fs.readFileSync(path.join(pubDir, 'health-data.js'), 'utf8');

// Parse by replacing const with var and using Function
const API_CATALOG = new Function(dataRaw.replace('const API_CATALOG', 'var API_CATALOG') + '\nreturn API_CATALOG;')();
const HEALTH_DATA = new Function(healthRaw.replace('const HEALTH_DATA', 'var HEALTH_DATA') + '\nreturn HEALTH_DATA;')();

const updated = API_CATALOG.map(api => {
  const h = HEALTH_DATA.results[api.id];
  return h ? { ...api, score: h.score, grade: h.grade } : { ...api, score: 0, grade: 'F' };
});

fs.writeFileSync(path.join(pubDir, 'data.js'), `const API_CATALOG = ${JSON.stringify(updated, null, 2)};`);
console.log('Updated data.js with scores');
