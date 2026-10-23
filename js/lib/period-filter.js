/* =========================================================
   period-filter.js
   Índice de períodos, filtragem, métricas e agrupamento temporal.
   ========================================================= */

const CC_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function parsePeriodDate(value){
  if(value instanceof Date && Number.isFinite(value.getTime())){
    return makePeriodParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if(value === null || value === undefined) return null;
  const text = String(value).trim();
  if(!text) return null;

  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i);
  if(match) return makePeriodParts(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if(match) return makePeriodParts(Number(match[3]), Number(match[2]), Number(match[1]));
  return null;
}

function makePeriodParts(year, month, day){
  if(!Number.isInteger(year) || year < 1000 || year > 9999) return null;
  if(!Number.isInteger(month) || month < 1 || month > 12) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if(date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  const weekday = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - weekday);
  const isoYear = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);

  return {
    year,
    month,
    day,
    dateKey: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    isoYear,
    isoWeek
  };
}

function normalizePeriodMonth(value){
  if(value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const numeric = text.match(/^\d{1,2}$/);
  if(numeric){
    const month = Number(text);
    return month >= 1 && month <= 12 ? month : null;
  }
  const monthNames = [
    ["janeiro", "jan"], ["fevereiro", "fev"], ["marco", "mar"], ["abril", "abr"],
    ["maio", "mai"], ["junho", "jun"], ["julho", "jul"], ["agosto", "ago"],
    ["setembro", "set"], ["outubro", "out"], ["novembro", "nov"], ["dezembro", "dez"]
  ];
  const normalized = text.replace(/[^a-z]/g, "");
  const index = monthNames.findIndex(names => names.includes(normalized));
  return index < 0 ? null : index + 1;
}

function getPeriodParts(row){
  const timestampParts = parsePeriodDate(row?.timestamp) || parsePeriodDate(row?.timestampRaw);
  if(timestampParts) return timestampParts;

  const year = Number(row?.period_year);
  if(!Number.isInteger(year) || year < 1000 || year > 9999) return null;
  const month = normalizePeriodMonth(row?.period_month);
  const rawWeek = String(row?.period_week ?? "").match(/\d{1,2}/);
  const week = rawWeek ? Number(rawWeek[0]) : null;
  const validWeek = Number.isInteger(week) && week >= 1 && week <= 53;
  const isoYear = !validWeek ? null
    : month === 1 && week >= 52 ? year - 1
    : month === 12 && week === 1 ? year + 1
    : year;
  return {
    year,
    month,
    day: null,
    dateKey: null,
    isoYear,
    isoWeek: validWeek ? week : null
  };
}

function buildPeriodIndex(rows){
  const entries = (rows || []).map(row => ({ row, parts: getPeriodParts(row) }));
  return {
    entries,
    undatedCount: entries.filter(entry => !entry.parts?.dateKey).length,
    invalidDateCount: entries.filter(({row}) => {
      const raw = row.timestampRaw;
      return raw !== null && raw !== undefined && String(raw).trim() !== "" && !parsePeriodDate(raw);
    }).length
  };
}

function getAvailablePeriods(indexOrRows){
  const index = Array.isArray(indexOrRows) ? buildPeriodIndex(indexOrRows) : indexOrRows;
  const years = new Set();
  const isoYears = new Set();
  const monthsByYear = {};
  const weeksByYear = {};

  (index?.entries || []).forEach(({parts}) => {
    if(!parts) return;
    if(parts.year){
      years.add(parts.year);
      if(parts.month){
        monthsByYear[parts.year] ||= new Set();
        monthsByYear[parts.year].add(parts.month);
      }
    }
    if(parts.isoYear && parts.isoWeek){
      isoYears.add(parts.isoYear);
      weeksByYear[parts.isoYear] ||= new Set();
      weeksByYear[parts.isoYear].add(parts.isoWeek);
    }
  });

  const sortedYears = values => Array.from(values).sort((a,b)=>a-b);
  const monthOptions = {};
  Object.entries(monthsByYear).forEach(([year, months]) => {
    monthOptions[year] = Array.from(months).sort((a,b)=>a-b)
      .map(value => ({ value, label: CC_MONTHS[value - 1] }));
  });
  const weekOptions = {};
  Object.entries(weeksByYear).forEach(([year, weeks]) => {
    weekOptions[year] = Array.from(weeks).sort((a,b)=>a-b)
      .map(value => ({ value, label: `Semana ${String(value).padStart(2, "0")} · ${year}` }));
  });

  return {
    years: sortedYears(years),
    isoYears: sortedYears(isoYears),
    monthsByYear: monthOptions,
    weeksByYear: weekOptions,
    undatedCount: index?.undatedCount || 0,
    invalidDateCount: index?.invalidDateCount || 0,
    datedCount: (index?.entries || []).filter(entry => !!entry.parts?.dateKey).length
  };
}

function normalizePeriodSelection(periods, selection = {}){
  let mode = ["all", "year", "month", "week", "range"].includes(selection.mode) ? selection.mode : "all";
  if(mode !== "all" && mode !== "range" && !periods.years.length && !periods.isoYears.length) mode = "all";
  if(mode === "all") return { mode: "all", year: "", month: "", week: "", startDate: "", endDate: "" };

  const years = mode === "week" ? periods.isoYears : periods.years;
  const selectedYear = Number(selection.year);
  const year = years.includes(selectedYear) ? selectedYear : (years[years.length - 1] ?? "");
  const months = periods.monthsByYear[year] || [];
  const weeks = periods.weeksByYear[year] || [];
  const selectedMonth = Number(selection.month);
  const selectedWeek = Number(selection.week);

  return {
    mode,
    year,
    month: mode === "month" ? (months.some(option => option.value === selectedMonth) ? selectedMonth : (months[0]?.value ?? "")) : "",
    week: mode === "week" ? (weeks.some(option => option.value === selectedWeek) ? selectedWeek : (weeks[0]?.value ?? "")) : "",
    startDate: mode === "range" ? String(selection.startDate || "") : "",
    endDate: mode === "range" ? String(selection.endDate || "") : ""
  };
}

function filterDataByPeriod(index, selection){
  const periods = getAvailablePeriods(index);
  const normalizedSelection = normalizePeriodSelection(periods, selection);
  const rows = index.entries.filter(({parts}) => {
    if(normalizedSelection.mode === "all") return true;
    if(!parts) return false;
    if(normalizedSelection.mode === "year") return parts.year === Number(normalizedSelection.year);
    if(normalizedSelection.mode === "month") return parts.year === Number(normalizedSelection.year) && parts.month === Number(normalizedSelection.month);
    if(normalizedSelection.mode === "week") return parts.isoYear === Number(normalizedSelection.year) && parts.isoWeek === Number(normalizedSelection.week);
    if(normalizedSelection.mode === "range"){
      if(!normalizedSelection.startDate || !normalizedSelection.endDate || normalizedSelection.startDate > normalizedSelection.endDate) return false;
      return !!parts.dateKey && parts.dateKey >= normalizedSelection.startDate && parts.dateKey <= normalizedSelection.endDate;
    }
    return false;
  }).map(entry => entry.row);

  return { rows, selection: normalizedSelection, undatedCount: rows.filter(row => !getPeriodParts(row)?.dateKey).length };
}

function sumPeriodField(rows, field, deduplicateByDay = false){
  const values = new Map();
  let total = 0;
  let count = 0;
  (rows || []).forEach((row, index) => {
    const rawValue = row[field];
    if(rawValue === null || rawValue === undefined || rawValue === "") return;
    const value = Number(rawValue);
    if(!Number.isFinite(value)) return;
    if(!deduplicateByDay){ total += value; count++; return; }
    const day = getPeriodParts(row)?.dateKey || `row-${index}`;
    const group = values.get(day) || { total: 0, count: 0 };
    group.total += value;
    group.count++;
    values.set(day, group);
  });
  if(deduplicateByDay){
    values.forEach(group => { total += group.total / group.count; count++; });
  }
  return count ? total : null;
}

function calculatePeriodMetrics(rows, fields){
  const statistics = window.CajuCarbo.calculateStatistics(rows, fields);
  const totals = {
    tp_mm: sumPeriodField(rows, "tp_mm"),
    tp_mm_dia: sumPeriodField(rows, "tp_mm_dia", true),
    ssrd_mjm2_dia: sumPeriodField(rows, "ssrd_mjm2_dia", true)
  };
  Object.entries(totals).forEach(([field, total]) => {
    if(statistics[field]) statistics[field].sum = total;
  });
  return { statistics, totals, observationCount: rows.length };
}

function groupDataForCharts(timestamps, series, preferredGroupBy){
  const points = (timestamps || []).map((timestamp, index) => ({
    timestamp,
    parts: parsePeriodDate(timestamp),
    index
  })).filter(point => point.parts);
  if(!points.length) return { timestamps: timestamps || [], series: series || [], groupBy: "none" };

  const years = new Set(points.map(point => point.parts.year));
  const months = new Set(points.map(point => `${point.parts.year}-${point.parts.month}`));
  const weeks = new Set(points.map(point => `${point.parts.isoYear}-W${point.parts.isoWeek}`));
  const days = new Set(points.map(point => point.parts.dateKey));
  let groupBy = ["month", "week", "day"].includes(preferredGroupBy) ? preferredGroupBy : "none";
  if(groupBy === "none"){
    if(years.size === 1 && months.size > 1) groupBy = "month";
    else if(months.size === 1 && weeks.size > 1) groupBy = "week";
    else if(points.length > days.size) groupBy = "day";
  }
  if(groupBy === "none") return { timestamps: timestamps || [], series: series || [], groupBy };

  const groups = new Map();
  points.forEach(point => {
    const {year, month, dateKey, isoYear, isoWeek} = point.parts;
    const key = groupBy === "month" ? `${year}-${String(month).padStart(2, "0")}`
      : groupBy === "week" ? `${isoYear}-W${String(isoWeek).padStart(2, "0")}`
      : dateKey;
    const group = groups.get(key) || { key, dateKey, timestamp: point.timestamp, series: (series || []).map(() => []) };
    if(dateKey < group.dateKey){ group.dateKey = dateKey; group.timestamp = timestamp; }
    (series || []).forEach((item, seriesIndex) => {
      const rawValue = item.values?.[point.index];
      if(rawValue === null || rawValue === undefined || rawValue === "") return;
      const value = Number(rawValue);
      if(Number.isFinite(value)) group.series[seriesIndex].push(value);
    });
    groups.set(key, group);
  });

  const sorted = Array.from(groups.values()).sort((a,b)=>a.dateKey.localeCompare(b.dateKey));
  return {
    timestamps: sorted.map(group => group.timestamp),
    series: (series || []).map((item, seriesIndex) => ({
      ...item,
      values: sorted.map(group => {
        const values = group.series[seriesIndex];
        if(!values.length) return null;
        const total = values.reduce((sum,value)=>sum+value,0);
        return item.aggregate === "sum" ? total : total / values.length;
      })
    })),
    groupBy,
    observations: sorted.map(group => group.series.map(values => values.length))
  };
}

function aggregateNumericValues(values, operation){
  const valid = (values || []).map(Number).filter(Number.isFinite);
  if(!valid.length) return null;
  if(operation === "max") return Math.max(...valid);
  if(operation === "min") return Math.min(...valid);
  if(operation === "sum") return valid.reduce((total, value) => total + value, 0);
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}

function temporalBucketKey(parts, timestamp, granularity){
  if(granularity === "hour") return String(timestamp).slice(0, 13);
  if(granularity === "day") return parts.dateKey;
  if(granularity === "week") return `${parts.isoYear}-W${String(parts.isoWeek).padStart(2, "0")}`;
  if(granularity === "month") return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  return String(parts.year);
}

function isoWeekMonday(dateKey){
  const date = new Date(`${dateKey}T00:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date;
}

function parseTemporalInstant(timestamp){
  const value = String(timestamp || "");
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(" ", "T")}Z`;
  return new Date(normalized);
}

function buildTemporalTimeline(entries, granularity){
  if(!entries.length) return [];
  const first = entries[0];
  const last = entries[entries.length - 1];
  const timeline = [];

  if(granularity === "hour"){
    const cursor = parseTemporalInstant(first.timestamp);
    const end = parseTemporalInstant(last.timestamp);
    if(Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return [];
    cursor.setUTCMinutes(0, 0, 0);
    end.setUTCMinutes(0, 0, 0);
    for(; cursor <= end; cursor.setUTCHours(cursor.getUTCHours() + 1)){
      const timestamp = cursor.toISOString().slice(0, 19);
      timeline.push({ key: timestamp.slice(0, 13), timestamp });
    }
    return timeline;
  }

  if(granularity === "day"){
    const cursor = new Date(`${first.parts.dateKey}T00:00:00Z`);
    const end = new Date(`${last.parts.dateKey}T00:00:00Z`);
    for(; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)){
      const dateKey = cursor.toISOString().slice(0, 10);
      timeline.push({ key: dateKey, timestamp: `${dateKey}T00:00:00` });
    }
    return timeline;
  }

  if(granularity === "week"){
    const cursor = isoWeekMonday(first.parts.dateKey);
    const end = isoWeekMonday(last.parts.dateKey);
    for(; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 7)){
      const dateKey = cursor.toISOString().slice(0, 10);
      const parts = parsePeriodDate(dateKey);
      timeline.push({
        key: `${parts.isoYear}-W${String(parts.isoWeek).padStart(2, "0")}`,
        timestamp: `${dateKey}T00:00:00`
      });
    }
    return timeline;
  }

  if(granularity === "month"){
    const cursor = new Date(Date.UTC(first.parts.year, first.parts.month - 1, 1));
    const end = new Date(Date.UTC(last.parts.year, last.parts.month - 1, 1));
    for(; cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)){
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      timeline.push({ key, timestamp: `${key}-01T00:00:00` });
    }
    return timeline;
  }

  for(let year = first.parts.year; year <= last.parts.year; year++){
    timeline.push({ key: String(year), timestamp: `${year}-01-01T00:00:00` });
  }
  return timeline;
}

