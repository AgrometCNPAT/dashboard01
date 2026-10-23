/* =========================================================
   sections.jsx
   Seções ambientais consolidadas, análises e Produção Nacional.
   — Gráficos limpos, fluidos e altamente informativos para
     análise agronômica e tomada de decisão no campo.
   ========================================================= */

var { useEffect, useMemo, useState: useStateS } = React;
var { fmt, PlotlyChart, EmptyState, StatRow } = window.CajuCarbo;
var NUMERIC_FIELD_LABELS = window.CajuCarbo.NUMERIC_FIELD_LABELS;

function getField(normalized, field){
  return normalized.map(r => r[field]);
}
function onlyNumbers(arr){ return window.CajuCarbo.onlyNumbers(arr); }

function formatScatterMetric(value, decimals=3){
  return value === null || value === undefined || isNaN(value)
    ? "—"
    : Number(value).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function scatterInterpretation(metrics, xLabel, yLabel){
  if(metrics.count < 5 || metrics.r === null) return "Dados insuficientes para interpretar a relação entre as variáveis selecionadas.";
  const direction = metrics.r < 0 ? "Relação inversa" : "Relação direta";
  const magnitude = Math.abs(metrics.r) >= 0.7 ? "forte" : Math.abs(metrics.r) >= 0.4 ? "moderada" : "fraca";
  return `${direction} ${magnitude} entre ${xLabel.toLowerCase()} e ${yLabel.toLowerCase()}.`;
}

function lastValid(normalized, field){
  const vals = onlyNumbers(getField(normalized, field));
  return vals.length ? vals[vals.length-1] : null;
}

function timestamps(normalized){ return normalized.map(r => r.timestamp); }

/** Componente auxiliar para caixas de contexto agronômico */
function AgroGuide({ title, badge, badgeType="blue", items = [], children }){
  const modifier = badgeType === "green" ? "chart-agro-guide--green" : badgeType === "amber" ? "chart-agro-guide--amber" : "";
  const tagClass = `badge-tag badge-tag--${badgeType}`;
  return (
    <div className={`chart-agro-guide ${modifier}`}>
      <div className="chart-agro-guide__header">
        {badge && <span className={tagClass}>{badge}</span>}
        <span>{title}</span>
      </div>
      {children}
      {items.map((it, idx) => (
        <p key={idx}><strong>{it.label}:</strong> {it.text}</p>
      ))}
    </div>
  );
}

/* =========================== 01 — VISÃO GERAL =========================== */
function overviewDateLabel(value){
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "Não identificado");
}

function periodSelectionLabel(selection, metadata){
  if(!selection || selection.mode === "all"){
    if(!metadata.periodStart || !metadata.periodEnd) return "Período não identificado";
    return `${overviewDateLabel(metadata.periodStart)} — ${overviewDateLabel(metadata.periodEnd)}`;
  }
  if(selection.mode === "year") return `Ano ${selection.year}`;
  if(selection.mode === "month"){
    const month = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })
      .format(new Date(Date.UTC(selection.year, selection.month - 1, 1)));
    return `${month} de ${selection.year}`;
  }
  if(selection.mode === "week") return `Semana ${selection.week} · ${selection.year}`;
  if(selection.mode === "range") return `${overviewDateLabel(selection.startDate || "Início")} — ${overviewDateLabel(selection.endDate || "Fim")}`;
  return periodSelectionLabel({ mode: "all" }, metadata);
}

function WeatherMetric({ label, value, unit, period, marker, decimals=1, gaugeMax }){
  const hasValue = typeof value === "number" && Number.isFinite(value);
  const displayValue = hasValue && gaugeMax ? Math.max(0, Math.min(gaugeMax, value)) : value;
  const gaugeValue = hasValue && gaugeMax ? displayValue / gaugeMax * 100 : 0;
  return (
    <article className={"weather-metric" + (gaugeMax ? " weather-metric--gauge" : "")}>
      <div className="weather-metric__top">
        <span className="weather-metric__marker" aria-hidden="true">{marker}</span>
        <h3>{label}</h3>
      </div>
      {gaugeMax && hasValue ? (
        <div className="weather-gauge" role="meter" aria-label={label} aria-valuemin="0" aria-valuemax={gaugeMax} aria-valuenow={displayValue}
          style={{"--gauge-value": `${gaugeValue}%`}}>
          <div className="weather-gauge__inner">
            <strong>{fmt(displayValue, decimals)}</strong><span>{unit}</span>
          </div>
        </div>
      ) : (
        <div className={"weather-metric__value" + (!hasValue ? " is-missing" : "")}>
          {hasValue ? <><strong>{fmt(value, decimals)}</strong><span>{unit}</span></> : <span>Sem dados disponíveis</span>}
        </div>
      )}
      <div className="weather-metric__period">{period}</div>
    </article>
  );
}

