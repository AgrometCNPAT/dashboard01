const test = require("node:test");
const assert = require("node:assert/strict");

global.window = { CajuCarbo: {} };
require("./statistics.js");
require("./period-filter.js");
require("./data-normalizer.js");
require("./sample-loader.js");

const CC = window.CajuCarbo;

function dated(timestamp, values = {}){
  return { timestamp, timestampRaw: timestamp, ...values };
}

test("interpreta ISO, DD/MM/AAAA, mês escrito e rejeita datas impossíveis", () => {
  assert.equal(CC.parsePeriodDate("2024-02-29").dateKey, "2024-02-29");
  assert.equal(CC.parseTimestampToISO("2024-03-01T01:02:03Z"), "2024-03-01T01:02:03Z");
  assert.equal(CC.parsePeriodDate("29/02/2024 23:30").month, 2);
  assert.equal(CC.parsePeriodDate("31/02/2024"), null);
  assert.equal(CC.normalizePeriodMonth("Março"), 3);
  assert.equal(CC.normalizePeriodMonth("11"), 11);
});

test("Geral mantém todas as linhas e filtros anuais e mensais usam datas reais", () => {
  const rows = [
    dated("2020-12-31T23:00:00"), dated("2021-01-01T00:00:00"),
    dated("2021-01-04T00:00:00"), dated("2021-02-02T00:00:00")
  ];
  const index = CC.buildPeriodIndex(rows);
  const periods = CC.getAvailablePeriods(index);

  assert.equal(CC.filterDataByPeriod(index, { mode: "all" }).rows.length, 4);
  assert.deepEqual(CC.filterDataByPeriod(index, { mode: "year", year: 2021 }).rows, rows.slice(1));
  assert.deepEqual(CC.filterDataByPeriod(index, { mode: "month", year: 2021, month: 1 }).rows, rows.slice(1, 3));
  assert.deepEqual(periods.monthsByYear["2021"].map(item => item.value), [1, 2]);
});

test("remove linhas idênticas e mantém conflitos na mesma observação", () => {
  const matched = CC.detectVariables(["valid_time", "latitude", "longitude", "t2m_c"]).matched;
  const row = { valid_time: "2026-01-01 00:00:00", latitude: "-9", longitude: "-40.2", t2m_c: "31.2" };
  const result = CC.deduplicateRows([
    row,
    { ...row },
    { ...row, t2m_c: "30.8" },
    { ...row, latitude: "-8.9" }
  ], matched);

  assert.equal(result.duplicateCount, 1);
  assert.equal(result.rows.length, 3);
  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(result.conflicts[0].differingHeaders, ["t2m_c"]);
});

test("deduplica a mesma observação sem depender de colunas auxiliares ou formato da data", () => {
  const matched = CC.detectVariables([
    "valid_time", "latitude", "longitude", "station_id", "record_id", "t2m_c", "comment"
  ]).matched;
  const result = CC.deduplicateRows([
    {
      valid_time: "2024-01-01T00:00:00",
      latitude: "-9",
      longitude: "-40.2",
      station_id: "T1",
      record_id: "R1",
      t2m_c: "22.5",
      comment: "original"
    },
    {
      valid_time: "01/01/2024 00:00",
      latitude: "-9.0",
      longitude: "-40.200",
      station_id: "T1",
      record_id: "R1",
      t2m_c: "22.5",
      comment: "copied from another sheet"
    }
  ], matched);

  assert.equal(result.duplicateCount, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.conflicts.length, 0);
  assert.equal(CC.normalizeData(result.rows, matched)[0].station_id, "T1");
});

test("mescla campos complementares de uma observação repetida sem perder medições", () => {
  const matched = CC.detectVariables([
    "valid_time", "latitude", "longitude", "station_id", "record_id", "t2m_c", "rh", "ssrd_wm2"
  ]).matched;
  const identity = {
    valid_time: "2024-01-01T00:00:00",
    latitude: "-9",
    longitude: "-40.2",
    station_id: "T1",
    record_id: "R1",
    t2m_c: "22.5"
  };
  const result = CC.deduplicateRows([
    { ...identity, rh: "65" },
    { ...identity, ssrd_wm2: "180" }
  ], matched);

  assert.equal(result.duplicateCount, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.conflicts.length, 0);
  const [normalized] = CC.normalizeData(result.rows, matched);
  assert.equal(normalized.rh, 65);
  assert.equal(normalized.ssrd_wm2, 180);
});

