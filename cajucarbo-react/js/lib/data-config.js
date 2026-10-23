/* =========================================================
   data-config.js
   Rótulos legíveis das variáveis normalizadas.
   ========================================================= */

const NUMERIC_FIELD_LABELS = {
  t2m_c: "Temperatura do ar (°C)", t2m_c_mean: "Temperatura média diária (°C)",
  t2m_c_min: "Temperatura mínima diária (°C)", t2m_c_max: "Temperatura máxima diária (°C)",
  d2m_c: "Ponto de orvalho (°C)", skt_c: "Temp. da superfície do solo (°C)",
  rh: "Umidade relativa do ar (%)", rh_mean: "Umidade média diária (%)", rh_min: "Umidade mínima diária (%)", rh_max: "Umidade máxima diária (%)",
  swvl1: "Umidade do solo — 0 a 7 cm (Superficial)",
  swvl2: "Umidade do solo — 7 a 28 cm (Subsuperficial)",
  swvl3: "Umidade do solo — 28 a 100 cm (Zona Radicular)",
  swvl4: "Umidade do solo — 100 a 289 cm (Horizonte Profundo)",
  swvl1_mean: "Umidade superficial média (0-7cm)",
  sp_hpa: "Pressão atmosférica (hPa)", sp_hpa_mean: "Pressão média diária (hPa)",
  wind_speed: "Velocidade do vento (m/s)", wind_speed_mean: "Vento médio diário (m/s)", u10: "Vento — Componente U (m/s)", v10: "Vento — Componente V (m/s)",
  tp_mm: "Precipitação horária (mm)", tp_mm_dia: "Precipitação diária acumulada (mm)",
  ssrd_wm2: "Radiação solar global (W/m²)", ssrd_mjm2_dia: "Radiação solar diária (MJ/m²)", strd_wm2: "Radiação térmica atmosférica (W/m²)",
  vpd: "Déficit de pressão de vapor — VPD (kPa)", amplitude_termica: "Amplitude térmica diária (°C)"
};

window.CajuCarbo = window.CajuCarbo || {};
Object.assign(window.CajuCarbo, { NUMERIC_FIELD_LABELS });
