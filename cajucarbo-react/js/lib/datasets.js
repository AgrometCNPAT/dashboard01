/* =========================================================
   datasets.js
   Registro dos conjuntos de dados publicados para a plataforma.
   No modelo final, este registro será alimentado pelo painel
   administrativo (cada planilha publicada vira uma entrada aqui,
  com um arquivo correspondente em ../sample-data/). Por ora,
   ele é mantido manualmente e serve de "banco" para o alternador
   de fonte de dados no topo do site.

   IMPORTANTE: cada entrada com status "available" precisa apontar
   para um arquivo real de dados. Nenhuma entrada aqui representa
   dados inventados — datasets ainda não publicados aparecem como
   "coming-soon" e não podem ser selecionados.
   ========================================================= */

const CC_DATASETS = [
  {
    id: "petrolina",
    label: "Petrolina — PE",
    subtitle: "ERA5-Land · Torre de campo",
    path: "../sample-data/era5_land_Petrolina_completo.csv",
    status: "available",
  },
  {
    id: "pacajus",
    label: "Pacajus — CE",
    subtitle: "ERA5-Land · Torre de campo",
    path: "../sample-data/era5_land_Pacajus_diario.csv",
    fallbackPaths: [
      "../processed-data/era5_land_pacajus_extraido.csv",
      "../sample-data/era5_land_Pacajus_completo.csv",
    ],
    status: "available",
  },
];

window.CajuCarbo = window.CajuCarbo || {};
window.CajuCarbo.CC_DATASETS = CC_DATASETS;