test("não faz deduplicação sem identidade suficiente para distinguir estações", () => {
  const matched = CC.detectVariables(["valid_time", "t2m_c", "source_note"]).matched;
  const result = CC.deduplicateRows([
    { valid_time: "2024-01-01T00:00:00", t2m_c: "22.5", source_note: "A" },
    { valid_time: "2024-01-01T00:00:00", t2m_c: "22.5", source_note: "B" }
  ], matched);

  assert.equal(result.duplicateCount, 0);
  assert.equal(result.rows.length, 2);
});

test("preserva medições conflitantes e observações de estações distintas", () => {
  const matched = CC.detectVariables([
    "valid_time", "latitude", "longitude", "station_id", "record_id", "t2m_c"
  ]).matched;
  const base = {
    valid_time: "2024-01-01T00:00:00",
    latitude: "-9",
    longitude: "-40.2",
    station_id: "T1",
    record_id: "R1",
    t2m_c: "22.5"
  };
  const result = CC.deduplicateRows([
    base,
    { ...base, t2m_c: "23" },
    { ...base, station_id: "T2", record_id: "R2" }
  ], matched);

  assert.equal(result.duplicateCount, 0);
  assert.equal(result.rows.length, 3);
  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(result.conflicts[0].differingHeaders, ["t2m_c"]);
});

test("usa o timestamp original completo e reconhece campos dos extratos processados", () => {
  const headers = [
    "date", "time", "timestamp_original", "locality", "temperature_max_c",
    "temperature_min_c", "temperature_mean_c", "dew_point_c",
    "relative_humidity_max", "relative_humidity_mean", "relative_humidity_min",
    "solar_radiation_total", "precipitation", "wind_speed_mean",
    "atmospheric_pressure_mean", "soil_moisture_layer_1"
  ];
  const detected = CC.detectVariables(headers);
  const [normalized] = CC.normalizeData([{
    date: "2026-02-03",
    time: "06:00",
    timestamp_original: "03/02/2026 06:00",
    locality: "Petrolina",
    temperature_max_c: "34",
    temperature_min_c: "20",
    temperature_mean_c: "27",
    dew_point_c: "18",
    relative_humidity_max: "90",
    relative_humidity_mean: "55",
    relative_humidity_min: "35",
    solar_radiation_total: "21.5",
    precipitation: "2.4",
    wind_speed_mean: "4.5",
    atmospheric_pressure_mean: "954.2",
    soil_moisture_layer_1: "0.12"
  }], detected.matched);

  assert.equal(normalized.timestamp, "2026-02-03T06:00:00");
  assert.equal(normalized.station_name, "Petrolina");
  assert.equal(normalized.t2m_c_max, 34);
  assert.equal(normalized.t2m_c_min, 20);
  assert.equal(normalized.t2m_c_mean, 27);
  assert.equal(normalized.d2m_c, 18);
  assert.equal(normalized.rh_max, 90);
  assert.equal(normalized.rh_mean, 55);
  assert.equal(normalized.rh_min, 35);
  assert.equal(normalized.ssrd_mjm2_dia, 21.5);
  assert.equal(normalized.tp_mm_dia, 2.4);
  assert.equal(normalized.wind_speed_mean, 4.5);
  assert.equal(normalized.sp_hpa_mean, 954.2);
  assert.equal(normalized.swvl1, 0.12);
});

test("semana ISO combina ano e número corretamente na virada do ano", () => {
  const rows = [dated("2020-12-31"), dated("2021-01-01"), dated("2021-01-04")];
  const index = CC.buildPeriodIndex(rows);
  const result = CC.filterDataByPeriod(index, { mode: "week", year: 2020, week: 53 });

  assert.deepEqual(result.rows, rows.slice(0, 2));
  assert.deepEqual(CC.getAvailablePeriods(index).weeksByYear["2020"].map(item => item.value), [53]);
});

