# Alternador de fonte de dados

No topo do site existe um seletor **"Fonte de dados"** que troca qual planilha alimenta todo o dashboard. Hoje ele lê a lista de `js/lib/datasets.js`:

```js
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
    path: "../sample-data/era5_land_Pacajus_completo.csv",
    status: "available",
  },
];
```

- **`status: "available"`** → aparece habilitado no seletor e pode ser escolhido.
- **`status: "coming-soon"`** → aparece no seletor, mas desabilitado ("em breve"), até que exista um CSV real.

## Importar arquivo para análise

A barra de período permite importar `.csv`, `.xlsx` ou `.xls` para a sessão atual. Em arquivos Excel, somente a primeira aba é lida. O conteúdo é normalizado com o mesmo mapeamento de variáveis e os filtros são reconstruídos para os períodos encontrados. A importação é local no navegador; atualizar ou fechar a página remove essa fonte temporária.

## Como publicar uma nova torre/localização

1. Coloque o CSV real da nova torre em `../sample-data/` (mesmas colunas que o pipeline já reconhece — veja `js/lib/data-normalizer.js`/`variableMapping` para os nomes aceitos).
2. Em `js/lib/datasets.js`, mude o `status` da entrada correspondente para `"available"` e aponte `path` para o arquivo.
3. Regenere o `index.html` a partir do `index.template.html` (o JSX é embutido nele — veja o README) ou, se estiver rodando um build futuro, apenas publique normalmente.

## Próximo passo natural: painel administrativo

As fontes publicadas neste registro continuam sendo editadas manualmente. Um futuro painel administrativo poderá:
- faça upload da planilha,
- rode a mesma detecção de variáveis que já existe (`detectVariables`) para conferir a estrutura antes de publicar,
- e publique a entrada em `datasets.js` (ou em um banco de dados / API, numa versão com backend) automaticamente — sem exigir editar código à mão.

Esse processo é diferente da importação local temporária: para persistir e compartilhar fontes, será necessário um backend e controle de acesso.
