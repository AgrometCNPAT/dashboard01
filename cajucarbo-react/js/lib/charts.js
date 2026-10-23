/* =========================================================
   charts.js
   Renderização de gráficos reais com Plotly.js
   — Versão profissional para agrometeorologia:
     • Curvas fluidas (splines suavizadas) e paleta harmoniosa
     • Eixos X e Y claros, legíveis e com unidades físicas (SI)
     • Escala dupla sincronizada e colorida por variável
     • Anotações, limiares agronômicos e tooltips informativos
   ========================================================= */

const CC_COLORS = {
  azul:       "#2E86AB", // Azul institucional dos gráficos originais
  azulClaro:  "#5AA9D6", // Azul claro / apoio visual
  verde:      "#2A9D8F", // Verde das séries comparativas
  verdeClaro: "#7CB342", // Verde de cenário / densidade
  ambar:      "#F18F01", // Amarelo-âmbar dos gráficos originais
  vermelho:   "#C05643", // Vinculado a alertas e extremos
  cinza:      "#415A77", // Texto secundário
  cinzaClaro: "#D9E2EC", // Grid e linhas auxiliares
  grid:       "#EAF0F5", // Grid limpo e discreto
  bg:         "#FFFFFF"
};

const CC_PALETTE = [
  CC_COLORS.azul,
  "#A23B72",
  CC_COLORS.ambar,
  CC_COLORS.verde,
  CC_COLORS.azulClaro,
  CC_COLORS.vermelho,
  CC_COLORS.verdeClaro
];

const CC_SOIL_PALETTE = [
  "#68D391", // 0-7 cm (superfície - verde folha claro)
  "#38A169", // 7-28 cm (subsuperficial - verde floresta)
  "#22543D", // 28-100 cm (zona radicular profunda - verde escuro)
  "#1A365D"  // 100-289 cm (horizonte profundo - azul petróleo)
];

