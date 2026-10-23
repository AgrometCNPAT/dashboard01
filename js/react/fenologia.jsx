var { useState } = React;

function loadFenologiaData(){
  const payload = window.CajuCarbo?.FENOLOGIA_DATA;
  if(!payload?.data?.["24h"] || !payload?.data?.["10h14h"] || !payload?.stats){
    return Promise.reject(new Error("Os dados fenológicos não foram incluídos no bundle. Gere novamente o dashboard com node build.js."));
  }
  return Promise.resolve(payload);
}

function fenologiaTraceSeries(data, column, indexes, colors){
  const masked = values => indexes.map(index => values?.[index]);
  const dates = masked(data.datas);
  const cropMean = masked(data.cultura_media[column] || []);
  const cropMin = masked(data.cultura_min[column] || []);
  const cropMax = masked(data.cultura_max[column] || []);
  const interrowMean = masked(data.entrelinha_media[column] || []);
  const interrowMin = masked(data.entrelinha_min[column] || []);
  const interrowMax = masked(data.entrelinha_max[column] || []);

  return [
    {
      x: [...dates, ...dates.slice().reverse()],
      y: [...cropMax, ...cropMin.slice().reverse()],
      fill: "toself",
      fillcolor: "rgba(0,105,60,0.12)",
      line: { color: "transparent" },
      name: "Cultura (min–max)",
      showlegend: false,
      hoverinfo: "skip",
    },
    {
      x: [...dates, ...dates.slice().reverse()],
      y: [...interrowMax, ...interrowMin.slice().reverse()],
      fill: "toself",
      fillcolor: "rgba(201,138,31,0.14)",
      line: { color: "transparent" },
      name: "Entrelinha (min–max)",
      showlegend: false,
      hoverinfo: "skip",
    },
    {
      x: dates,
      y: cropMean,
      mode: "lines+markers",
      name: "Cultura (média)",
      line: { color: colors.crop, width: 2.5 },
      marker: { size: 4, color: colors.crop },
    },
    {
      x: dates,
      y: interrowMean,
      mode: "lines+markers",
      name: "Entrelinha (média)",
      line: { color: colors.interrow, width: 2.5 },
      marker: { size: 4, color: colors.interrow },
    },
  ];
}

function fenologiaTraceDetails(data, column, indexes, colors){
  const dates = indexes.map(index => data.datas[index]);
  return data.rois.map(roi => ({
    x: dates,
    y: indexes.map(index => roi.valores[column]?.[index]),
    mode: "lines",
    name: roi.nome,
    line: {
      color: roi.tipo === "cultura" ? colors.crop : colors.interrow,
      width: 1.2,
      dash: roi.tipo === "cultura" ? "solid" : "dot",
    },
    opacity: 0.7,
    legendgroup: roi.tipo,
    showlegend: false,
    hovertemplate: `${roi.nome}<br>%{x}<br>%{y:.4f}<extra></extra>`,
  }));
}

