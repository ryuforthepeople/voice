const fs = require('fs');
const path = require('path');

// Read and parse data.js
const dataPath = path.join(__dirname, '..', 'public', 'data.js');
const dataContent = fs.readFileSync(dataPath, 'utf8');
const match = dataContent.match(/const API_CATALOG = (\[[\s\S]*\]);/);
if (!match) { console.error('Could not parse API_CATALOG'); process.exit(1); }
const catalog = eval(match[1]);
console.log(`Found ${catalog.length} APIs`);

function getGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function authScore(auth) {
  if (auth === 'None') return 15;
  if (auth === 'apiKey') return 10;
  if (auth === 'OAuth') return 5;
  return 0;
}

async function checkApi(api) {
  const result = { reachable: false, responseMs: 0, validResponse: false, score: 0, grade: 'F' };
  let score = 0;

  // HTTPS points
  if (api.https) score += 10;
  // Auth points
  score += authScore(api.auth);

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(api.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; APIHealthCheck/1.0)' },
      redirect: 'follow'
    });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    result.responseMs = elapsed;

    if (res.status >= 200 && res.status < 400) {
      result.reachable = true;
      score += 25;
    }

    // Response time
    if (elapsed < 200) score += 20;
    else if (elapsed < 500) score += 15;
    else if (elapsed < 1000) score += 10;
    else if (elapsed < 3000) score += 5;

    // Valid response - try to read some body
    try {
      const text = await res.text();
      if (text && text.length > 50) {
        result.validResponse = true;
        score += 20;
        // Documentation check - has some content
        if (text.length > 200) score += 10;
      }
    } catch {}
  } catch (e) {
    result.responseMs = Date.now() - start;
  }

  result.score = Math.min(score, 100);
  result.grade = getGrade(result.score);
  return result;
}

async function runBatch(apis, batchSize = 20) {
  const results = {};
  for (let i = 0; i < apis.length; i += batchSize) {
    const batch = apis.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(api => checkApi(api)));
    batch.forEach((api, j) => { results[api.id] = batchResults[j]; });
    console.log(`Checked ${Math.min(i + batchSize, apis.length)}/${apis.length}`);
    if (i + batchSize < apis.length) await new Promise(r => setTimeout(r, 100));
  }
  return results;
}

(async () => {
  const results = await runBatch(catalog);
  
  const healthData = {
    lastChecked: new Date().toISOString(),
    results
  };

  // Write health-data.js
  const outPath = path.join(__dirname, '..', 'public', 'health-data.js');
  fs.writeFileSync(outPath, `const HEALTH_DATA = ${JSON.stringify(healthData, null, 2)};`);
  console.log('Wrote health-data.js');

  // Summary
  const grades = {};
  Object.values(results).forEach(r => { grades[r.grade] = (grades[r.grade] || 0) + 1; });
  console.log('Grade distribution:', grades);
  const avgScore = Object.values(results).reduce((a, r) => a + r.score, 0) / Object.values(results).length;
  console.log(`Average score: ${avgScore.toFixed(1)}`);
})();
