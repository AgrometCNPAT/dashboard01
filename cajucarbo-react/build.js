const fs = require('fs');
const path = require('path');

const tplPath = path.join(__dirname, 'index.template.html');
const commonPath = path.join(__dirname, 'js', 'react', 'common.jsx');
const sectionsPath = path.join(__dirname, 'js', 'react', 'sections.jsx');
const fenologiaPath = path.join(__dirname, 'js', 'react', 'fenologia.jsx');
const appPath = path.join(__dirname, 'js', 'react', 'App.jsx');
const fenologiaSourcePath = path.join(__dirname, '..', 'fenologia.html');
const outPath = path.join(__dirname, 'index.html');

const tpl = fs.readFileSync(tplPath, 'utf8');
const common = fs.readFileSync(commonPath, 'utf8');
const sections = fs.readFileSync(sectionsPath, 'utf8');
const fenologia = fs.readFileSync(fenologiaPath, 'utf8');
const app = fs.readFileSync(appPath, 'utf8');
const fenologiaSource = fs.readFileSync(fenologiaSourcePath, 'utf8');
const fenologiaMatch = fenologiaSource.match(/const DADOS\s*=\s*(\{[\s\S]*?\});\s*const STATS\s*=\s*(\{[\s\S]*?\});\s*const INDICES/);

if (!fenologiaMatch) {
  throw new Error('Não foi possível extrair os dados originais de fenologia.');
}

const fenologiaData = {
  data: JSON.parse(fenologiaMatch[1]),
  stats: JSON.parse(fenologiaMatch[2]),
};

if (!fenologiaData.data['24h'] || !fenologiaData.data['10h14h'] || !fenologiaData.stats['24h'] || !fenologiaData.stats['10h14h']) {
  throw new Error('A fonte de fenologia não contém os cenários e estatísticas esperados.');
}

const result = tpl
  .replace('__FENOLOGIA_DATA__', JSON.stringify(fenologiaData))
  .replace('__COMMON_JSX__', common)
  .replace('__SECTIONS_JSX__', sections)
  .replace('__FENOLOGIA_JSX__', fenologia)
  .replace('__APP_JSX__', app);

fs.writeFileSync(outPath, result, 'utf8');
console.log('Successfully compiled index.html (' + result.length + ' bytes)');