test("trocar ano corrige mês inválido para um mês disponível", () => {
  const index = CC.buildPeriodIndex([dated("2020-12-01"), dated("2021-03-01")]);
  const periods = CC.getAvailablePeriods(index);
  const selection = CC.normalizePeriodSelection(periods, { mode: "month", year: 2020, month: 3 });

  assert.equal(selection.year, 2020);
  assert.equal(selection.month, 12);
});

test("intervalo sem registros retorna vazio e respeita limites inclusivos", () => {
  const index = CC.buildPeriodIndex([dated("2024-03-01"), dated("2024-03-31"), dated("2024-04-01")]);
  assert.equal(CC.filterDataByPeriod(index, { mode: "range", startDate: "2024-05-01", endDate: "2024-05-31" }).rows.length, 0);
  assert.equal(CC.filterDataByPeriod(index, { mode: "range", startDate: "2024-03-01", endDate: "2024-03-31" }).rows.length, 2);
  assert.equal(CC.filterDataByPeriod(index, { mode: "range", startDate: "2024-04-01", endDate: "2024-03-01" }).rows.length, 0);
});

test("datas inválidas e colunas separadas são visíveis sem descartar medições", () => {
  const detected = CC.detectVariables(["Ano", "Mês", "Semana", "Temperatura"]);
  const rows = CC.normalizeData([
    { Ano: "2024", Mês: "Março", Semana: "W09", Temperatura: "22.5" },
    { Ano: "2024", Mês: "13", Semana: "0", Temperatura: "Infinity" }
  ], detected.matched);
  const index = CC.buildPeriodIndex(rows);
  const selection = CC.filterDataByPeriod(index, { mode: "month", year: 2024, month: 3 });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].period_month, 3);
  assert.equal(rows[0].period_week, 9);
  assert.deepEqual(selection.rows, rows);
  assert.equal(CC.getAvailablePeriods(index).undatedCount, 1);

  const crossoverRows = CC.normalizeData([
    { Ano: "2021", Mês: "Janeiro", Semana: "53", Temperatura: "18" }
  ], detected.matched);
  const crossoverIndex = CC.buildPeriodIndex(crossoverRows);
  assert.equal(CC.filterDataByPeriod(crossoverIndex, { mode: "week", year: 2020, week: 53 }).rows.length, 1);
});

test("reindexar dados importados atualiza opções e preserva duplicatas", () => {
  const original = [dated("2024-01-01"), dated("2024-01-01")];
  const updated = [...original, dated("2025-06-01")];
  assert.deepEqual(CC.getAvailablePeriods(CC.buildPeriodIndex(original)).years, [2024]);
  assert.deepEqual(CC.getAvailablePeriods(CC.buildPeriodIndex(updated)).years, [2024, 2025]);
  assert.equal(CC.filterDataByPeriod(CC.buildPeriodIndex(original), { mode: "all" }).rows.length, 2);
});

test("médias ignoram ausentes, totais somam chuva sem duplicar valor diário", () => {
  const rows = [
    dated("2024-01-01T00:00:00", { temperature: 10, tp_mm: 1, tp_mm_dia: 4 }),
    dated("2024-01-01T01:00:00", { temperature: 20, tp_mm: 2, tp_mm_dia: 4 }),
    dated("2024-01-02T00:00:00", { temperature: null, tp_mm: 3, tp_mm_dia: 6 })
  ];
  const metrics = CC.calculatePeriodMetrics(rows, ["temperature", "tp_mm", "tp_mm_dia"]);

  assert.equal(metrics.observationCount, 3);
  assert.equal(metrics.statistics.temperature.mean, 15);
  assert.equal(metrics.statistics.temperature.count, 2);
  assert.equal(metrics.statistics.temperature.missing, 1);
  assert.equal(metrics.totals.tp_mm, 6);
  assert.equal(metrics.totals.tp_mm_dia, 10);
});