function OverviewSection({ data }){
  const { hasData, metadata, statistics, periodTotals, selectedPeriod, missingOverviewFields = [] } = data;
  if(!hasData) return (
    <>
      <div className="view-header">
        <div className="eyebrow">CAJUCARBO — MONITORAMENTO METEOROLÓGICO</div>
        <h1>Visão Geral Meteorológica</h1>
      </div>
      <EmptyState title="Carregando dados meteorológicos..." desc="Os indicadores aparecerão após a leitura da base selecionada." />
    </>
  );

  const period = periodSelectionLabel(selectedPeriod, metadata);
  if(!data.normalized.length) return (
    <>
      <div className="view-header weather-overview__header">
        <div><div className="eyebrow">CAJUCARBO — MONITORAMENTO METEOROLÓGICO</div><h1>Visão Geral Meteorológica</h1></div>
        <div className="weather-overview__location"><span>Localidade ativa</span><strong>{metadata.datasetLabel || metadata.fileName}</strong></div>
      </div>
      <div className="weather-overview__summary"><div><span>Período selecionado</span><strong>{period}</strong></div><div><span>Observações válidas</span><strong>0</strong></div></div>
      <EmptyState title="Nenhum registro neste período" desc="Escolha outro período ou selecione Geral para restaurar os registros desta localidade." />
    </>
  );

  const value = (field, statistic) => statistics?.[field]?.[statistic] ?? null;
  const solarTotal = periodTotals?.ssrd_mjm2_dia ?? null;
  const precipitationTotal = periodTotals?.tp_mm_dia ?? periodTotals?.tp_mm ?? null;
  const sourceLabel = metadata.datasetLabel || metadata.fileName || "Localidade selecionada";

  return (
    <>
      <div className="view-header weather-overview__header">
        <div>
          <div className="eyebrow">CAJUCARBO — MONITORAMENTO METEOROLÓGICO</div>
          <h1>Visão Geral Meteorológica</h1>
          <p>Indicadores calculados sobre os registros válidos da localidade e do período selecionados.</p>
        </div>
        <div className="weather-overview__location">
          <span>Localidade ativa</span>
          <strong>{sourceLabel}</strong>
        </div>
      </div>

      <div className="weather-overview__summary" aria-live="polite">
        <div><span>Período selecionado</span><strong>{period}</strong></div>
        <div><span>Observações válidas</span><strong>{metadata.rowCount.toLocaleString("pt-BR")}</strong></div>
        <div><span>Coordenadas</span><strong>{metadata.latitude !== null && metadata.longitude !== null
          ? `${fmt(metadata.latitude, 3)}, ${fmt(metadata.longitude, 3)}` : "Não disponíveis"}</strong></div>
        {metadata.duplicateRowsRemoved > 0 && <div><span>Duplicatas removidas</span><strong>{metadata.duplicateRowsRemoved.toLocaleString("pt-BR")}</strong></div>}
      </div>

      {missingOverviewFields.length > 0 && (
        <div className="weather-data-warning" role="alert">
          <strong>Variáveis sem cabeçalho correspondente nesta base</strong>
          <span>{missingOverviewFields.join(" · ")}</span>
        </div>
      )}

      <div className="weather-overview">
        <section className="weather-category" aria-labelledby="weather-temperature-title">
          <div className="weather-category__heading"><h2 id="weather-temperature-title">Temperatura</h2><span>Valores em °C</span></div>
          <div className="weather-metric-grid">
            <WeatherMetric label="Temperatura máxima" marker="↑" value={value("t2m_c_max", "max")} unit="°C" period={period} />
            <WeatherMetric label="Temperatura mínima" marker="↓" value={value("t2m_c_min", "min")} unit="°C" period={period} />
            <WeatherMetric label="Temperatura média" marker="T" value={value("t2m_c_mean", "mean")} unit="°C" period={period} />
            <WeatherMetric label="Ponto de orvalho" marker="°" value={value("d2m_c", "mean")} unit="°C" period={period} />
          </div>
        </section>

        <section className="weather-category" aria-labelledby="weather-humidity-title">
          <div className="weather-category__heading"><h2 id="weather-humidity-title">Umidade relativa do ar</h2><span>Escala de 0 a 100%</span></div>
          <div className="weather-metric-grid weather-metric-grid--three">
            <WeatherMetric label="Umidade máxima" marker="↑" value={value("rh_max", "max")} unit="%" period={period} gaugeMax={100} />
            <WeatherMetric label="Umidade média" marker="UR" value={value("rh_mean", "mean")} unit="%" period={period} gaugeMax={100} />
            <WeatherMetric label="Umidade mínima" marker="↓" value={value("rh_min", "min")} unit="%" period={period} gaugeMax={100} />
          </div>
        </section>

        <section className="weather-category" aria-labelledby="weather-radiation-title">
          <div className="weather-category__heading"><h2 id="weather-radiation-title">Radiação e precipitação</h2><span>Totais do período</span></div>
          <div className="weather-metric-grid weather-metric-grid--two">
            <WeatherMetric label="Radiação global" marker="RG" value={solarTotal} unit="MJ/m²" period={period} decimals={2} />
            <WeatherMetric label="Chuva / precipitação" marker="CH" value={precipitationTotal} unit="mm" period={period} decimals={2} />
          </div>
        </section>

        <section className="weather-category" aria-labelledby="weather-wind-title">
          <div className="weather-category__heading"><h2 id="weather-wind-title">Vento e pressão atmosférica</h2><span>Médias do período</span></div>
          <div className="weather-metric-grid weather-metric-grid--two">
            <WeatherMetric label="Velocidade média do vento" marker="V" value={value("wind_speed_mean", "mean")} unit="m/s" period={period} decimals={2} />
            <WeatherMetric label="Pressão atmosférica média" marker="P" value={value("sp_hpa", "mean")} unit="hPa" period={period} decimals={1} />
          </div>
        </section>

        <section className="weather-category" aria-labelledby="weather-soil-title">
          <div className="weather-category__heading"><h2 id="weather-soil-title">Umidade do solo por camada</h2><span>Médias independentes · unidade volumétrica</span></div>
          <div className="weather-metric-grid">
            <WeatherMetric label="Camada 1 · 0–7 cm" marker="L1" value={value("swvl1", "mean")} unit="m³/m³" period={period} decimals={3} />
            <WeatherMetric label="Camada 2 · 7–28 cm" marker="L2" value={value("swvl2", "mean")} unit="m³/m³" period={period} decimals={3} />
            <WeatherMetric label="Camada 3 · 28–100 cm" marker="L3" value={value("swvl3", "mean")} unit="m³/m³" period={period} decimals={3} />
            <WeatherMetric label="Camada 4 · 100–289 cm" marker="L4" value={value("swvl4", "mean")} unit="m³/m³" period={period} decimals={3} />
          </div>
        </section>
      </div>
    </>
  );
}

