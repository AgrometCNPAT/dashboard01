/* =========================================================
   statistics.js
   Estatística descritiva + variáveis derivadas (ex.: VPD)
   ========================================================= */

function onlyNumbers(arr){
  return arr.filter(v => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);
}

function mean(arr){
  const v = onlyNumbers(arr);
  if(!v.length) return null;
  return v.reduce((a,b)=>a+b,0) / v.length;
}

function median(arr){
  const v = onlyNumbers(arr).sort((a,b)=>a-b);
  if(!v.length) return null;
  const mid = Math.floor(v.length/2);
  return v.length % 2 ? v[mid] : (v[mid-1]+v[mid])/2;
}

function stddev(arr){
  const v = onlyNumbers(arr);
  if(v.length < 2) return null;
  const m = mean(v);
  const variance = v.reduce((a,b)=>a + Math.pow(b-m,2), 0) / (v.length-1);
  return Math.sqrt(variance);
}

function variance(arr){
  const s = stddev(arr);
  return s === null ? null : s*s;
}

function percentile(arr, p){
  const v = onlyNumbers(arr).sort((a,b)=>a-b);
  if(!v.length) return null;
  const idx = (p/100) * (v.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if(lo === hi) return v[lo];
  return v[lo] + (v[hi]-v[lo]) * (idx-lo);
}

/** Regressão linear simples (tendência) -> retorna inclinação por registro. */
function trendSlope(arr){
  const v = onlyNumbers(arr);
  if(v.length < 3) return null;
  const n = v.length;
  const xs = Array.from({length:n}, (_,i)=>i);
  const xm = mean(xs), ym = mean(v);
  let num=0, den=0;
  for(let i=0;i<n;i++){ num += (xs[i]-xm)*(v[i]-ym); den += Math.pow(xs[i]-xm,2); }
  return den === 0 ? null : num/den;
}

/**
 * describeVariable(arr) -> objeto com estatísticas completas de uma variável
 */
function describeVariable(arr){
  const v = onlyNumbers(arr);
  const total = arr.length;
  const missing = total - v.length;
  if(!v.length){
    return { count: 0, missing, min:null, max:null, mean:null, median:null, stddev:null,
             variance:null, range:null, p25:null, p75:null, trend:null };
  }
  const sorted = v.slice().sort((a,b)=>a-b);
  const mn = sorted[0];
  const mx = sorted[sorted.length - 1];
  const average = v.reduce((sum, value) => sum + value, 0) / v.length;
  const varianceValue = v.length < 2
    ? null
    : v.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / (v.length - 1);
  const percentileSorted = (p) => {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const middle = Math.floor(sorted.length / 2);
  const medianValue = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    count: v.length,
    missing,
    min: mn,
    max: mx,
    mean: average,
    median: medianValue,
    stddev: varianceValue === null ? null : Math.sqrt(varianceValue),
    variance: varianceValue,
    range: mx - mn,
    p25: percentileSorted(25),
    p75: percentileSorted(75),
    trend: trendSlope(v)
  };
}

/**
 * calculateStatistics(normalized, fields)
 * Recebe os dados normalizados e a lista de campos a descrever.
 */
function calculateStatistics(normalized, fields){
  const stats = {};
  fields.forEach(f => {
    stats[f] = describeVariable(normalized.map(r => r[f]));
  });
  return stats;
}

/**
 * Correlação de Pearson entre duas séries (pareadas, ignorando nulos em qualquer uma).
 */
function pearsonCorrelation(a, b){
  const pairs = [];
  for(let i=0;i<a.length;i++){
    if(a[i] !== null && b[i] !== null && !isNaN(a[i]) && !isNaN(b[i])){
      pairs.push([Number(a[i]), Number(b[i])]);
    }
  }
  if(pairs.length < 3) return null;
  const xs = pairs.map(p=>p[0]), ys = pairs.map(p=>p[1]);
  const xm = mean(xs), ym = mean(ys);
  let num=0, dx=0, dy=0;
  for(let i=0;i<pairs.length;i++){
    num += (xs[i]-xm)*(ys[i]-ym);
    dx += Math.pow(xs[i]-xm,2);
    dy += Math.pow(ys[i]-ym,2);
  }
  const den = Math.sqrt(dx*dy);
  return den === 0 ? null : num/den;
}

/**
 * calculateDerivedVariables(normalized)
 * Calcula variáveis que não vêm prontas na planilha, a partir dos dados
 * já existentes. Nunca inventa valores: se os insumos não existirem,
 * a variável derivada permanece null naquele registro.
 *
 * VPD (Déficit de Pressão de Vapor, kPa) a partir de temperatura do ar (°C)
 * e umidade relativa (%), usando a equação de Tetens.
 */
function calculateDerivedVariables(normalized){
  return normalized.map(row => {
    let vpd = null;
    let amplitudeTermica = null;

    if(row.t2m_c !== null && row.rh !== null){
      const t = row.t2m_c, rh = row.rh;
      const es = 0.6108 * Math.exp((17.27 * t) / (t + 237.3)); // kPa
      const ea = es * (rh/100);
      vpd = +(es - ea).toFixed(3);
    }

    if(row.t2m_c_max !== null && row.t2m_c_min !== null){
      amplitudeTermica = +(row.t2m_c_max - row.t2m_c_min).toFixed(2);
    }

    return { ...row, vpd, amplitude_termica: amplitudeTermica };
  });
}

window.CajuCarbo = window.CajuCarbo || {};
Object.assign(window.CajuCarbo, {
  mean, median, stddev, variance, percentile, trendSlope,
  describeVariable, calculateStatistics, pearsonCorrelation, calculateDerivedVariables, onlyNumbers
});