test("séries temporais agrupam por mês, semana e dia sem médias de médias", () => {
  const monthly = CC.groupDataForCharts(
    ["2024-01-01", "2024-01-02", "2024-02-01"],
    [{ name: "T", values: [10, 20, 40] }]
  );
  assert.equal(monthly.groupBy, "month");
  assert.deepEqual(monthly.series[0].values, [15, 40]);

  const weekly = CC.groupDataForCharts(
    ["2024-03-01", "2024-03-04", "2024-03-11"],
    [{ name: "T", values: [10, 20, 40] }]
  );
  assert.equal(weekly.groupBy, "week");
  assert.deepEqual(weekly.series[0].values, [10, 20, 40]);

  const daily = CC.groupDataForCharts(
    ["2024-03-01T00:00:00", "2024-03-01T01:00:00"],
    [{ name: "T", values: [10, null] }]
  );
  assert.equal(daily.groupBy, "day");
  assert.deepEqual(daily.series[0].values, [10]);

  const dailyAcrossMonths = CC.groupDataForCharts(
    ["2024-01-01T00:00:00", "2024-01-01T01:00:00", "2024-02-01T00:00:00"],
    [{ name: "T", values: [10, 20, 40] }],
    "day"
  );
  assert.equal(dailyAcrossMonths.groupBy, "day");
  assert.deepEqual(dailyAcrossMonths.series[0].values, [15, 40]);

  const rainfall = CC.groupDataForCharts(
    ["2024-01-01", "2024-01-02", "2024-02-01"],
    [{ name: "Chuva", aggregate: "sum", values: [1, 2, 4] }]
  );
  assert.deepEqual(rainfall.series[0].values, [3, 4]);
});

test("agrega séries diárias repetidas uma vez por dia e respeita semântica semanal", () => {
  const rows = [
    dated("2024-03-04T00:00:00", { daily_max: 30, daily_mean: 25, solar: 10, dew: 10 }),
    dated("2024-03-04T01:00:00", { daily_max: 30, daily_mean: 25, solar: 10, dew: 12 }),
    dated("2024-03-06T00:00:00", { daily_max: 32, daily_mean: 27, solar: 12, dew: 14 })
  ];
  const definitions = [
    { field: "daily_max", operation: "max", dailySummary: true },
    { field: "daily_mean", operation: "mean", dailySummary: true },
    { field: "solar", operation: "sum", dailySummary: true },
    { field: "dew", operation: "mean", dailySummary: false }
  ];
  const daily = CC.aggregateMeteorologySeries(rows, definitions, "day");
  assert.deepEqual(daily[0].values, [30, null, 32]);
  assert.deepEqual(daily[1].values, [25, null, 27]);
  assert.deepEqual(daily[2].values, [10, null, 12]);
  assert.deepEqual(daily[3].values, [11, null, 14]);
  assert.equal(daily[0].statistics.maxTimestamp, "2024-03-06T00:00:00");

  const weekly = CC.aggregateMeteorologySeries(rows, definitions, "week");
  assert.deepEqual(weekly[0].values, [32]);
  assert.deepEqual(weekly[2].values, [22]);
  assert.deepEqual(weekly[3].values, [12]);
});

test("resolução horária preserva registros e mantém resumos diários em pontos diários", () => {
  const rows = [
    dated("2024-03-04T00:00:00", { daily_mean: 25, dew: 10 }),
    dated("2024-03-04T01:00:00", { daily_mean: 25, dew: 12 }),
    dated("2024-03-05T00:00:00", { daily_mean: 26, dew: 11 })
  ];
  const result = CC.aggregateMeteorologySeries(rows, [
    { field: "daily_mean", operation: "mean", dailySummary: true },
    { field: "dew", operation: "mean", dailySummary: false }
  ], "hour");

  assert.deepEqual(result[0].values, [25, 26]);
  assert.deepEqual(result[0].timestamps, ["2024-03-04T00:00:00", "2024-03-05T00:00:00"]);
  assert.equal(result[1].values.length, 25);
  assert.deepEqual(result[1].values.slice(0, 3), [10, 12, null]);
});

test("corrige ruído negativo pequeno de chuva e exclui valor negativo fora da tolerância", () => {
  const rows = [
    dated("2024-03-01T00:00:00", { rain: -0.00001 }),
    dated("2024-03-02T00:00:00", { rain: -0.01 }),
    dated("2024-03-03T00:00:00", { rain: 2 })
  ];
  const [rain] = CC.aggregateMeteorologySeries(rows, [
    { field: "rain", operation: "sum", dailySummary: true, nonNegative: true, precisionTolerance: 0.0001 }
  ], "day");

  assert.deepEqual(rain.values, [0, null, 2]);
  assert.equal(rain.precisionAdjustedValues, 1);
  assert.equal(rain.invalidValueCount, 1);
  assert.equal(rain.statistics.min, 0);
});