const METEOROLOGY_SERIES = [
  { field: "t2m_c", name: "Temperatura do ar", unit: "°C", color: "#C05643", operation: "mean" },
  { field: "t2m_c_max", name: "Temperatura máxima", unit: "°C", color: "#C05643", operation: "max", dailySummary: true },
  { field: "t2m_c_min", name: "Temperatura mínima", unit: "°C", color: "#2E86AB", operation: "min", dailySummary: true },
  { field: "t2m_c_mean", name: "Temperatura média", unit: "°C", color: "#2A9D8F", operation: "mean", dailySummary: true },
  { field: "d2m_c", name: "Ponto de orvalho", unit: "°C", color: "#A23B72", operation: "mean" },
  { field: "skt_c", name: "Temperatura da superfície", unit: "°C", color: "#D97706", operation: "mean" },
  { field: "rh", name: "Umidade relativa do ar", unit: "%", color: "#2A9D8F", operation: "mean" },
  { field: "rh_max", name: "Umidade relativa máxima", unit: "%", color: "#2E86AB", operation: "max", dailySummary: true },
  { field: "rh_mean", name: "Umidade relativa média", unit: "%", color: "#2A9D8F", operation: "mean", dailySummary: true },
  { field: "rh_min", name: "Umidade relativa mínima", unit: "%", color: "#F18F01", operation: "min", dailySummary: true },
  { field: "ssrd_mjm2_dia", name: "Radiação global diária", unit: "MJ/m²/dia", color: "#F18F01", operation: "sum", dailySummary: true },
  { field: "ssrd_wm2", name: "Radiação solar global", unit: "W/m²", color: "#D97706", operation: "mean" },
  { field: "strd_wm2", name: "Radiação térmica atmosférica", unit: "W/m²", color: "#1E88E5", operation: "mean" },
  { field: "tp_mm", name: "Precipitação", unit: "mm", color: "#2E86AB", operation: "sum", nonNegative: true, precisionTolerance: 0.0001 },
  { field: "tp_mm_dia", name: "Precipitação diária", unit: "mm/dia", color: "#2E86AB", operation: "sum", dailySummary: true, nonNegative: true, precisionTolerance: 0.0001 },
  { field: "wind_speed", name: "Velocidade do vento", unit: "m/s", color: "#2A9D8F", operation: "mean" },
  { field: "wind_speed_mean", name: "Velocidade média do vento", unit: "m/s", color: "#2A9D8F", operation: "mean", dailySummary: true },
  { field: "u10", name: "Vento — componente U", unit: "m/s", color: "#5AA9D6", operation: "mean" },
  { field: "v10", name: "Vento — componente V", unit: "m/s", color: "#7CB342", operation: "mean" },
  { field: "sp_hpa", name: "Pressão atmosférica", unit: "hPa", color: "#415A77", operation: "mean" },
  { field: "sp_hpa_mean", name: "Pressão atmosférica média", unit: "hPa", color: "#415A77", operation: "mean", dailySummary: true },
  { field: "swvl1", name: "Camada 1 · 0–7 cm", unit: "m³/m³", color: "#68D391", operation: "mean" },
  { field: "swvl2", name: "Camada 2 · 7–28 cm", unit: "m³/m³", color: "#38A169", operation: "mean" },
  { field: "swvl3", name: "Camada 3 · 28–100 cm", unit: "m³/m³", color: "#22543D", operation: "mean" },
  { field: "swvl4", name: "Camada 4 · 100–289 cm", unit: "m³/m³", color: "#1A365D", operation: "mean" },
  { field: "vpd", name: "Déficit de pressão de vapor (VPD)", unit: "kPa", color: "#A23B72", operation: "mean" },
  { field: "amplitude_termica", name: "Amplitude térmica diária", unit: "°C", color: "#C05643", operation: "mean", dailySummary: true }
];

const METEOROLOGY_CHART_CATEGORIES = [
  {
    title: "Vento e pressão atmosférica",
    charts: [
      { id: "wind-components", title: "Componentes do vento", unit: "m/s", yTitle: "Componentes do vento (m/s)", fields: ["u10", "v10"] },
      { id: "pressure", title: "Evolução da pressão atmosférica", unit: "hPa", yTitle: "Pressão atmosférica (hPa)", fieldChoices: [["sp_hpa"], ["sp_hpa_mean"]] }
    ]
  },
  {
    title: "Solo",
    charts: [
      { id: "soil-temperature", title: "Temperatura da superfície", unit: "°C", yTitle: "Temperatura da superfície (°C)", fields: ["skt_c"] },
      { id: "soil", title: "Evolução da umidade do solo por camada", unit: "m³/m³", yTitle: "Umidade volumétrica (m³/m³)", fields: ["swvl1", "swvl2", "swvl3", "swvl4"], wide: true }
    ]
  },
  {
    title: "Radiação e energia",
    charts: [
      { id: "radiation", title: "Radiação solar global", unit: "MJ/m²/dia", yTitle: "Radiação solar global (MJ/m²/dia)", fieldChoices: [["ssrd_mjm2_dia"], ["ssrd_wm2"]] },
      { id: "thermal-radiation", title: "Radiação térmica atmosférica", unit: "W/m²", yTitle: "Radiação térmica atmosférica (W/m²)", fields: ["strd_wm2"] }
    ]
  },
  {
    title: "Indicadores derivados",
    charts: [
      { id: "vpd", title: "Déficit de pressão de vapor (VPD)", unit: "kPa", yTitle: "VPD (kPa)", fields: ["vpd"] },
      { id: "thermal-amplitude", title: "Amplitude térmica diária", unit: "°C", yTitle: "Amplitude térmica (°C)", fields: ["amplitude_termica"] }
    ]
  },
  {
    title: "Séries finais — monitoramento climatológico",
    charts: [
      { id: "temperature", title: "Evolução da temperatura do ar", unit: "°C", yTitle: "Temperatura do ar (°C)", fieldChoices: [["t2m_c"], ["t2m_c_max", "t2m_c_mean", "t2m_c_min"]], wide: true },
      { id: "dew-point", title: "Evolução do ponto de orvalho", unit: "°C", yTitle: "Ponto de orvalho (°C)", fields: ["d2m_c"] },
      { id: "humidity", title: "Evolução da umidade relativa", unit: "%", yTitle: "Umidade relativa (%)", yRange: [0, 100], fieldChoices: [["rh"], ["rh_max", "rh_mean", "rh_min"]], wide: true },
      { id: "precipitation", title: "Evolução da precipitação", unit: "mm", yTitle: "Precipitação (mm)", fieldChoices: [["tp_mm"], ["tp_mm_dia"]] },
      { id: "wind", title: "Evolução da velocidade do vento", unit: "m/s", yTitle: "Velocidade do vento (m/s)", fieldChoices: [["wind_speed"], ["wind_speed_mean"]] }
    ]
  }
];

