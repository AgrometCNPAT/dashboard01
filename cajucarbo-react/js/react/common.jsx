/* =========================================================
   common.jsx
   Componentes compartilhados: intro 3D, navegação, PlotlyChart,
   estados vazios e pequenos helpers de exibição.
   ========================================================= */

var { useEffect, useRef, useState, useContext } = React;
var CC = window.CajuCarbo;
const DataRevisionContext = React.createContext("");

function fmt(v, decimals=1){
  return (v === null || v === undefined || isNaN(v))
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Wrapper genérico para qualquer gráfico Plotly. `draw` recebe o nó DOM. */
function PlotlyChart({ draw, deps = [], className = "chart-box" }){
  const ref = useRef(null);
  const dataRevision = useContext(DataRevisionContext);
  useEffect(() => {
    if(ref.current) draw(ref.current);
    return () => { if(ref.current && ref.current.data) Plotly.purge(ref.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataRevision, ...deps]);
  return <div ref={ref} className={className}></div>;
}

function CountUp({ value, decimals=0 }){
  const ref = useRef(null);
  useEffect(() => {
    if(ref.current && typeof value === "number") CC.countUp(ref.current, value, { decimals });
  }, [value]);
  return <span ref={ref} className="count-up">{typeof value === "number" ? "0" : "—"}</span>;
}

function EmptyState({ title, desc }){
  return (
    <div className="empty-state">
      <h4>{title}</h4>
      <p>{desc}</p>
    </div>
  );
}

function StatRow({ pairs, formatValue }){
  return (
    <div style={{display:"flex", gap:18, flexWrap:"wrap", marginBottom:14}}>
      {pairs.map(([label, val], i) => (
        <div key={i}>
          <div style={{fontSize:11, color:"var(--cinza-400)", fontWeight:600}}>{label}</div>
          <div style={{fontFamily:"var(--fonte-num)", fontSize:18, fontWeight:700, color:"var(--azul-900)"}}>{formatValue ? formatValue(val, label) : fmt(val)}</div>
        </div>
      ))}
    </div>
  );
}

function BigStat({ value, unit }){
  return (
    <div style={{fontFamily:"var(--fonte-num)", fontSize:30, fontWeight:700, color:"var(--azul-900)"}}>
      {fmt(value)}<small style={{fontSize:14, color:"var(--cinza-400)", fontWeight:600}}> {unit}</small>
    </div>
  );
}

/* ---------------------------------------------------------
   Intro (abertura 3D)
--------------------------------------------------------- */
function IntroOverlay({ hidden }){
  const canvasHostRef = useRef(null);

  useEffect(() => {
    if(hidden || !canvasHostRef.current || !window.THREE) return;
    const scene = CC.createParticleNetwork3D(canvasHostRef.current, {
      count: 36, color: 0xffffff, linkColor: 0x2E8B57, radius: 6.5, cameraZ: 8
    });
    return () => scene.dispose();
  }, [hidden]);

  return (
    <div className={"intro" + (hidden ? " is-hidden" : "")}>
      <div className="intro__canvas" ref={canvasHostRef}></div>
      <div className="intro__content">
        <img src="../brand/cajucarbo-logo.png" alt="CajuCarbo" className="intro__logo" />
        <div className="intro__mark">EMBRAPA</div>
        <div className="intro__title">CajuCarbo</div>
        <p className="intro__tagline">Monitoramento e inteligência de dados para sistemas agrícolas</p>
        <p className="intro__desc">A plataforma transforma dados ambientais em informações para análise científica.</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Navegação lateral
--------------------------------------------------------- */
const NAV_ITEMS = [
  { id: "overview", num: "01", label: "Visão Geral" },
  { id: "cultivo", num: "02", label: "Meteorologia" },
  { id: "meteorologia", num: "03", label: "Comparativos" },
  { id: "stats", num: "04", label: "Análise Estatística" },
  { id: "fenologia", num: "05", label: "Fenologia" },
  { id: "producao", num: "▤", label: "Produção Nacional" },
];

function Sidebar({ active, onSelect, navOpen }){
  return (
    <nav className={"sidenav" + (navOpen ? " is-open" : "")} id="sidenav">
      <div className="sidenav__brand">
        <div className="sidenav__brand-row">
          <img src="../brand/cajucarbo-logo.png" alt="CajuCarbo" className="sidenav__logo" />
          <div>
            <div className="sidenav__brand-mark">CajuCarbo</div>
            <div className="sidenav__brand-sub">Data Intelligence Platform</div>
          </div>
        </div>
      </div>
      <ul className="sidenav__list">
        {NAV_ITEMS.map(item => (
          <li
            key={item.id}
            className={"sidenav__item" + (active === item.id ? " is-active" : "")}
            onClick={() => onSelect(item)}
          >
            <span className="num">{item.num}</span> {item.label}
          </li>
        ))}
      </ul>
      <div className="sidenav__foot">Embrapa · Projeto CajuCarbo<br/>Plataforma de análise de dados ambientais</div>
    </nav>
  );
}

/* ---------------------------------------------------------
   Alternador de fonte de dados (consome o registro em datasets.js)
--------------------------------------------------------- */
function DatasetSwitcher({ datasetId, onChange, uploadedLabel, className = "" }){
  const datasets = CC.CC_DATASETS;
  return (
    <div className={`dataset-switcher ${className}`.trim()}>
      <label htmlFor="dataset-select">Fonte de dados</label>
      <select
        id="dataset-select"
        value={datasetId}
        onChange={(e) => onChange(e.target.value)}
      >
        {datasets.map(d => (
          <option key={d.id} value={d.id} disabled={d.status !== "available"}>
            {d.label}{d.status !== "available" ? " (em breve)" : ""}
          </option>
        ))}
        {uploadedLabel && <option value="uploaded">{uploadedLabel} · importado</option>}
      </select>
    </div>
  );
}

function Topbar({ activeItem, status, onToggleNav }){
  const pillClass = status === "ready" ? "status-pill is-online" : (status === "error" ? "status-pill" : "status-pill is-waiting");
  const pillLabel = status === "ready" ? "Dados conectados" : (status === "error" ? "Falha ao carregar dados" : "Carregando dados...");
  return (
    <header className="topbar">
      <div style={{display:"flex", alignItems:"center", minWidth:0}}>
        <button className="nav-toggle" onClick={onToggleNav} aria-label="Menu">☰</button>
        <div className="topbar__section-title"><span>{activeItem.num}</span>{activeItem.label}</div>
      </div>
      <div className="topbar__right">
        <span className={pillClass}><span className="dot"></span> {pillLabel}</span>
      </div>
    </header>
  );
}

function PeriodFilter({ periods, selection, onChange, recordCount, datasetId, onDatasetChange, uploadedLabel }){
  const years = selection.mode === "week" ? periods.isoYears : periods.years;
  const months = periods.monthsByYear[selection.year] || [];
  const weeks = periods.weeksByYear[selection.year] || [];
  const update = patch => onChange(CC.normalizePeriodSelection(periods, { ...selection, ...patch }));
  let periodLabel = "Todos os períodos";
  if(selection.mode === "year") periodLabel = `Ano ${selection.year}`;
  if(selection.mode === "month") periodLabel = `${months.find(item => item.value === Number(selection.month))?.label || "Mês"} de ${selection.year}`;
  if(selection.mode === "week") periodLabel = `Semana ${String(selection.week).padStart(2, "0")} · ano ISO ${selection.year}`;
  if(selection.mode === "range") periodLabel = selection.startDate && selection.endDate
    ? `${selection.startDate} a ${selection.endDate}` : "Escolha as datas do intervalo";

  return (
    <div className="filters-bar period-filter" aria-label="Filtro de período">
      <div className="period-filter__location-group">
        <DatasetSwitcher datasetId={datasetId} onChange={onDatasetChange} uploadedLabel={uploadedLabel} className="filter-field" />
        <div className="filter-field">
          <label htmlFor="period-mode">Período</label>
          <select id="period-mode" value={selection.mode} onChange={event => update({ mode: event.target.value })}>
            <option value="all">Geral · todos os períodos</option>
            <option value="year">Anual</option>
            <option value="month">Mensal</option>
            <option value="week">Semanal</option>
            <option value="range">Intervalo personalizado</option>
          </select>
        </div>
      </div>

      {["year", "month", "week"].includes(selection.mode) && (
        <div className="filter-field">
          <label htmlFor="period-year">{selection.mode === "week" ? "Ano ISO" : "Ano"}</label>
          <select id="period-year" value={selection.year} onChange={event => update({ year: Number(event.target.value) })}>
            {years.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      )}

      {selection.mode === "month" && (
        <div className="filter-field">
          <label htmlFor="period-month">Mês disponível</label>
          <select id="period-month" value={selection.month} onChange={event => update({ month: Number(event.target.value) })}>
            {months.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
          </select>
        </div>
      )}

      {selection.mode === "week" && (
        <div className="filter-field">
          <label htmlFor="period-week">Semana disponível</label>
          <select id="period-week" value={selection.week} onChange={event => update({ week: Number(event.target.value) })}>
            {weeks.map(week => <option key={week.value} value={week.value}>{week.label}</option>)}
          </select>
        </div>
      )}

      {selection.mode === "range" && (
        <>
          <div className="filter-field"><label htmlFor="period-start">Data inicial</label>
            <input id="period-start" type="date" value={selection.startDate} onChange={event => update({ startDate: event.target.value })} />
          </div>
          <div className="filter-field"><label htmlFor="period-end">Data final</label>
            <input id="period-end" type="date" value={selection.endDate} min={selection.startDate || undefined} onChange={event => update({ endDate: event.target.value })} />
          </div>
        </>
      )}

      <div className="period-filter__summary" aria-live="polite">
        <strong>{periodLabel}</strong>
        <span>{recordCount.toLocaleString("pt-BR")} observações</span>
      </div>

      {(periods.undatedCount > 0 || periods.invalidDateCount > 0) && (
        <p className="period-filter__notice" role="status">
          {periods.undatedCount.toLocaleString("pt-BR")} observações sem data completa permanecem em Geral e não entram nos recortes temporais.
          {periods.invalidDateCount > 0 && ` ${periods.invalidDateCount.toLocaleString("pt-BR")} datas inválidas foram identificadas.`}
        </p>
      )}
    </div>
  );
}

window.CajuCarbo = window.CajuCarbo || {};
Object.assign(window.CajuCarbo, {
  fmt, PlotlyChart, CountUp, EmptyState, StatRow, BigStat,
  IntroOverlay, Sidebar, Topbar, PeriodFilter, DataRevisionContext, NAV_ITEMS,
});
