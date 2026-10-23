/* =========================================================
   sample-loader.js
  Carrega o dataset ambiental selecionado (ERA5-Land).
   A importação de novas planilhas fica restrita a um futuro painel
   administrativo e não é exposta nesta interface pública.
   ========================================================= */

function detectCSVDelimiter(text){
  if(!text) return ",";
  const candidates = [",", ";", "\t", "|"];
  const lines = text.split(/\r?\n/).filter(line => line.trim() && !/^\s*#/.test(line));
  if(!lines.length) return ",";

  let bestDelimiter = ",";
  let bestScore = -1;

  for(const delim of candidates){
    const score = lines.slice(0, 10).reduce((total, line) => {
      const pieces = line.split(delim).length;
      return total + Math.max(0, pieces - 1);
    }, 0);

    if(score > bestScore){
      bestScore = score;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

function normalizeCSVFields(fields = []){
  return fields
    .map(field => String(field || "").trim().replace(/^\uFEFF/, ""))
    .filter((field, index, arr) => field.length > 0 || index !== arr.length - 1);
}

function normalizeImportedRow(row = {}){
  const normalized = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    if(key === undefined || key === null) return;
    const cleanedKey = String(key).trim();
    if(!cleanedKey) return;
    normalized[cleanedKey] = value === "" || value === undefined ? null : value;
  });
  return normalized;
}

function isLikelyMetadataRow(row = {}){
  const values = Object.values(row)
    .filter(value => value !== null && value !== undefined && String(value).trim() !== "")
    .map(value => String(value).trim());

  if(!values.length) return true;

  const hasDateLikeValue = values.some(value => /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.test(value));
  const hasNumericValue = values.some((value) => {
    const cleaned = String(value).replace(/%/g, "").replace(/\s+/g, "").replace(",", ".");
    return cleaned !== "" && !Number.isNaN(Number(cleaned));
  });

  if(hasDateLikeValue || hasNumericValue) return false;

  return true;
}

function sanitizeImportedRows(rows = []){
  return (rows || [])
    .map(normalizeImportedRow)
    .filter(row => !isLikelyMetadataRow(row));
}

function deduplicateRows(rows = [], matched = {}){
  const headers = Object.keys(matched);
  const findHeader = (key, preferred = []) => {
    for(const candidate of preferred){
      if(matched[candidate] === key) return candidate;
    }
    return headers.find(header => matched[header] === key) || null;
  };
  const timestampHeader = findHeader("timestamp", ["valid_time", "timestamp_original", "timestamp", "datetime", "data_hora", "date", "data"]);
  const latitudeHeader = findHeader("latitude", ["latitude", "lat"]);
  const longitudeHeader = findHeader("longitude", ["longitude", "lon", "lng"]);
  const stationHeaders = headers.filter(header => ["station_id", "station_name"].includes(matched[header]));
  const recordIdHeaders = headers.filter(header => matched[header] === "record_id");
  const metadataFields = new Set([
    "timestamp", "period_year", "period_month", "period_week", "latitude", "longitude",
    "station_id", "station_name", "record_id"
  ]);
  const exactRows = new Set();
  const uniqueRows = [];
  const identityGroups = new Map();
  let duplicateCount = 0;

  const normalizeCoordinate = value => {
    if(value === null || value === undefined || String(value).trim() === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : String(value).trim();
  };

  (rows || []).forEach((row, index) => {
    const fingerprint = JSON.stringify(Object.keys(row).sort().map(header => [header, row[header] ?? null]));
    if(exactRows.has(fingerprint)){
      duplicateCount++;
      return;
    }
    exactRows.add(fingerprint);

    let normalized = null;
    if(timestampHeader){
      normalized = window.CajuCarbo.normalizeData([row], matched)[0] || null;
    }
    const timestamp = normalized?.timestamp
      || (timestampHeader && (window.CajuCarbo.parseTimestampToISO?.(row[timestampHeader]) || String(row[timestampHeader] ?? "").trim()));
    const latitude = latitudeHeader ? normalizeCoordinate(row[latitudeHeader]) : null;
    const longitude = longitudeHeader ? normalizeCoordinate(row[longitudeHeader]) : null;
    const station = stationHeaders.map(header => [matched[header], String(row[header] ?? "").trim()]).filter(([, value]) => value);
    const recordIds = recordIdHeaders.map(header => String(row[header] ?? "").trim()).filter(Boolean);
    const hasStableIdentity = (latitude !== null && longitude !== null) || station.length > 0 || recordIds.length > 0;
    const measurements = {};
    if(normalized){
      Array.from(new Set(headers.map(header => matched[header]).filter(key => key && !metadataFields.has(key))))
        .sort()
        .forEach(key => {
          const value = normalized[key];
          if(typeof value === "number" && Number.isFinite(value)) measurements[key] = value;
        });
    }

    if(timestamp && hasStableIdentity){
      const identity = [timestamp, latitude, longitude, station, recordIds];
      const groupKey = JSON.stringify(identity);
      const group = identityGroups.get(groupKey) || { rows: [], observations: [] };
      group.observations.push({ measurements, sourceRow: index + 2 });

      const matchingRow = group.rows.find(existing => {
        const sharedFields = Object.keys(measurements).filter(field => existing.measurements[field] !== undefined);
        return sharedFields.some(field => existing.measurements[field] === measurements[field])
          && sharedFields.every(field => existing.measurements[field] === measurements[field]);
      });
      if(matchingRow){
        Object.assign(matchingRow.row, row);
        Object.assign(matchingRow.measurements, measurements);
        duplicateCount++;
      } else {
        const uniqueRow = { row, measurements };
        group.rows.push(uniqueRow);
        uniqueRows.push(row);
      }
      identityGroups.set(groupKey, group);
      return;
    }
    uniqueRows.push(row);
  });

  const conflicts = [];
  identityGroups.forEach((group, key) => {
    if(group.observations.length < 2) return;
    const fields = new Set(group.observations.flatMap(({measurements}) => Object.keys(measurements)));
    const differingFields = Array.from(fields).filter(field => {
      const values = new Set(group.observations
        .map(({measurements}) => measurements[field])
        .filter(value => value !== undefined));
      return values.size > 1;
    });
    if(differingFields.length){
      conflicts.push({
        key,
        sourceRows: group.observations.map(item => item.sourceRow),
        differingHeaders: headers.filter(header => differingFields.includes(matched[header]))
      });
    }
  });
  return { rows: uniqueRows, duplicateCount, conflicts };
}

function loadSampleCSV(datasetOrPath){
  const dataset = typeof datasetOrPath === "string"
    ? { path: datasetOrPath, fallbackPaths: [] }
    : (datasetOrPath || {});

  const candidates = [dataset.path, ...(dataset.fallbackPaths || [])]
    .filter(Boolean)
    .map(path => String(path).trim())
    .filter((path, index, all) => path && all.indexOf(path) === index);

  const attempt = (index) => {
    const currentPath = candidates[index];
    if(!currentPath){
      throw new Error(`Não foi possível localizar nenhum arquivo de dados para a localidade selecionada.`);
    }

    return fetch(currentPath, { cache: "default" })
      .then((response) => {
        if(!response.ok) {
          if(index < candidates.length - 1) return attempt(index + 1);
          throw new Error(`Não foi possível carregar ${currentPath}: ${response.status}`);
        }
        return response.text().then((text) => ({ text, path: currentPath }));
      })
      .catch((error) => {
        if(index < candidates.length - 1) return attempt(index + 1);
        throw error;
      });
  };

  return attempt(0)
    .then(({ text, path }) => {
      const delimiter = detectCSVDelimiter(text);
      const result = Papa.parse(text, {
        delimiter,
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => String(header || "").trim().replace(/^\uFEFF/, "")
      });

      if(result.errors && result.errors.length){
        const err = result.errors[0];
        throw new Error(`CSV inválido: ${err.message}`);
      }

      const headers = normalizeCSVFields(result.meta.fields || []);
      const rows = sanitizeImportedRows((result.data || []).map(row => {
        const normalized = {};
        Object.entries(row || {}).forEach(([key, value]) => {
          if(key === undefined || key === null) return;
          normalized[String(key).trim()] = value;
        });
        return normalized;
      }));

      return { headers, rows, fileName: path.split("/").pop() };
    });
}

async function parseUploadedDataset(file){
  const extension = String(file?.name || "").split(".").pop().toLowerCase();
  if(extension === "xlsx" || extension === "xls"){
    if(!window.XLSX) throw new Error("A biblioteca de leitura Excel não foi carregada. Tente novamente com um arquivo CSV.");
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    if(!workbook || !Array.isArray(workbook.SheetNames) || !workbook.SheetNames.length) throw new Error("A planilha não contém abas.");

    const mergedRows = []; 
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      if(!sheet) return;
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true, blankrows: false });
      if(!rows.length) return;
      mergedRows.push(...sanitizeImportedRows(rows));
    });

    const headers = mergedRows.length
      ? Array.from(new Set(mergedRows.flatMap(row => Object.keys(row))))
      : [];

    if(!headers.length) throw new Error("A planilha está vazia ou sem linhas válidas para importar.");
    return { headers, rows: mergedRows, fileName: file.name };
  }

  if(extension !== "csv") throw new Error("Formato não suportado. Selecione um arquivo .csv, .xlsx ou .xls.");
  const text = await file.text();
  const delimiter = detectCSVDelimiter(text);
  const result = Papa.parse(text, {
    delimiter,
    header: true,
    skipEmptyLines: true,
    transformHeader: header => String(header || "").trim().replace(/^\uFEFF/, "")
  });
  if(result.errors?.length){
    const error = result.errors[0];
    throw new Error(`CSV inválido: ${error.message}`);
  }
  const headers = normalizeCSVFields(result.meta.fields || []);
  const rows = sanitizeImportedRows((result.data || []).map(row => Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [String(key).trim(), value === "" ? null : value])
  )));
  if(!headers.length || !rows.length) throw new Error("O arquivo não contém cabeçalho e registros para importar.");
  return { headers, rows, fileName: file.name };
}

window.CajuCarbo = window.CajuCarbo || {};
window.CajuCarbo.loadSampleCSV = loadSampleCSV;
window.CajuCarbo.parseUploadedDataset = parseUploadedDataset;
window.CajuCarbo.deduplicateRows = deduplicateRows;