const CC_BASE_LAYOUT = {
  font: { family: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", size: 11.5, color: "#334155" },
  margin: { t: 26, r: 18, b: 42, l: 52 },
  paper_bgcolor: "#FFFFFF",
  plot_bgcolor:  "#FFFFFF",
  xaxis: {
    gridcolor: "#EAF0F5",
    gridwidth: 1,
    zeroline: false,
    showline: true,
    linecolor: "#D9E2EC",
    linewidth: 1,
    tickfont: { size: 10.5, color: "#415A77" },
    automargin: true,
    ticklen: 4
  },
  yaxis: {
    gridcolor: "#EAF0F5",
    gridwidth: 1,
    zeroline: false,
    showline: true,
    linecolor: "#D9E2EC",
    linewidth: 1,
    tickfont: { size: 10.5, color: "#415A77" },
    automargin: true,
    ticklen: 4
  },
  legend: {
    orientation: "h",
    y: 1.12,
    x: 0,
    font: { size: 10.5, color: "#334155" },
    bgcolor: "rgba(255,255,255,0.85)",
    bordercolor: "transparent",
    borderwidth: 0,
    itemclick: false,
    itemdoubleclick: false
  },
  hovermode: "closest",
  hoverlabel: {
    bgcolor: "#102A43",
    bordercolor: "#334155",
    font: { family: "Inter, sans-serif", size: 11.5, color: "#FFFFFF" },
    align: "left"
  },
  transition: { duration: 220, easing: "cubic-in-out" }
};

const CC_CONFIG = {
  displayModeBar: false,
  responsive: true,
  displaylogo: false
};

function resolveEl(el){
  return typeof el === "string" ? document.getElementById(el) : el;
}

function ccClear(el){
  const node = resolveEl(el);
  if(node && node.data){ Plotly.purge(node); }
}

function hexToRgba(hex, alpha){
  const h = hex.replace("#","");
  const r = parseInt(h.substring(0,2),16);
  const g = parseInt(h.substring(2,4),16);
  const b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function dailyMeanSeries(timestamps, values){
  const buckets = new Map();
  timestamps.forEach((timestamp, index) => {
    const rawValue = values[index];
    if(timestamp === null || timestamp === undefined || rawValue === null || rawValue === undefined || rawValue === "") return;
    const value = Number(rawValue);
    const date = new Date(timestamp);
    if(!Number.isFinite(value) || Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    const bucket = buckets.get(key) || { timestamp: `${key}T12:00:00`, total: 0, count: 0 };
    bucket.total += value;
    bucket.count += 1;
    buckets.set(key, bucket);
  });
  return Array.from(buckets.values()).map(bucket => ({
    timestamp: bucket.timestamp,
    value: bucket.total / bucket.count
  }));
}

/* =========================================================
   renderTimeSeries
   Renderiza séries temporais fluidas, com suporte a duplo eixo Y,
   preenchimento suave e anotações agronômicas.
   ========================================================= */
function renderTimeSeries(elId, timestamps, series, opts = {}){
  ccClear(elId);
  const originalTimestamps = timestamps || [];
  const originalSeries = series || [];
  const grouped = window.CajuCarbo.groupDataForCharts(timestamps, series, opts.groupBy);
  timestamps = grouped.timestamps;
  series = grouped.series;
  const useDual = opts.dualAxis && series.length === 2;
  const denseSeries = timestamps.length > 240;

  const traces = [];
  if(opts.showObservations){
    originalSeries.forEach((s, i) => {
      const color = s.color || CC_PALETTE[i % CC_PALETTE.length];
      traces.push({
        x: originalTimestamps,
        y: s.values,
        name: `${s.name} — registros originais`,
        mode: "markers",
        type: "scattergl",
        marker: { color: hexToRgba(color, 0.3), size: 3 },
        showlegend: false,
        hovertemplate: "<b>%{fullData.name}</b><br>Valor: <b>%{y:.2f}</b> " + (s.unit || "") + "<br>Data: %{x|%d/%m/%Y %H:%M}<extra></extra>"
      });
    });
  }

  series.forEach((s, i) => {
    const isSecond = useDual && i === 1;
    const color = isSecond ? CC_COLORS.verde : (s.color || CC_PALETTE[i % CC_PALETTE.length]);
    const seriesName = opts.showObservations && grouped.groupBy === "day" ? `${s.name} — média diária` : s.name;
    traces.push({
      x: timestamps,
      y: s.values,
      name: seriesName,
      mode: "lines",
      type: opts.type === "bar" ? "bar" : "scatter",
      line: {
        width: 2.2,
        color: color,
        shape: "spline",
        smoothing: 0.35
      },
      yaxis: isSecond ? "y2" : "y",
      fill: opts.fill ? "tozeroy" : undefined,
      fillcolor: opts.fill ? hexToRgba(color, 0.12) : undefined,
      hovertemplate: "<b>%{fullData.name}</b><br>Valor: <b>%{y:.2f}</b> " + (s.unit || "") + "<br>Data: %{x|%d/%m/%Y %H:%M}<extra></extra>"
    });
  });

  const layout = {
    ...CC_BASE_LAYOUT,
    paper_bgcolor: "#F8FAFC",
    plot_bgcolor: "#F8FAFC",
    xaxis: {
      ...CC_BASE_LAYOUT.xaxis,
      title: {
        text: opts.xTitle || "Data / Período de Medição",
        standoff: 10,
        font: { size: 11, color: "#64748B", weight: 600 }
      },
      type: "date",
      tickformat: opts.xTickformat || (grouped.groupBy === "day" || denseSeries ? "%d/%m" : "%b/%Y"),
      hoverformat: "%d/%m/%Y %H:%M"
    },
    yaxis: {
      ...CC_BASE_LAYOUT.yaxis,
      title: {
        text: opts.yTitle || (series[0] ? series[0].name : "Valor"),
        standoff: 12,
        font: { size: 11, color: CC_COLORS.azul, weight: 600 }
      },
      tickformat: opts.tickformat || ".1f"
    },
    shapes: opts.shapes || [],
    showlegend: true,
    annotations: opts.annotation ? [{
      x: 0,
      y: 1.14,
      xref: "paper",
      yref: "paper",
      text: opts.annotationText || "Linha principal: média diária • Hover: registros originais",
      showarrow: false,
      xanchor: "left",
      font: { size: 10, color: "#64748B" }
    }] : []
  };

  if(useDual){
    layout.yaxis2 = {
      ...CC_BASE_LAYOUT.yaxis,
      title: {
        text: opts.y2Title || (series[1] ? series[1].name : "Valor"),
        standoff: 12,
        font: { size: 11, color: CC_COLORS.verde, weight: 600 }
      },
      overlaying: "y",
      side: "right",
      showgrid: false,
      tickformat: opts.y2Tickformat || ".1f"
    };
    layout.margin = { ...layout.margin, r: 72 };
  }

  if (opts.dualAxis) {
    layout.legend = {
      ...CC_BASE_LAYOUT.legend,
      orientation: "h",
      x: 0,
      y: 1.12,
      itemwidth: 18,
      tracegroupgap: 12
    };
  }

  Plotly.newPlot(elId, traces, layout, CC_CONFIG);
}

function renderMeteorologyTimeSeries(elId, series, opts = {}){
  ccClear(elId);
  const traces = [];
  const dateFormat = opts.granularity === "hour" ? "%d/%m/%Y %H:%M" : "%d/%m/%Y";
  const dateLabel = opts.granularity === "hour" ? "Data" : "Período iniciado em";

  (series || []).forEach((item, index) => {
    const color = item.color || CC_PALETTE[index % CC_PALETTE.length];
    const validCount = item.statistics?.count || 0;
    if(!validCount) return;
    const lineType = item.values.length > 2500 ? "scattergl" : "scatter";
    const hoverTemplate = `<b>${item.name}</b><br>${dateLabel}: %{x|${dateFormat}}<br>Valor: <b>%{y:.3f}</b> ${item.unit || ""}<extra></extra>`;

    traces.push({
      x: item.timestamps,
      y: item.values,
      name: item.name,
      type: lineType,
      mode: "lines",
      connectgaps: false,
      line: { color, width: 2, shape: "linear" },
      hovertemplate: hoverTemplate
    });

    traces.push({
      x: item.timestamps,
      y: item.timestamps.map(() => item.statistics.mean),
      name: `Média · ${item.name}`,
      type: "scatter",
      mode: "lines",
      connectgaps: true,
      line: { color, width: 1, dash: "dot" },
      opacity: 0.65,
      hovertemplate: `<b>Média · ${item.name}</b><br>Valor: <b>%{y:.3f}</b> ${item.unit || ""}<extra></extra>`
    });

    [
      { kind: "Máximo", value: item.statistics.max, timestamp: item.statistics.maxTimestamp, symbol: "triangle-up" },
      { kind: "Mínimo", value: item.statistics.min, timestamp: item.statistics.minTimestamp, symbol: "triangle-down" }
    ].forEach(extremum => {
      if(extremum.value === null || !extremum.timestamp) return;
      traces.push({
        x: [extremum.timestamp],
        y: [extremum.value],
        name: `${extremum.kind} · ${item.name}`,
        type: "scatter",
        mode: "markers",
        showlegend: false,
        marker: { color, size: 9, symbol: extremum.symbol, line: { color: "#FFFFFF", width: 1 } },
        hovertemplate: `<b>${extremum.kind} · ${item.name}</b><br>${dateLabel}: %{x|${dateFormat}}<br>Valor: <b>%{y:.3f}</b> ${item.unit || ""}<extra></extra>`
      });
    });
  });

  if(!traces.length){
    const node = resolveEl(elId);
    if(node) node.innerHTML = '<div class="empty-state"><h4>Sem dados disponíveis</h4><p>Não há valores válidos para as séries neste recorte.</p></div>';
    return;
  }

  const layout = {
    ...CC_BASE_LAYOUT,
    paper_bgcolor: "#FFFFFF",
    plot_bgcolor: "#FFFFFF",
    margin: { t: 28, r: 20, b: 48, l: 58 },
    xaxis: {
      ...CC_BASE_LAYOUT.xaxis,
      type: "date",
      title: { text: "Data e hora da observação", standoff: 10, font: { size: 11, color: "#64748B", weight: 600 } },
      tickformat: opts.granularity === "hour" ? "%d/%m %H:%M" : (opts.granularity === "year" ? "%Y" : "%b/%Y"),
      hoverformat: dateFormat
    },
    yaxis: {
      ...CC_BASE_LAYOUT.yaxis,
      title: { text: opts.yTitle || "Valor", standoff: 12, font: { size: 11, color: "#334155", weight: 600 } },
      tickformat: opts.tickformat || ".2f",
      ...(opts.yRange ? { range: opts.yRange, autorange: false } : {})
    },
    legend: {
      ...CC_BASE_LAYOUT.legend,
      orientation: "h",
      y: -0.28,
      x: 0,
      itemclick: "toggle",
      itemdoubleclick: "toggleothers"
    },
    hovermode: "closest",
    showlegend: true
  };

  Plotly.newPlot(elId, traces, layout, CC_CONFIG);
}

/* =========================================================
   renderHistogram
   Histograma de distribuição de frequência agronômica.
   ========================================================= */
function renderHistogram(elId, values, label, color = CC_COLORS.azul){
  ccClear(elId);
  const validVals = values.filter(v => v !== null && !isNaN(v));
  const nbins = Math.max(12, Math.round(1 + 3.322 * Math.log10(Math.max(validVals.length, 2))));

  const trace = {
    x: validVals,
    type: "histogram",
    nbinsx: nbins,
    marker: {
      color: hexToRgba(color, 0.72),
      line: { color: color, width: 1 }
    },
    name: label,
    hovertemplate: "Faixa: <b>%{x}</b><br>Contagem: <b>%{y}</b> registros<extra></extra>"
  };

  Plotly.newPlot(elId, [trace], {
    ...CC_BASE_LAYOUT,
    bargap: 0.05,
    xaxis: {
      ...CC_BASE_LAYOUT.xaxis,
      title: { text: label, standoff: 10, font: { size: 11, color: "#334155", weight: 600 } }
    },
    yaxis: {
      ...CC_BASE_LAYOUT.yaxis,
      title: { text: "Frequência (Nº de Registros)", standoff: 12, font: { size: 11, color: "#334155", weight: 600 } }
    }
  }, CC_CONFIG);
}

/* =========================================================
   renderBoxplot
   Boxplot comparativo com quartis e dispersão limpa.
   ========================================================= */
function renderBoxplot(elId, seriesArr){
  ccClear(elId);
  const traces = seriesArr.map((s, i) => ({
    y: s.values,
    type: "box",
    name: s.name,
    marker: { color: CC_PALETTE[i % CC_PALETTE.length], size: 3.5 },
    line: { width: 1.6 },
    boxmean: true,
    boxpoints: "outliers",
    whiskerwidth: 0.7,
    hovertemplate:
      "<b>%{data.name}</b><br>" +
      "Máximo: <b>%{upperfence:.2f}</b><br>" +
      "Q3 (75%): <b>%{q3:.2f}</b><br>" +
      "Mediana: <b>%{median:.2f}</b><br>" +
      "Média: <b>%{mean:.2f}</b><br>" +
      "Q1 (25%): <b>%{q1:.2f}</b><br>" +
      "Mínimo: <b>%{lowerfence:.2f}</b><extra></extra>"
  }));

  Plotly.newPlot(elId, traces, {
    ...CC_BASE_LAYOUT,
    yaxis: {
      ...CC_BASE_LAYOUT.yaxis,
      title: { text: "Magnitude da Variável (Escala Própria)", standoff: 12, font: { size: 11, color: "#334155", weight: 600 } }
    },
    xaxis: {
      ...CC_BASE_LAYOUT.xaxis,
      title: { text: "Variável Analisada", standoff: 10, font: { size: 11, color: "#334155", weight: 600 } }
    }
  }, CC_CONFIG);
}

/* =========================================================
   renderScatterCompare
   Dispersão entre variáveis com regressão linear e coeficiente R².
   ========================================================= */
function calculateScatterMetrics(x, y){
  const pairs = [];
  for(let i = 0; i < Math.min(x.length, y.length); i++){
    if(x[i] !== null && y[i] !== null && !isNaN(x[i]) && !isNaN(y[i])){
      pairs.push([Number(x[i]), Number(y[i])]);
    }
  }
  if(pairs.length < 5) return { pairs, count: pairs.length, r: null, r2: null, slope: null, intercept: null };

  const xs = pairs.map(pair => pair[0]);
  const ys = pairs.map(pair => pair[1]);
  const n = pairs.length;
  const xm = xs.reduce((total, value) => total + value, 0) / n;
  const ym = ys.reduce((total, value) => total + value, 0) / n;
  let numerator = 0, denominatorX = 0, denominatorY = 0;
  for(let i = 0; i < n; i++){
    const dx = xs[i] - xm;
    const dy = ys[i] - ym;
    numerator += dx * dy;
    denominatorX += dx * dx;
    denominatorY += dy * dy;
  }
  const slope = denominatorX === 0 ? 0 : numerator / denominatorX;
  const intercept = ym - slope * xm;
  const r = (denominatorX > 0 && denominatorY > 0) ? numerator / Math.sqrt(denominatorX * denominatorY) : 0;
  return { pairs, count: n, r, r2: r * r, slope, intercept };
}

function renderScatterCompare(elId, x, y, xLabel, yLabel, pointTimestamps = []){
  ccClear(elId);
  const metrics = calculateScatterMetrics(x, y);
  const pairs = [];
  for(let i = 0; i < x.length; i++){
    if(x[i] !== null && y[i] !== null && !isNaN(x[i]) && !isNaN(y[i])){
      pairs.push([Number(x[i]), Number(y[i]), pointTimestamps[i] || null]);
    }
  }
  const xs = pairs.map(p => p[0]);
  const ys = pairs.map(p => p[1]);
  const pointCount = pairs.length;
  const pointSize = pointCount > 10000 ? 2.5 : pointCount > 5000 ? 3 : pointCount > 1500 ? 3.5 : 5;
  const pointOpacity = pointCount > 10000 ? 0.22 : pointCount > 5000 ? 0.28 : pointCount > 1500 ? 0.38 : 0.55;
  const pointHover = pointTimestamps.length
    ? xLabel + ": <b>%{x:.2f}</b><br>" + yLabel + ": <b>%{y:.2f}</b><br>Data: %{customdata|%d/%m/%Y %H:%M}<extra></extra>"
    : xLabel + ": <b>%{x:.2f}</b><br>" + yLabel + ": <b>%{y:.2f}</b><extra></extra>";

  const traces = [{
    x: xs, y: ys,
    mode: "markers", type: "scattergl",
    customdata: pairs.map(p => p[2]),
    marker: { color: CC_COLORS.azulClaro, size: pointSize, opacity: pointOpacity, line: { width: 0 } },
    name: "Observações de Campo",
    hovertemplate: pointHover
  }];

  if(metrics.count >= 5){
    let xMin = Infinity;
    let xMax = -Infinity;
    xs.forEach(value => {
      if(value < xMin) xMin = value;
      if(value > xMax) xMax = value;
    });
    traces.push({
      x: [xMin, xMax], y: [metrics.slope * xMin + metrics.intercept, metrics.slope * xMax + metrics.intercept],
      mode: "lines",
      line: { color: CC_COLORS.ambar, width: 2, dash: "solid" },
      name: "Tendência Linear",
      hoverinfo: "skip"
    });
  }

  Plotly.newPlot(elId, traces, {
    ...CC_BASE_LAYOUT,
    xaxis: { ...CC_BASE_LAYOUT.xaxis, title: { text: xLabel, standoff: 12, font: { size: 11, color: "#334155", weight: 600 } } },
    yaxis: { ...CC_BASE_LAYOUT.yaxis, title: { text: yLabel, standoff: 12, font: { size: 11, color: "#334155", weight: 600 } } },
    hovermode: "closest",
    legend: {
      ...CC_BASE_LAYOUT.legend,
      y: 1.08,
      x: 0.01
    }
  }, CC_CONFIG);
}

/* =========================================================
   renderCorrelationMatrix
   Heatmap de correlação de Pearson com valores numéricos nítidos.
   ========================================================= */
function renderCorrelationMatrix(elId, labels, matrix){
  ccClear(elId);
  const trace = {
    z: matrix, x: labels, y: labels, type: "heatmap",
    colorscale: [
      [0.0, "#DC2626"], // -1 correlação inversa forte (vermelho)
      [0.5, "#F8FAFC"], // 0 sem correlação (neutro)
      [1.0, "#059669"]  // +1 correlação direta forte (verde)
    ],
    zmin: -1, zmax: 1,
    hoverongaps: false,
    colorbar: {
      thickness: 14,
      title: { text: "Coef. Pearson (r)", side: "right", font: { size: 11, color: "#334155" } },
      tickvals: [-1, -0.5, 0, 0.5, 1],
      ticktext: ["-1,00", "-0,50", "0,00", "+0,50", "+1,00"],
      tickfont: { size: 10 }
    },
    hovertemplate: "<b>%{y}</b> × <b>%{x}</b><br>Correlação r = <b>%{z:.2f}</b><extra></extra>",
    text: matrix.map(row => row.map(v => v.toFixed(2))),
    texttemplate: "<b>%{text}</b>",
    textfont: { size: 11, color: "#1E293B" }
  };

  Plotly.newPlot(elId, [trace], {
    ...CC_BASE_LAYOUT,
    margin: { t: 25, r: 90, b: 90, l: 140 },
    xaxis: { ...CC_BASE_LAYOUT.xaxis, tickangle: -30, automargin: true },
    yaxis: { ...CC_BASE_LAYOUT.yaxis, autorange: "reversed", automargin: true },
    showlegend: false
  }, CC_CONFIG);
}

/* =========================================================
   renderSoilProfile
   Perfil estratificado de umidade volumétrica do solo (m³/m³ e %).
   layers: [{ label: string, value: number, desc?: string }]
   ========================================================= */
function renderSoilProfile(elId, layers){
  ccClear(elId);
  const values = layers.map(l => l.value);
  const maxVal = Math.max(...values.filter(v => v > 0), 0.05);

  const textLabels = values.map(v => {
    if(v <= 0) return "—";
    const percent = (v * 100).toFixed(1) + "%";
    return `${v.toFixed(3)} m³/m³  (${percent})`;
  });

  const trace = {
    x: values,
    y: layers.map(l => l.label),
    type: "bar",
    orientation: "h",
    marker: {
      color: CC_SOIL_PALETTE.slice(0, layers.length),
      line: { color: "#FFFFFF", width: 1.5 }
    },
    text: textLabels,
    textposition: "outside",
    textfont: { size: 11.5, color: "#1E293B", weight: 600 },
    hovertemplate: "<b>%{y}</b><br>Umidade volumétrica (θ): <b>%{x:.4f} m³/m³</b><extra></extra>",
    cliponaxis: false
  };

  Plotly.newPlot(elId, [trace], {
    ...CC_BASE_LAYOUT,
    margin: { t: 20, r: 140, b: 54, l: 220 },
    xaxis: {
      ...CC_BASE_LAYOUT.xaxis,
      title: {
        text: "Umidade volumétrica do solo — θ (m³/m³)",
        standoff: 10,
        font: { size: 11, color: "#334155", weight: 600 }
      },
      range: [0, Math.max(maxVal * 1.35, 0.25)],
      tickformat: ".3f",
      tickprefix: ""
    },
    yaxis: {
      ...CC_BASE_LAYOUT.yaxis,
      autorange: "reversed",
      title: {
        text: "Camada / profundidade do perfil",
        standoff: 12,
        font: { size: 11, color: "#334155", weight: 600 }
      }
    },
    annotations: [{
      x: 0.5,
      y: 1.08,
      xref: "paper",
      yref: "paper",
      text: "Leitura do perfil: cada barra representa um horizonte de solo e a água disponível em m³/m³.",
      showarrow: false,
      font: { size: 10.5, color: "#475569" }
    }],
    showlegend: false
  }, CC_CONFIG);
}

window.CajuCarbo = window.CajuCarbo || {};
Object.assign(window.CajuCarbo, {
  renderTimeSeries,
  renderMeteorologyTimeSeries,
  renderHistogram,
  renderBoxplot,
  renderScatterCompare,
  calculateScatterMetrics,
  renderCorrelationMatrix,
  renderSoilProfile,
  CC_COLORS,
  CC_PALETTE,
  CC_SOIL_PALETTE,
  hexToRgba
});
