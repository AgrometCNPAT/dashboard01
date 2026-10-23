# Como hospedar o CajuCarbo

Este site é 100% estático (HTML/CSS/JS, React carregado via CDN — sem etapa de build), então qualquer host de arquivos estáticos serve. Três caminhos prontos:

## GitHub Pages
1. Suba a pasta para um repositório no GitHub.
2. Em **Settings → Pages**, escolha "GitHub Actions" como fonte.
3. O workflow em `.github/workflows/deploy.yml` já publica automaticamente a cada `push` na branch `main`.

## Hospedagem própria (servidor da Embrapa, por exemplo)
Como é só HTML/CSS/JS estático, basta copiar a pasta para qualquer servidor web (Apache, Nginx, IIS) que sirva arquivos estáticos. Não precisa de Node, Python nem banco de dados rodando no servidor — **exceto** que o servidor precisa ser um servidor HTTP de verdade (não abrir o `index.html` direto do disco), porque o site usa `fetch` para carregar os dados e `iframe` para os painéis de produção nacional, e navegadores bloqueiam isso em `file://`.

## Checklist antes de publicar
- [ ] Revisar o dataset padrão e as opções do alternador em `js/lib/datasets.js` (veja `ALTERNADOR_DE_DADOS.md`)
- [ ] Conferir se `../sample-data/*.csv`, `../brand/*` e os painéis `../*.html` foram enviados junto (alguns provedores de Git ignoram arquivos grandes por padrão — confira o `.gitignore`)
- [ ] Testar em um navegador mobile real (não só o modo responsivo do desktop)