function FenologiaSection(){
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [scenario, setScenario] = useState("24h");
  const [statistic, setStatistic] = useState("p90");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detailIndex, setDetailIndex] = useState(null);
  const gridRef = React.useRef(null);
  const detailPlotRef = React.useRef(null);
  const detailSectionRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    loadFenologiaData().then(data => {
      if(!cancelled) setPayload(data);
    }).catch(loadError => {
      if(!cancelled) setError(loadError.message || "Não foi possível processar os dados fenológicos.");
    });
    return () => { cancelled = true; };
  }, []);

  const plotData = payload?.data[scenario];
  const dateIndexes = React.useMemo(() => {
    if(!plotData) return [];
    return plotData.datas.map((date, index) => (
      (!startDate || date >= startDate) && (!endDate || date <= endDate) ? index : -1
    )).filter(index => index >= 0);
  }, [plotData, startDate, endDate]);

  React.useEffect(() => {
    if(!plotData || !gridRef.current || !window.Plotly) return undefined;
    const colors = { crop: "#00693C", interrow: "#C98A1F" };
    const hosts = [];
    const layoutBase = {
      paper_bgcolor: "#FFFFFF",
      plot_bgcolor: "#FFFFFF",
      font: { color: "#2B3140", size: 11, family: "Inter, Arial, sans-serif" },
      margin: { l: 45, r: 15, t: 30, b: 40 },
      xaxis: { gridcolor: "#DEE2E8", zerolinecolor: "#DEE2E8", color: "#5B6472" },
      yaxis: { gridcolor: "#DEE2E8", zerolinecolor: "#DEE2E8", color: "#5B6472" },
      showlegend: true,
      legend: { bgcolor: "rgba(255,255,255,0.85)", bordercolor: "#DEE2E8", borderwidth: 1, font: { size: 10 } },
      hovermode: "x unified",
    };
    gridRef.current.replaceChildren();

    ["Rcc", "Gcc", "Bcc", "ExG", "ExR", "VARI", "GLI"].forEach(indexName => {
      const card = document.createElement("div");
      card.className = "fenologia__chart-card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Abrir detalhamento do índice ${indexName}`);
      const plot = document.createElement("div");
      plot.className = "fenologia__mini-plot";
      card.appendChild(plot);
      gridRef.current.appendChild(card);
      hosts.push(plot);

      const layout = JSON.parse(JSON.stringify(layoutBase));
      layout.title = { text: indexName, font: { size: 13, color: "#001B3D" } };
      layout.showlegend = false;
      layout.margin = { l: 40, r: 10, t: 30, b: 35 };
      layout.xaxis.tickformat = "%d/%m";
      layout.xaxis.nticks = 6;
      layout.yaxis.tickformat = ".3f";
      const openDetail = () => setDetailIndex(indexName);
      card.addEventListener("click", openDetail);
      card.addEventListener("keydown", event => {
        if(event.key === "Enter" || event.key === " "){
          event.preventDefault();
          openDetail();
        }
      });
      window.Plotly.newPlot(
        plot,
        fenologiaTraceSeries(plotData, `${indexName}_${statistic}`, dateIndexes, colors),
        { ...layout, height: 260 },
        { displayModeBar: false, responsive: true }
      );
    });

    return () => {
      hosts.forEach(host => {
        if(host.data) window.Plotly.purge(host);
      });
      if(gridRef.current) gridRef.current.replaceChildren();
    };
  }, [plotData, statistic, dateIndexes]);

  React.useEffect(() => {
    if(!detailIndex || !plotData || !detailPlotRef.current || !window.Plotly) return undefined;
    const colors = { crop: "#00693C", interrow: "#C98A1F" };
    const layout = {
      paper_bgcolor: "#FFFFFF",
      plot_bgcolor: "#FFFFFF",
      font: { color: "#2B3140", size: 11, family: "Inter, Arial, sans-serif" },
      margin: { l: 45, r: 15, t: 30, b: 40 },
      xaxis: { gridcolor: "#DEE2E8", zerolinecolor: "#DEE2E8", color: "#5B6472", tickformat: "%d/%m" },
      yaxis: { gridcolor: "#DEE2E8", zerolinecolor: "#DEE2E8", color: "#5B6472", tickformat: ".3f" },
      showlegend: true,
      legend: { bgcolor: "rgba(255,255,255,0.85)", bordercolor: "#DEE2E8", borderwidth: 1, font: { size: 10 } },
      hovermode: "closest",
      height: 500,
    };
    window.Plotly.newPlot(
      detailPlotRef.current,
      fenologiaTraceDetails(plotData, `${detailIndex}_${statistic}`, dateIndexes, colors),
      layout,
      { displayModeBar: true, responsive: true }
    );
    detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    return () => {
      if(detailPlotRef.current?.data) window.Plotly.purge(detailPlotRef.current);
    };
  }, [detailIndex, plotData, statistic, dateIndexes]);

  React.useEffect(() => () => {
    if(gridRef.current){
      gridRef.current.querySelectorAll(".js-plotly-plot").forEach(plot => {
        if(plot.data) window.Plotly.purge(plot);
      });
    }
    if(detailPlotRef.current?.data) window.Plotly.purge(detailPlotRef.current);
  }, []);

  function resetFilters(){
    setStartDate("");
    setEndDate("");
  }

  if(error){
    return (
      <div className="fenologia" role="alert">
        <div className="fenologia__error">
          <strong>Não foi possível carregar o dashboard fenológico.</strong>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if(!payload){
    return <div className="fenologia"><div className="fenologia__loading">Carregando dados fenológicos...</div></div>;
  }

  const stats = payload.stats[scenario];
  const dateBounds = payload.data["24h"].datas;

  return (
    <div className="fenologia">
      <div className="view-header fenologia__header">
        <div className="eyebrow">ANÁLISE FENOLÓGICA</div>
        <h1>Dashboard Fenológico</h1>
        <p>Câmera Fenológica — Torre Micrometeorológica</p>
      </div>

      <div className="fenologia__controls">
        <div className="fenologia__control">
          <span className="fenologia__label">Cenário</span>
          <div className="fenologia__toggle" role="group" aria-label="Cenário">
            <button type="button" className={scenario === "24h" ? "is-active" : ""} aria-pressed={scenario === "24h"} onClick={() => { setScenario("24h"); setDetailIndex(null); }}>24h (todas)</button>
            <button type="button" className={scenario === "10h14h" ? "is-active" : ""} aria-pressed={scenario === "10h14h"} onClick={() => { setScenario("10h14h"); setDetailIndex(null); }}>10h–14h</button>
          </div>
        </div>
        <label className="fenologia__control">
          <span className="fenologia__label">Estatística</span>
          <select value={statistic} onChange={event => { setStatistic(event.target.value); setDetailIndex(null); }}>
            <option value="p90">p90 — melhor luz do dia</option>
            <option value="med">med — mediana do dia</option>
            <option value="p50">p50 — percentil 50</option>
            <option value="p10">p10 — luz baixa / sombra</option>
          </select>
        </label>
        <div className="fenologia__control">
          <span className="fenologia__label">Período</span>
          <div className="fenologia__date-range">
            <input aria-label="Data inicial" type="date" min={dateBounds[0]} max={dateBounds[dateBounds.length - 1]} value={startDate} onChange={event => setStartDate(event.target.value)} />
            <span aria-hidden="true">—</span>
            <input aria-label="Data final" type="date" min={dateBounds[0]} max={dateBounds[dateBounds.length - 1]} value={endDate} onChange={event => setEndDate(event.target.value)} />
          </div>
        </div>
        <button className="fenologia__reset" type="button" onClick={resetFilters}>Resetar</button>
      </div>

      <div className="fenologia__cards">
        <article className="fenologia__metric-card">
          <span className="fenologia__metric-label">Dias com dados</span>
          <strong>{stats.n_dias}</strong>
          <span className="fenologia__metric-sub">{stats.data_ini} → {stats.data_fim}</span>
        </article>
        <article className="fenologia__metric-card">
          <span className="fenologia__metric-label">ROIs monitoradas</span>
          <strong>{stats.n_rois}</strong>
          <span className="fenologia__metric-sub">12 cultura + 12 entrelinha</span>
        </article>
        <article className="fenologia__metric-card">
          <span className="fenologia__metric-label">Imagens/dia (média)</span>
          <strong>{stats.n_imgs_med.toFixed(1)}</strong>
          <span className="fenologia__metric-sub">por ROI</span>
        </article>
        <article className="fenologia__metric-card">
          <span className="fenologia__metric-label">Cenário</span>
          <strong>{scenario === "24h" ? "24 horas" : "10h–14h"}</strong>
          <span className="fenologia__metric-sub">{scenario === "24h" ? "todas as imagens" : "só meio do dia"}</span>
        </article>
      </div>

      <section className="fenologia__section">
        <h2>Visão geral — todos os índices</h2>
        {dateIndexes.length === 0 && <div className="fenologia__no-data">Não há observações no período selecionado.</div>}
        <div className="fenologia__grid" ref={gridRef} />
      </section>

      {detailIndex && (
        <section className="fenologia__detail" ref={detailSectionRef}>
          <div className="fenologia__detail-header">
            <h2>{detailIndex}_{statistic} — detalhado (24 ROIs) — cenário {scenario}</h2>
            <button type="button" onClick={() => setDetailIndex(null)}>✕ Fechar</button>
          </div>
          <div className="fenologia__detail-plot" ref={detailPlotRef} />
        </section>
      )}
    </div>
  );
}

Object.assign(window.CajuCarbo, { FenologiaSection });