test("agrega totais diários por mês e ano sem preencher períodos ausentes", () => {
  const rows = [
    dated("2024-01-31T00:00:00", { solar: 1, dew: 10 }),
    dated("2024-02-01T00:00:00", { solar: 2, dew: 20 }),
    dated("2025-01-01T00:00:00", { solar: 4, dew: 40 })
  ];
  const definitions = [
    { field: "solar", operation: "sum", dailySummary: true },
    { field: "dew", operation: "mean", dailySummary: false }
  ];
  const monthly = CC.aggregateMeteorologySeries(rows, definitions, "month");
  assert.equal(monthly[0].values.length, 13);
  assert.deepEqual(monthly[0].values.slice(0, 3), [1, 2, null]);
  assert.equal(monthly[0].values[12], 4);

  const yearly = CC.aggregateMeteorologySeries(rows, definitions, "year");
  assert.deepEqual(yearly[0].values, [3, 4]);
  assert.deepEqual(yearly[1].values, [15, 40]);
});

test("importa planilhas Excel com múltiplas abas e ignora linhas de metadados", async () => {
  const sheet1 = [
    { Data: "01/01/2024", Temperatura: 20 },
    { Data: "02/01/2024", Temperatura: 22 },
    { Data: "Metadata", Temperatura: "linha de texto" }
  ];
  const sheet2 = [
    { Data: "03/01/2024", Temperatura: 24 },
    { Data: "04/01/2024", Temperatura: 26 },
    { Data: "Resumo", Temperatura: null }
  ];

  const originalXlsx = global.window.XLSX;
  global.window.XLSX = {
    read: () => ({
      SheetNames: ["Primeira guia", "Segunda guia"],
      Sheets: {
        "Primeira guia": { A1: { v: "Data" }, B1: { v: "Temperatura" }, A2: { v: "01/01/2024" }, B2: { v: 20 }, A3: { v: "02/01/2024" }, B3: { v: 22 }, A4: { v: "Metadata" }, B4: { v: "linha de texto" } },
        "Segunda guia": { A1: { v: "Data" }, B1: { v: "Temperatura" }, A2: { v: "03/01/2024" }, B2: { v: 24 }, A3: { v: "04/01/2024" }, B3: { v: 26 }, A4: { v: "Resumo" }, B4: { v: null } }
      }
    }),
    utils: {
      sheet_to_json: (sheet, options) => {
        const values = [];
        const rows = Object.entries(sheet).filter(([key]) => /^[A-Z]+\d+$/.test(key));
        const maxRow = Math.max(...rows.map(([key]) => parseInt(key.replace(/^[A-Z]+/, ''), 10)));
        const maxCol = Math.max(...rows.map(([key]) => key.replace(/\d+$/, '').split('').reduce((sum, ch) => sum * 26 + (ch.charCodeAt(0)-64), 0)));
        for (let rowNum = 2; rowNum <= maxRow; rowNum++) {
          const row = {};
          for (let colNum = 1; colNum <= maxCol; colNum++) {
            const key = String.fromCharCode(64 + colNum) + rowNum;
            if (sheet[key] !== undefined) row[String.fromCharCode(64 + colNum)] = sheet[key].v;
          }
          if (row['A'] && String(row['A']).trim() !== 'Data') values.push({ Data: row['A'], Temperatura: row['B'] });
        }
        return values;
      }
    }
  };

  const file = { name: "dados.xlsx", arrayBuffer: async () => new ArrayBuffer(8) };
  const parsed = await CC.parseUploadedDataset(file);

  assert.equal(parsed.headers.length, 2);
  assert.equal(parsed.rows.length, 4);
  assert.deepEqual(parsed.rows.map(r => r.Data), ["01/01/2024", "02/01/2024", "03/01/2024", "04/01/2024"]);

  global.window.XLSX = originalXlsx;
});