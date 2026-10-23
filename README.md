# CajuCarbo — Data Intelligence Platform (React)

Plataforma científica de visualização de dados ambientais do projeto CajuCarbo (Embrapa), em **React 18** (via CDN, sem etapa de build), com **Three.js** para a abertura 3D e **Plotly.js** para os gráficos.

## Como executar

Este site faz requisições (`fetch`) para carregar o CSV de exemplo e usa `iframe` para os painéis de produção nacional. Por segurança, os navegadores bloqueiam esse tipo de leitura quando o arquivo é aberto diretamente do disco (`file://`). Por isso, sirva a pasta por um servidor local simples:

```bash
# opção 1 — Node
npx serve .

# opção 2 — Python
python -m http.server 8080
```

Depois acesse `http://localhost:8080` (ou a porta indicada) no navegador.

## O que muda em relação à versão anterior

- **Alternador de fonte de dados** no topo do site: troca qual planilha alimenta o dashboard entre as torres de **Petrolina** e **Pacajus**. As médias, amostras visuais, estatísticas e gráficos são recalculados para a fonte selecionada. Detalhes em `ALTERNADOR_DE_DADOS.md`.
- **Filtro temporal centralizado**: Geral, ano, mês, semana ISO 8601 e intervalo de datas, com opções limitadas aos períodos presentes na fonte. Estatísticas, cartões, tabelas e gráficos são recalculados a partir dos registros selecionados.
- **Importação local de CSV e Excel**: arquivos `.csv`, `.xlsx` e `.xls` podem ser carregados pela barra de período; as abas com dados são consolidadas, sem alterar os arquivos originais. Duplicatas lógicas idênticas são removidas e medições conflitantes são mantidas. O arquivo importado fica apenas na memória da sessão e não é enviado a um servidor.
- **Logo da CajuCarbo** aplicada na navegação lateral, na tela de abertura e como favicon (`../brand/cajucarbo-logo.png`).
- **Responsivo e cross-device**: menu lateral virou um drawer com fundo escurecido no mobile, barra superior reorganizada para telas pequenas, e os canvases 3D recalculam tamanho ao redimensionar.
- **Pronto para hospedar no GitHub Pages**: um workflow de GitHub Pages já configurado — veja `DEPLOY.md`.
- **Seção Meteorologia consolidada**: condições atmosféricas, precipitação, umidade e temperatura do solo, radiação e indicadores derivados são organizados em gráficos diários; os filtros temporais são aplicados antes dos cálculos e da agregação.
- **Fenologia integrada**: seção React com os cenários, estatísticas, filtros de data, gráficos e dados originais de `../fenologia.html`, incorporados ao bundle pelo build; a interface usa estilos isolados adaptados à paleta clara do CajuCarbo.
- **Navegação**: Visão Geral, Meteorologia, Comparativos, Análise Estatística, Fenologia e Produção Nacional. A localidade selecionada e os identificadores de estação/torre presentes na fonte permanecem visíveis.
- **Reescrito em React**, com componentes por seção (`js/react/*.jsx`) e um estado único de dados (`normalized`, `statistics` e `metadata`) que alimenta os gráficos.
- **Abertura em 3D**: rede de partículas conectadas com movimento suave e reconstrução periódica das ligações.

## Estrutura

```
index.html              → build final (JSX já embutido, ver observação abaixo)
index.template.html     → template usado para gerar o index.html
css/                     → estilos (tokens institucionais Embrapa, dashboard, animações, responsivo)
js/lib/                  → lógica pura (sem JSX): normalização, filtros e métricas temporais, gráficos,
                           partículas 3D e importação CSV/Excel
js/react/                → componentes React "fonte" (App.jsx, sections.jsx, fenologia.jsx, common.jsx)
../brand/                → logo da CajuCarbo
../sample-data/          → CSV ambiental de demonstração (ERA5 — Petrolina)
../*.html                → painéis Plotly pré-renderizados de produção nacional de castanha de caju
```

O filtro temporal é aplicado aos dados ambientais carregados no React. Os painéis nacionais de produção são páginas HTML estáticas independentes e não são afetados pelo filtro. Linhas com medições, mas sem data completa, permanecem em **Geral** e são contabilizadas no aviso de qualidade; recortes por data não as incluem.

> **Nota sobre o JSX:** os componentes React "de verdade" vivem em `js/react/*.jsx`. Como o Babel standalone
> não consegue buscar arquivos `.jsx` externos quando o site é aberto via `file://`, o `index.html` final
> contém uma cópia desse mesmo código embutida diretamente em tags `<script type="text/babel">`. Ao editar
> a lógica, altere os arquivos em `js/react/` e execute `node build.js` para regenerar o `index.html`.
