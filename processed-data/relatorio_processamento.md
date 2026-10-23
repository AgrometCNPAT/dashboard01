# Relatório de extração ERA5-Land

Rotina: `data_processing/extract_era5_land.py`. Nenhum cálculo de período ou agregação foi executado.
Os valores foram mantidos como texto de origem; campos vazios continuam vazios, sem substituição por zero.

## Fontes e deduplicação

| Localidade | Arquivo | Linhas de dados | Duplicatas idênticas | Removidas | Únicas | Intervalo temporal | Resolução |
|---|---|---:|---:|---:|---:|---|---|
| petrolina | `era5_land_Petrolina_completo.csv` | 5808 | 0 | 0 | 5808 | 2026-01-01 00:00:00 a 2026-08-30 23:00:00 | 1 hora (intervalo modal) |
| pacajus | `era5_land_Pacajus_diario.csv` | 9740 | 0 | 0 | 9740 | 2000-01-01 00:00:00 a 2026-08-31 00:00:00 | 1 dia (intervalo modal) |

Fontes esperadas não encontradas: era5_land_Pacajus_completo.csv (usado `era5_land_Pacajus_diario.csv` disponível).

A rotina remove somente linhas de dados completamente idênticas. Linhas distintas com a mesma data/hora e coordenadas são mantidas e listadas como conflitos para conferência.
A rotina extrai as 15 variáveis especificadas no pedido.

## Mapeamento e ausências

### petrolina — `era5_land_Petrolina_completo.csv`

Separador: `;`. Cabeçalho temporal: `valid_time`.

| Variável | Letra solicitada | Letra real | Cabeçalho usado | Unidade identificada | Valores ausentes após deduplicação | Situação |
|---|---|---|---|---|---:|---|
| Temperatura máxima | AB | AC | `t2m_c_max` | °C | 0 | ok; posição divergente |
| Temperatura mínima | AC | AB | `t2m_c_min` | °C | 0 | ok; posição divergente |
| Temperatura média | AA | AA | `t2m_c_mean` | °C | 0 | ok |
| Ponto de orvalho | V | V | `d2m_c` | °C | 0 | ok |
| Umidade relativa máxima | AF | AF | `rh_max` | Não informada no cabeçalho | 0 | ok |
| Umidade relativa média | AD | AD | `rh_mean` | Não informada no cabeçalho | 0 | ok |
| Umidade relativa mínima | AE | AE | `rh_min` | Não informada no cabeçalho | 0 | ok |
| Radiação global | AG | AG | `ssrd_mjm2_dia` | MJ/m²/dia | 0 | ok |
| Chuva/precipitação | AH | AH | `tp_mm_dia` | mm/dia | 0 | ok |
| Velocidade média do vento | AI | AI | `wind_speed_mean` | Não informada no cabeçalho | 0 | ok |
| Pressão atmosférica média | K | AJ | `sp_hpa_mean` | hPa | 0 | ok; posição divergente |
| Umidade do solo — camada 1 | F | F | `swvl1` | Não informada no cabeçalho | 0 | ok |
| Umidade do solo — camada 2 | G | H | `swvl2` | Não informada no cabeçalho | 0 | ok; posição divergente |
| Umidade do solo — camada 3 | H | I | `swvl3` | Não informada no cabeçalho | 0 | ok; posição divergente |
| Umidade do solo — camada 4 | I | G | `swvl4` | Não informada no cabeçalho | 0 | ok; posição divergente |

Conflitos por data/hora e coordenadas: nenhum identificado.
Arquivo extraído: `C:\Users\mat3uz\OneDrive\Desktop\cajucarboR\dashboard-main\processed-data\era5_land_petrolina_extraido.csv`.

### pacajus — `era5_land_Pacajus_diario.csv`

Separador: `,`. Cabeçalho temporal: `valid_time`.

| Variável | Letra solicitada | Letra real | Cabeçalho usado | Unidade identificada | Valores ausentes após deduplicação | Situação |
|---|---|---|---|---|---:|---|
| Temperatura máxima | AB | AC | `t2m_c_max` | °C | 0 | ok; posição divergente |
| Temperatura mínima | AC | AB | `t2m_c_min` | °C | 0 | ok; posição divergente |
| Temperatura média | AA | AA | `t2m_c_mean` | °C | 0 | ok |
| Ponto de orvalho | V | V | `d2m_c` | °C | 0 | ok |
| Umidade relativa máxima | AF | AF | `rh_max` | Não informada no cabeçalho | 0 | ok |
| Umidade relativa média | AD | AD | `rh_mean` | Não informada no cabeçalho | 0 | ok |
| Umidade relativa mínima | AE | AE | `rh_min` | Não informada no cabeçalho | 0 | ok |
| Radiação global | AG | AG | `ssrd_mjm2_dia` | MJ/m²/dia | 0 | ok |
| Chuva/precipitação | AH | AH | `tp_mm_dia` | mm/dia | 0 | ok |
| Velocidade média do vento | AI | AI | `wind_speed_mean` | Não informada no cabeçalho | 0 | ok |
| Pressão atmosférica média | K | AJ | `sp_hpa_mean` | hPa | 0 | ok; posição divergente |
| Umidade do solo — camada 1 | F | H | `swvl1` | Não informada no cabeçalho | 0 | ok; posição divergente |
| Umidade do solo — camada 2 | G | F | `swvl2` | Não informada no cabeçalho | 0 | ok; posição divergente |
| Umidade do solo — camada 3 | H | I | `swvl3` | Não informada no cabeçalho | 0 | ok; posição divergente |
| Umidade do solo — camada 4 | I | G | `swvl4` | Não informada no cabeçalho | 0 | ok; posição divergente |

Conflitos por data/hora e coordenadas: nenhum identificado.
Arquivo extraído: `C:\Users\mat3uz\OneDrive\Desktop\cajucarboR\dashboard-main\processed-data\era5_land_pacajus_extraido.csv`.

## Observações de validação

- O mapeamento de saída foi feito pelo nome do cabeçalho, não pela posição presumida.
- Qualquer diferença entre a letra solicitada e a posição real está marcada acima; o cabeçalho semântico correspondente foi usado para evitar associar uma variável incorreta.
- Unidades que não constam explicitamente nos cabeçalhos foram reportadas como não informadas; nenhuma conversão ou preenchimento foi aplicado.
- As localidades foram gravadas em arquivos independentes; nenhuma linha entre fontes foi combinada.
- Nenhuma reamostragem ou agregação foi feita. A resolução indicada é o intervalo modal entre timestamps únicos; valores diários repetidos em linhas horárias não foram somados.
- A coluna `timestamp_original` preserva o texto temporal da fonte; `date` e `time` são campos separados para uso posterior.