function temporalDateLabel(timestamp){
  const match = String(timestamp || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if(!match) return "data indisponível";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function MeteorologySeriesChart({ chart, series }){
  const availableSeries = chart.fields.map(field => series.find(item => item.field === field))
    .filter(item => item && item.statistics.count > 0);
  const summaries = availableSeries.map(item => (
    <div key={item.field} className="meteorology-chart__summary-line">
      <strong>{item.name}</strong>
      <span>Mín {fmt(item.statistics.min, 2)} {item.unit} · {temporalDateLabel(item.statistics.minTimestamp)}</span>
      <span>Média {fmt(item.statistics.mean, 2)} {item.unit}</span>
      <span>Máx {fmt(item.statistics.max, 2)} {item.unit} · {temporalDateLabel(item.statistics.maxTimestamp)}</span>
    </div>
  ));
  const conflicts = availableSeries.reduce((total, item) => total + item.conflictingDailySummaries, 0);
  const precisionAdjusted = availableSeries.reduce((total, item) => total + item.precisionAdjustedValues, 0);
  const invalidValues = availableSeries.reduce((total, item) => total + item.invalidValueCount, 0);

  return (
    <article className={"panel meteorology-chart" + (chart.wide ? " meteorology-chart--wide" : "")}>
      <div className="panel__title"><h3>{chart.title}</h3><span className="meta">{chart.unit}</span></div>
      <div className="meteorology-chart__summary">
        {summaries.length ? summaries : <span>Sem dados disponíveis para esta variável nesta seleção.</span>}
      </div>
      {conflicts > 0 && <p className="meteorology-chart__notice">Foram encontradas variações em resumos diários repetidos em {conflicts} datas; os valores conflitantes foram mantidos na agregação.</p>}
      {precisionAdjusted > 0 && <p className="meteorology-chart__notice">{precisionAdjusted} valores negativos de precipitação, menores que 0,0001 mm, foram tratados como zero por precisão numérica; a fonte original não foi alterada.</p>}
      {invalidValues > 0 && <p className="meteorology-chart__notice">{invalidValues} valores negativos de precipitação acima da tolerância foram excluídos da série.</p>}
      <PlotlyChart className="chart-box tall" deps={[chart.id]} draw={node => window.CajuCarbo.renderMeteorologyTimeSeries(node, availableSeries, {
        granularity: "day",
        yTitle: chart.yTitle,
        yRange: chart.yRange,
        tickformat: chart.id === "soil" ? ".3f" : chart.id === "humidity" ? ".0f" : ".2f"
      })} />
    </article>
  );
}

function MeteorologySeriesSection({ data }){
  const { hasData, normalized, metadata, selectedPeriod } = data;
  const hasHourlyData = metadata.hasSubDailyData === true;
  const stationViews = useMemo(() => {
    const rows = normalized || [];
    const stationLabel = row => row.station_name && row.station_id && row.station_name !== row.station_id
      ? `${row.station_name} (${row.station_id})`
      : row.station_name || row.station_id || "";
    const stationLabels = metadata.stationLabels || [];
    const groups = stationLabels.length
      ? stationLabels.map(label => ({ label, rows: rows.filter(row => stationLabel(row) === label) }))
      : [{ label: "", rows }];
    if(stationLabels.length){
      const unidentifiedRows = rows.filter(row => !stationLabel(row));
      if(unidentifiedRows.length) groups.push({ label: "Estação não identificada", rows: unidentifiedRows });
    }

    return groups.map(group => {
      const groupHasHourlyData = new Set(group.rows.map(row => row.timestamp?.slice(0, 13)).filter(Boolean)).size
        > new Set(group.rows.map(row => row.timestamp?.slice(0, 10)).filter(Boolean)).size;
      const hasFieldData = field => group.rows.some(row => typeof row[field] === "number" && Number.isFinite(row[field]));
      const fieldChoices = {
        temperature: groupHasHourlyData ? ["t2m_c"] : ["t2m_c_max", "t2m_c_mean", "t2m_c_min"],
        humidity: groupHasHourlyData ? ["rh"] : ["rh_max", "rh_mean", "rh_min"],
        precipitation: groupHasHourlyData ? ["tp_mm"] : ["tp_mm_dia"],
        wind: groupHasHourlyData ? ["wind_speed"] : ["wind_speed_mean"],
        pressure: groupHasHourlyData ? ["sp_hpa"] : ["sp_hpa_mean"],
        radiation: ["ssrd_mjm2_dia"],
      };
      const categories = METEOROLOGY_CHART_CATEGORIES.map(category => ({
        ...category,
        charts: category.charts.map(chart => {
          if(!chart.fieldChoices) return chart;
          const preferred = fieldChoices[chart.id] || [];
          const fields = preferred.length && preferred.every(hasFieldData)
            ? preferred
            : chart.fieldChoices.find(choice => choice.every(hasFieldData)) || [];
          if(chart.id === "precipitation" && fields[0] === "tp_mm_dia"){
            return { ...chart, fields, unit: "mm/dia", yTitle: "Precipitação (mm/dia)" };
          }
          if(chart.id === "radiation" && fields[0] === "ssrd_wm2"){
            return { ...chart, fields, unit: "W/m²", yTitle: "Radiação solar global (W/m²)" };
          }
          return { ...chart, fields };
        }).filter(chart => chart.fields.some(hasFieldData))
      })).filter(category => category.charts.length);

      return {
        ...group,
        categories,
        series: window.CajuCarbo.aggregateMeteorologySeries(group.rows, METEOROLOGY_SERIES, "day")
      };
    });
  }, [normalized, metadata.stationLabels]);
  const availableVariableCount = new Set(stationViews.flatMap(view =>
    view.categories.flatMap(category => category.charts.flatMap(chart => chart.fields))
  )).size;

  if(!hasData) return <><Header n="02" t="Meteorologia" d="Evolução temporal das variáveis meteorológicas." /><EmptyState title="Carregando dados meteorológicos..." desc="Aguardando os registros da localidade selecionada." /></>;

  return (
    <>
      <Header n="02" t="Meteorologia" d="Evolução temporal das variáveis meteorológicas." />
      <div className="meteorology-page-summary">
        <div><span>Localidade</span><strong>{metadata.datasetLabel || metadata.fileName}</strong></div>
        {metadata.stationLabels?.length > 0 && <div><span>Estação / torre</span><strong>{metadata.stationLabels.join(" · ")}</strong></div>}
        <div><span>Período analisado</span><strong>{periodSelectionLabel(selectedPeriod, metadata)}</strong></div>
        <div><span>Observações válidas</span><strong>{metadata.rowCount.toLocaleString("pt-BR")}</strong></div>
        <div><span>Variáveis com dados</span><strong>{availableVariableCount}</strong></div>
        <div><span>Resolução de origem</span><strong>{hasHourlyData ? "Horária" : "Diária"}</strong></div>
        {metadata.latitude !== null && metadata.longitude !== null && <div><span>Coordenadas</span><strong>{fmt(metadata.latitude, 3)}, {fmt(metadata.longitude, 3)}</strong></div>}
        {metadata.duplicateRowsRemoved > 0 && <div><span>Duplicatas removidas</span><strong>{metadata.duplicateRowsRemoved.toLocaleString("pt-BR")}</strong></div>}
      </div>
      {metadata.conflictingObservationGroups > 0 && <p className="meteorology-chart__notice">{metadata.conflictingObservationGroups.toLocaleString("pt-BR")} grupos com medições conflitantes foram mantidos para preservar os dados de origem.</p>}
      <p className="meteorology-series-note">Os gráficos apresentam séries diárias agregadas conforme a natureza de cada variável; os filtros de período continuam sendo aplicados antes da agregação.</p>
      <div className="meteorology-series-groups">
        {stationViews.map(view => (
          <React.Fragment key={view.label || "all-stations"}>
            {view.categories.map(category => (
              <section className="weather-category" key={`${view.label}-${category.title}`}>
                <div className="weather-category__heading">
                  <h2>{category.title}</h2>
                  {stationViews.length > 1 && <span>{view.label}</span>}
                </div>
                <div className="meteorology-chart-grid">
                  {category.charts.map(chart => <MeteorologySeriesChart key={chart.id} chart={chart} series={view.series} />)}
                </div>
              </section>
            ))}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

function ComparativosSection({ data }){
  const { hasData, normalized, statistics } = data;
  const [varA, setVarA] = useStateS("t2m_c");
  const [varB, setVarB] = useStateS("rh");
  if(!hasData) return <><Header n="03" t="Análise Comparativa" d="Comparação de variáveis meteorológicas e déficit de pressão de vapor." /><EmptyState title="Carregando dados..." desc="Aguardando o processamento dos dados." /></>;

  const optsA = ["t2m_c","rh","sp_hpa","wind_speed","d2m_c","tp_mm_dia"];
  const optsB = ["rh","t2m_c","vpd","ssrd_wm2","tp_mm_dia","wind_speed"];
  const scatterX = getField(normalized, varA);
  const scatterY = getField(normalized, varB);
  const scatterXLabel = NUMERIC_FIELD_LABELS[varA];
  const scatterYLabel = NUMERIC_FIELD_LABELS[varB];
  const scatterMetrics = window.CajuCarbo.calculateScatterMetrics(scatterX, scatterY);

  return (
    <>
      <Header n="03" t="Análise Comparativa" d="Comparação de variáveis meteorológicas, correlações pareadas e déficit de pressão de vapor (VPD)." />
      <div className="filters-bar reveal">
        <div className="filter-field"><label>Variável Primária (Eixo Y Esquerdo)</label>
          <select value={varA} onChange={e=>setVarA(e.target.value)}>
            {optsA.map(f=><option key={f} value={f}>{NUMERIC_FIELD_LABELS[f]}</option>)}
          </select>
        </div>
        <div className="filter-field"><label>Variável Secundária (Eixo Y Direito)</label>
          <select value={varB} onChange={e=>setVarB(e.target.value)}>
            {optsB.map(f=><option key={f} value={f}>{NUMERIC_FIELD_LABELS[f]}</option>)}
          </select>
        </div>
      </div>

      <div className="panel reveal" style={{marginBottom:20}}>
        <div className="panel__title"><h3>Evolução Temporal Sincronizada</h3></div>
        <PlotlyChart className="chart-box tall" deps={[varA,varB]} draw={(n)=>window.CajuCarbo.renderTimeSeries(n, timestamps(normalized), [
          { name: NUMERIC_FIELD_LABELS[varA], values: getField(normalized,varA) },
          { name: NUMERIC_FIELD_LABELS[varB], values: getField(normalized,varB) }
        ], {
          dualAxis: true,
          groupBy: "day",
          showObservations: true,
          annotation: true,
          xTitle: "Data / Período de Observação",
          yTitle: NUMERIC_FIELD_LABELS[varA],
          y2Title: NUMERIC_FIELD_LABELS[varB]
        })} />
        <AgroGuide title="Análise Temporal Cruzada" badge="Comportamento" badgeType="blue" items={[
          { label: "Leitura do Gráfico", text: "As duas variáveis são traçadas em escalas independentes para visualização nítida de ciclos diurnos, frentes meteorológicas e correlações sazonais." }
        ]} />
      </div>

      <div className="grid grid-2 reveal-stagger">
        <div className="panel">
          <div className="panel__title"><h3>Dispersão e Tendência Linear</h3><span className="meta">R² / r</span></div>
          <StatRow
            pairs={[["R²", scatterMetrics.r2],["Correlação (r)", scatterMetrics.r],["Observações (n)", scatterMetrics.count]]}
            formatValue={(value, label) => label === "Observações (n)" ? value.toLocaleString("pt-BR") : formatScatterMetric(value)}
          />
          <PlotlyChart className="chart-box" deps={[varA,varB]} draw={(n)=>window.CajuCarbo.renderScatterCompare(n, scatterX, scatterY, scatterXLabel, scatterYLabel, timestamps(normalized))} />
          <AgroGuide title="Ajuste de Regressão Linear" badge="Estatística" badgeType="amber" items={[
            { label: "Interpretação", text: scatterInterpretation(scatterMetrics, scatterXLabel, scatterYLabel) },
            { label: "Indicadores", text: `R² = ${formatScatterMetric(scatterMetrics.r2)} · r = ${formatScatterMetric(scatterMetrics.r)} · n = ${scatterMetrics.count.toLocaleString("pt-BR")}` },
            { label: "Coeficiente de Determinação (R²)", text: "Mede o quanto a variação da variável Y é explicada pela variável X. Os pontos e a reta permanecem disponíveis para análise detalhada." }
          ]} />
        </div>

        <div className="panel">
          <div className="panel__title"><h3>Déficit de Pressão de Vapor (VPD)</h3><span className="meta">kPa</span></div>
          <StatRow pairs={[["Atual", lastValid(normalized,"vpd")],["Média", statistics.vpd?.mean],["Mínimo", statistics.vpd?.min],["Máximo", statistics.vpd?.max]]} />
          <PlotlyChart draw={(n)=>window.CajuCarbo.renderTimeSeries(n, timestamps(normalized), [{name:"VPD (Déficit de Pressão de Vapor)", values:getField(normalized,"vpd"), unit:"kPa"}], {
            groupBy:"day",
            showObservations:true,
            annotation:true,
            fill:true,
            xTitle:"Data / Hora do Registro",
            yTitle:"Déficit de Pressão de Vapor — VPD (kPa)",
            tickformat:".2f"
          })} />
          <AgroGuide title="Fisiologia Foliar — VPD no Cajueiro" badge="Estresse Hídrico" badgeType="green" items={[
            { label: "Faixa Ótima (&lt; 1,2 kPa)", text: "Estômatos totalmente abertos, absorção plena de CO₂ para fotossíntese sem perda hídrica excessiva." },
            { label: "Faixa de Atenção (1,2 a 2,0 kPa)", text: "Início do fechamento estomático preventivo para evitar desidratação." },
            { label: "Estresse Crítico (&gt; 2,0 kPa)", text: "Fechamento estomático severo, paralisação fotossintética e abortamento de flores no pomar." }
          ]} />
        </div>
      </div>
    </>
  );
}

function EstatisticaSection({ data }){
  const { hasData, normalized, statistics } = data;
  const fields = ["t2m_c","rh","sp_hpa","wind_speed","tp_mm_dia","vpd"].filter(f => statistics[f]?.count);
  const [statVar, setStatVar] = useStateS(fields[0] || "t2m_c");
  if(!hasData) return <><Header n="04" t="Análise Estatística" d="Estatística descritiva, distribuições e correlação." /><EmptyState title="Carregando dados..." desc="Aguardando o processamento dos dados." /></>;

  const s = statistics;
  const matrix = fields.map(a => fields.map(b => {
    const r = window.CajuCarbo.pearsonCorrelation(getField(normalized,a), getField(normalized,b));
    return r === null ? 0 : +r.toFixed(2);
  }));

  return (
    <>
      <Header n="04" t="Análise Estatística Avançada" d="Estatística descritiva completa, histogramas de distribuição de frequência, boxplots e matriz de correlação de Pearson." />
      <div className="filters-bar reveal">
        <div className="filter-field"><label>Selecionar Variável para Histograma</label>
          <select value={statVar} onChange={e=>setStatVar(e.target.value)}>
            {fields.map(f=><option key={f} value={f}>{NUMERIC_FIELD_LABELS[f]}</option>)}
          </select>
        </div>
      </div>

      <div className="panel reveal" style={{marginBottom:20, overflowX:"auto"}}>
        <div className="panel__title"><h3>Resumo Estatístico Paramétrico e Não-Paramétrico</h3></div>
        <table className="data-table">
          <thead><tr><th>Variável</th><th>Amostras (N)</th><th>Ausentes</th><th>Média</th><th>Mediana</th><th>Desvio Padrão</th><th>Mínimo</th><th>Máximo</th><th>P25 (Q1)</th><th>P75 (Q3)</th></tr></thead>
          <tbody>
            {fields.map(f => { const d = s[f]; return (
              <tr key={f}>
                <td><strong>{NUMERIC_FIELD_LABELS[f]}</strong></td><td>{d.count.toLocaleString("pt-BR")}</td><td>{d.missing}</td>
                <td>{fmt(d.mean,2)}</td><td>{fmt(d.median,2)}</td><td>{fmt(d.stddev,2)}</td>
                <td>{fmt(d.min,2)}</td><td>{fmt(d.max,2)}</td><td>{fmt(d.p25,2)}</td><td>{fmt(d.p75,2)}</td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      <div className="grid grid-2 reveal-stagger" style={{marginBottom:20}}>
        <div className="panel">
          <div className="panel__title"><h3>Distribuição de Frequência (Histograma)</h3></div>
          <PlotlyChart deps={[statVar]} draw={(n)=>window.CajuCarbo.renderHistogram(n, onlyNumbers(getField(normalized,statVar)), NUMERIC_FIELD_LABELS[statVar])} />
          <AgroGuide title="Análise de Distribuição" badge="Frequência" badgeType="blue" items={[
            { label: "Interpretação", text: `Mostra a concentração de leituras em cada intervalo de ${NUMERIC_FIELD_LABELS[statVar]}, permitindo identificar modas e assimetrias na série.` }
          ]} />
        </div>

        <div className="panel">
          <div className="panel__title"><h3>Boxplot Comparativo (Quartis e Outliers)</h3></div>
          <PlotlyChart draw={(n)=>window.CajuCarbo.renderBoxplot(n, fields.map(f=>({name:NUMERIC_FIELD_LABELS[f].split(" (")[0], values:onlyNumbers(getField(normalized,f))})))} />
          <AgroGuide title="Dispersão Interquartil" badge="Quartis" badgeType="amber" items={[
            { label: "Elementos do Boxplot", text: "Linha central = Mediana; Caixa = 50% dos dados centrais (Q1 a Q3); Hastes = Limites superior/inferior; Pontos soltos = Outliers estatísticos." }
          ]} />
        </div>
      </div>

      <div className="panel reveal">
        <div className="panel__title"><h3>Matriz de Correlação Linear de Pearson</h3></div>
        <PlotlyChart className="chart-box tall" draw={(n)=>window.CajuCarbo.renderCorrelationMatrix(n, fields.map(f=>NUMERIC_FIELD_LABELS[f].split(" (")[0]), matrix)} />
        <div className="corr-scale"><span>-1,00 (Inversa Forte)</span><div className="bar"></div><span>+1,00 (Direta Forte)</span></div>
        <AgroGuide title="Interpretação da Matriz de Correlação" badge="Pearson r" badgeType="green" items={[
          { label: "Valores Próximos a +1,0 (Verde)", text: "Forte correlação direta: quando uma variável cresce, a outra tende a crescer proporcionalmente." },
          { label: "Valores Próximos a -1,0 (Vermelho)", text: "Forte correlação inversa (ex: Temperatura vs Umidade Relativa: r = -0,85)." }
        ]} />
      </div>
    </>
  );
}

const PRODUCTION_UF_NAMES = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins"
};

const HISTORICAL_PRODUCTION_UFS = new Set(["BA", "CE", "MA", "PI", "RN"]);
const PRODUCTION_PLOT_ORIGINALS = new WeakMap();

function normalizeProductionSearch(value){
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function readProductionPlot(iframe){
  const graph = iframe?.contentDocument?.querySelector(".js-plotly-plot");
  if(!graph?._fullData?.length) return null;
  if(!PRODUCTION_PLOT_ORIGINALS.has(graph)){
    PRODUCTION_PLOT_ORIGINALS.set(graph, graph._fullData.map(trace => ({
      name: trace.name,
      x: Array.from(trace.x || []),
      y: Array.from(trace.y || []),
      text: trace.text === undefined ? undefined : Array.from(trace.text || []),
      visible: trace.visible === undefined ? true : trace.visible
    })));
  }
  return { graph, traces: graph._fullData, original: PRODUCTION_PLOT_ORIGINALS.get(graph) };
}

function readProduction2024Metrics(iframe, uf){
  const plot = readProductionPlot(iframe);
  if(!plot) return null;
  const traces = plot.original;
  const stateIndex = Array.from(traces[0].y || []).indexOf(uf);
  if(stateIndex < 0) return null;
  const metrics = traces.map(trace => Number(trace.x[stateIndex]));
  if(metrics.some(value => !Number.isFinite(value))) return null;
  return { uf, production: metrics[0], area: metrics[1], yield: metrics[2] };
}

function productionFrameHasState(iframe, uf){
  const plot = readProductionPlot(iframe);
  if(!plot) return false;
  if(iframe.dataset.productionUf) return iframe.dataset.productionUf === uf;
  if(iframe.id === "production-2024-source") return plot.original[0].y.includes(uf);
  return plot.original.some(trace => trace.name === uf);
}

function updateProductionFrame(iframe, category, uf){
  const plot = readProductionPlot(iframe);
  if(!plot || !iframe.contentWindow?.Plotly) return false;
  const { graph, original } = plot;
  const indices = original.map((_, index) => index);
  let updates;

  if(category === "national"){
    updates = {
      x: original.map(trace => trace.x),
      y: original.map(trace => trace.y),
      visible: original.map(trace => trace.visible)
    };
    if(original.some(trace => trace.text !== undefined)) updates.text = original.map(trace => trace.text || []);
  } else if(!uf || !productionFrameHasState(iframe, uf)){
    updates = {
      x: original.map(() => []),
      y: original.map(() => []),
      visible: original.map(() => false)
    };
  } else if(iframe.id === "production-2024-source"){
    const matches = original[0].y.indexOf(uf);
    updates = {
      x: original.map(trace => [trace.x[matches]]),
      y: original.map(() => [uf]),
      visible: original.map(() => true)
    };
    if(original.some(trace => trace.text !== undefined)) updates.text = original.map(trace => trace.text ? [trace.text[matches]] : []);
  } else if(iframe.dataset.productionUf === uf){
    updates = {
      x: original.map(trace => trace.x),
      y: original.map(trace => trace.y),
      visible: original.map(() => true)
    };
    if(original.some(trace => trace.text !== undefined)) updates.text = original.map(trace => trace.text || []);
  } else {
    updates = {
      x: original.map(trace => trace.name === uf ? trace.x : []),
      y: original.map(trace => trace.name === uf ? trace.y : []),
      visible: original.map(trace => trace.name === uf)
    };
  }

  iframe.contentWindow.Plotly.restyle(graph, updates, indices);
  return category === "national" || productionFrameHasState(iframe, uf);
}

function ProducaoSection(){
  const [category, setCategory] = useStateS("national");
  const [stateQuery, setStateQuery] = useStateS("");
  const [availableStates, setAvailableStates] = useStateS([]);
  const selectedState = availableStates.find(state => {
    const query = normalizeProductionSearch(stateQuery);
    return query && (query === normalizeProductionSearch(state.name) || query === normalizeProductionSearch(state.uf));
  }) || null;
  const stateSuggestions = stateQuery && !selectedState
    ? availableStates.filter(state => {
      const query = normalizeProductionSearch(stateQuery);
      return normalizeProductionSearch(state.name).includes(query) || normalizeProductionSearch(state.uf).includes(query);
    }).slice(0, 6)
    : [];

  const update2024Data = iframe => {
    const plot = readProductionPlot(iframe);
    if(!plot) return;
    const codes = plot.original[0].y;
    setAvailableStates(codes
      .filter(code => PRODUCTION_UF_NAMES[code])
      .map(uf => ({ uf, name: PRODUCTION_UF_NAMES[uf] }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")));
  };

  useEffect(() => {
    document.querySelectorAll("[data-production-chart]").forEach(frame => {
      updateProductionFrame(frame, category, category === "state" ? selectedState?.uf : null);
    });
  }, [category, selectedState?.uf]);

  const chooseCategory = nextCategory => {
    setCategory(nextCategory);
    setStateQuery("");
  };

  const items = [
    ["1_panorama_nacional_2024.html", "Panorama Nacional da Castanha de Caju (2024)"],
    ["2_evolucao_producao.html", "Evolução Histórica da Produção (Toneladas)"],
    ["3_evolucao_area.html", "Evolução da Área Plantada e Colhida (Hectares)"],
    ["4_evolucao_rendimento.html", "Evolução do Rendimento Médio (kg/ha)"],
    ["5_ceara_serie_temporal.html", "Ceará — Série Temporal e Dinâmica Produtiva"],
    ["6_ceara_vs_brasil_producao.html", "Participação Ceará vs. Brasil — Produção"],
    ["7_ceara_vs_brasil_area.html", "Participação Ceará vs. Brasil — Área"],
    ["8_ceara_vs_brasil_rendimento.html", "Comparativo Ceará vs. Brasil — Rendimento"]
  ];
  const productionMetrics = category === "state" && selectedState
    ? readProduction2024Metrics(document.getElementById("production-2024-source"), selectedState.uf)
    : null;

  return (
    <>
      <Header n="▤" t="Produção Nacional de Castanha de Caju" d="Painéis analíticos da produção agrícola brasileira e cearense (dados IBGE/PAM), contextualizando o impacto socioeconômico da cultura." />
      <div className="filters-bar reveal">
        <div className="filter-field">
          <label>Categoria</label>
          <div role="group" aria-label="Categoria de produção" style={{display:"inline-flex", border:"1px solid var(--cinza-200, #D7DEE7)", borderRadius:6, overflow:"hidden"}}>
            {[ ["national", "Nacional"], ["state", "Estadual"] ].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={category === value} onClick={() => chooseCategory(value)}
                style={{border:0, padding:"9px 16px", background:category === value ? "var(--azul-900, #001B3D)" : "#FFFFFF", color:category === value ? "#FFFFFF" : "var(--azul-900, #001B3D)", fontWeight:600, cursor:"pointer"}}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {category === "state" && (
          <div className="filter-field">
            <label htmlFor="production-state-search">Estado</label>
            <input id="production-state-search" type="search" list="production-state-options" value={stateQuery}
              placeholder={availableStates.length ? "Pesquisar estado..." : "Carregando estados..."}
              disabled={!availableStates.length} autoComplete="off"
              onChange={event => setStateQuery(event.target.value)} />
            <datalist id="production-state-options">
              {availableStates.map(state => <option key={state.uf} value={state.name} label={state.uf} />)}
            </datalist>
            {stateSuggestions.length > 0 && (
              <div role="listbox" aria-label="Estados encontrados" style={{display:"flex", flexWrap:"wrap", gap:6, marginTop:8}}>
                {stateSuggestions.map(state => (
                  <button key={state.uf} type="button" role="option" onClick={() => setStateQuery(state.name)}
                    style={{border:"1px solid var(--cinza-200, #D7DEE7)", borderRadius:4, padding:"6px 10px", background:"#FFFFFF", color:"var(--azul-900, #001B3D)", cursor:"pointer"}}>
                    {state.name} <span style={{color:"var(--cinza-400, #64748B)"}}>({state.uf})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {category === "state" && (
        <>
          {selectedState ? (
            <div className="view-header">
              <div className="eyebrow">PRODUÇÃO ESTADUAL · {selectedState.uf}</div>
              <h2>{selectedState.name}</h2>
              <p>Os painéis abaixo mostram apenas os registros disponíveis para esta unidade federativa.</p>
            </div>
          ) : (
            <EmptyState title={stateQuery ? "Selecione um estado disponível" : "Pesquise um estado"}
              desc={stateQuery && !stateSuggestions.length ? "Nenhum estado da base corresponde a essa pesquisa." : "Os gráficos permanecem no formato original e serão filtrados após selecionar uma UF disponível."} />
          )}
          {productionMetrics && selectedState && productionMetrics.uf === selectedState.uf ? (
            <div className="grid grid-3">
              {[
                ["Produção em 2024", productionMetrics.production, "t"],
                ["Área em 2024", productionMetrics.area, "ha"],
                ["Rendimento em 2024", productionMetrics.yield, "kg/ha"]
              ].map(([label, value, unit]) => (
                <article className="panel" key={label}>
                  <div className="panel__title"><h3>{label}</h3><span className="meta">{unit}</span></div>
                  <div style={{fontFamily:"var(--fonte-num)", fontSize:24, fontWeight:700, color:"var(--azul-900)"}}>{fmt(value, 0)} <small style={{fontSize:13, color:"var(--cinza-400)", fontWeight:600}}>{unit}</small></div>
                </article>
              ))}
            </div>
          ) : selectedState ? (
            <EmptyState title="Indicadores de 2024 indisponíveis" desc={`A fonte de 2024 não contém registros para ${selectedState.name}.`} />
          ) : null}
          {selectedState && <div className="meteorology-series-note">As séries sem observações para {selectedState.name} permanecem identificadas nos respectivos painéis; nenhuma outra UF é usada como substituta.</div>}
        </>
      )}

      <div className="grid production-panels reveal-stagger">
        {items.map(([file, title]) => (
          <div className="panel" key={file}>
            <div className="panel__title"><h3>{title}</h3></div>
            {category === "state" && selectedState && !productionFrameHasState(document.querySelector(`[data-production-chart="${file}"]`), selectedState.uf) && (
              <p className="meteorology-chart__notice">Não há série para {selectedState.name} neste painel. O gráfico original é mantido e não substituído por dados de outra UF.</p>
            )}
            <iframe id={file.startsWith("1_") ? "production-2024-source" : undefined}
              data-production-chart={file}
              data-production-uf={file.startsWith("5_") ? "CE" : undefined}
              src={`../${file}`} className="embed-frame tall" title={title}
              onLoad={event => {
                if(file.startsWith("1_")) update2024Data(event.currentTarget);
                updateProductionFrame(event.currentTarget, category, category === "state" ? selectedState?.uf : null);
              }} />
          </div>
        ))}
      </div>
      <div className="panel reveal" style={{marginTop:20}}>
        <div className="panel__title"><h3>Produção Municipal no Ceará — 2024</h3></div>
        {category === "state" && selectedState && selectedState.uf !== "CE" && (
          <p className="meteorology-chart__notice">Este detalhamento contém somente municípios do Ceará; não representa {selectedState.name}.</p>
        )}
        <iframe data-production-chart="municipios-ceara" data-production-uf="CE"
          src="../9_municipios_ceara_2024.html" className="embed-frame tall" title="Municípios do Ceará"
          onLoad={event => updateProductionFrame(event.currentTarget, category, category === "state" ? selectedState?.uf : null)} />
      </div>
    </>
  );
}

/* ---- Cabeçalho de seção reutilizável ---- */
function Header({ n, t, d }){
  return (
    <div className="view-header reveal">
      <div className="eyebrow">SEÇÃO {n}</div>
      <h1>{t}</h1>
      <p>{d}</p>
    </div>
  );
}

window.CajuCarbo = window.CajuCarbo || {};
Object.assign(window.CajuCarbo, {
  OverviewSection, MeteorologySeriesSection, ComparativosSection, EstatisticaSection, ProducaoSection
});