function aggregateMeteorologySeries(rows, definitions, granularity = "day"){
  const allowed = ["hour", "day", "week", "month", "year"];
  const resolution = allowed.includes(granularity) ? granularity : "day";
  const entries = (rows || []).map((row, index) => {
    const timestamp = row.timestamp || row.timestampRaw;
    const parts = getPeriodParts(row);
    return { row, index, timestamp: String(timestamp || ""), parts };
  }).filter(entry => entry.timestamp && entry.parts?.dateKey)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.index - right.index);

  return (definitions || []).map(definition => {
    let precisionAdjustedValues = 0;
    let invalidValueCount = 0;
    const parsedEntries = entries.map(entry => {
      const raw = entry.row[definition.field];
      let value = raw === null || raw === undefined || raw === "" ? null : Number(raw);
      if(!Number.isFinite(value)) value = null;
      if(value !== null && definition.nonNegative && value < 0){
        if(value >= -(definition.precisionTolerance ?? 0)){
          value = 0;
          precisionAdjustedValues++;
        } else {
          value = null;
          invalidValueCount++;
        }
      }
      return { ...entry, value };
    });
    let points = [];
    let outputGranularity = resolution;
    let conflictingDailySummaries = 0;

    if(definition.dailySummary){
      const days = new Map();
      parsedEntries.forEach(entry => {
        const day = days.get(entry.parts.dateKey) || { key: entry.parts.dateKey, timestamp: entry.timestamp, values: [] };
        if(entry.timestamp < day.timestamp) day.timestamp = entry.timestamp;
        if(entry.value !== null) day.values.push(entry.value);
        days.set(entry.parts.dateKey, day);
      });
      const dailyPoints = Array.from(days.values()).sort((a,b)=>a.key.localeCompare(b.key)).map(day => {
        const distinctValues = Array.from(new Set(day.values));
        if(distinctValues.length > 1) conflictingDailySummaries++;
        return {
          key: day.key,
          timestamp: day.timestamp,
          value: aggregateNumericValues(
            distinctValues,
            definition.operation === "sum" && distinctValues.length > 1 ? "mean" : definition.operation
          )
        };
      });

      if(resolution === "hour" || resolution === "day"){
        points = dailyPoints;
        outputGranularity = "day";
      } else {
        const grouped = new Map();
        dailyPoints.forEach(point => {
          const parts = parsePeriodDate(point.timestamp);
          const key = temporalBucketKey(parts, point.timestamp, resolution);
          const group = grouped.get(key) || { key, timestamp: point.timestamp, values: [] };
          if(point.timestamp < group.timestamp) group.timestamp = point.timestamp;
          if(point.value !== null) group.values.push(point.value);
          grouped.set(key, group);
        });
        points = Array.from(grouped.values()).map(group => ({
          key: group.key,
          timestamp: group.timestamp,
          value: aggregateNumericValues(group.values, definition.operation)
        }));
      }
    } else if(resolution === "hour"){
      points = parsedEntries.map(entry => ({
        key: entry.timestamp.slice(0, 13),
        timestamp: entry.timestamp,
        value: entry.value,
        preserveDuplicateTimestamp: true
      }));
    } else {
      const grouped = new Map();
      parsedEntries.forEach(entry => {
        const key = temporalBucketKey(entry.parts, entry.timestamp, resolution);
        const group = grouped.get(key) || { key, timestamp: entry.timestamp, values: [] };
        if(entry.timestamp < group.timestamp) group.timestamp = entry.timestamp;
        if(entry.value !== null) group.values.push(entry.value);
        grouped.set(key, group);
      });
      points = Array.from(grouped.values()).map(group => ({
        key: group.key,
        timestamp: group.timestamp,
        value: aggregateNumericValues(group.values, definition.operation)
      }));
    }

    const timeline = buildTemporalTimeline(entries, outputGranularity);
    const pointsByKey = new Map();
    points.forEach(point => {
      const values = pointsByKey.get(point.key) || [];
      values.push(point);
      pointsByKey.set(point.key, values);
    });
    const timelinePoints = timeline.flatMap(period => {
      const observed = pointsByKey.get(period.key);
      if(!observed?.length) return [{ ...period, value: null }];
      if(observed[0].preserveDuplicateTimestamp) return observed;
      return [{ ...period, timestamp: observed[0].timestamp, value: observed[0].value }];
    });
    const validPoints = timelinePoints.filter(point => point.value !== null && Number.isFinite(point.value));
    const maxPoint = validPoints.reduce((best, point) => !best || point.value > best.value ? point : best, null);
    const minPoint = validPoints.reduce((best, point) => !best || point.value < best.value ? point : best, null);

    return {
      ...definition,
      timestamps: timelinePoints.map(point => point.timestamp),
      values: timelinePoints.map(point => point.value),
      statistics: {
        count: validPoints.length,
        mean: aggregateNumericValues(validPoints.map(point => point.value), "mean"),
        min: minPoint?.value ?? null,
        minTimestamp: minPoint?.timestamp ?? null,
        max: maxPoint?.value ?? null,
        maxTimestamp: maxPoint?.timestamp ?? null
      },
      conflictingDailySummaries,
      precisionAdjustedValues,
      invalidValueCount
    };
  });
}

window.CajuCarbo = window.CajuCarbo || {};
Object.assign(window.CajuCarbo, {
  parsePeriodDate,
  normalizePeriodMonth,
  getPeriodParts,
  buildPeriodIndex,
  getAvailablePeriods,
  normalizePeriodSelection,
  filterDataByPeriod,
  calculatePeriodMetrics,
  groupDataForCharts,
  aggregateMeteorologySeries
});