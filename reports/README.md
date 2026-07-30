# Relatório: Posição do Pedido – Situações e WMS

Relatório **FastReport VCL (.fr3)** para banco **Firebird 2.0**, gerado a partir
da query fornecida.

> ⚠️ **Contexto:** o arquivo original em `\\192.168.2.10\Reports\...fr3` está numa
> rede local e **não é acessível** a partir do ambiente onde este relatório foi
> gerado. Por isso o `.fr3` foi **criado do zero** a partir da query, e não copiado
> da estrutura original. Layout, fontes e o componente de acesso a dados podem
> precisar de ajuste para casar com o padrão do seu sistema. Se você colar o
> conteúdo do `.fr3` original (abra num editor de texto), dá para refazer este
> arquivo espelhando exatamente a estrutura dele.

## Arquivos

| Arquivo | Descrição |
|---|---|
| `Posicao do pedido situacoes e WMS.fr3` | Relatório FastReport (XML). |
| `posicao-pedido-wms.sql` | A query, limpa e comentada, para referência/manutenção. |
| `../scripts/build_fr3.py` | Script que gera o `.fr3` a partir do `.sql` (edite e regenere). |

## O que foi corrigido na query

O texto original chegou com formatação de markdown quebrando os identificadores.
Foi normalizado assim:

- `ALMOXVOLUME*ID`, `INDICE*CID`, `INDICE*CLI`, `OUT*ALMOXAREA*ID`, `CLIFOR*ID`,
  `CIDADE*ID`, `CARGA*ID`, `OUT*ALMOXPEDVENDA*ID` → `_` (underscore) no lugar do `*`.
- Aspas “curvas” (`‘ ’`) em `‘CARREGAR_BARRAS’` → aspas retas (`'CARREGAR_BARRAS'`).
- O filtro de cargas vinha em sintaxe do **n8n**:
  `{{ $('Filtra cargas').item.json.carga_ids }}`. Em relatório isso não existe —
  virou o parâmetro **`CARGA_IDS`** (ver abaixo).

A query é compatível com Firebird 2.0 (`FIRST 1`, procedure selecionável
`PEDVENDA_VOLUMES_AREA(...)` no `FROM`, `CAST(... CHARACTER SET WIN1252)`).

## Estrutura do relatório

Página **A4 paisagem**. Bandas:

- **Título** – nome do relatório, data/hora de emissão, indicação do filtro.
- **Cabeçalho de página** – títulos das colunas (repete a cada página).
- **Cabeçalho de grupo** (`Condition = PosicaoPedido."PEDVENDA_ID"`) – dados do
  pedido: número, carga, cliente, índices e observação.
- **Dados mestre** (`MD_Volumes`) – uma linha por volume: código de barras, área
  de destino, situação, carregado (Sim/Não), data, hora, descrição do
  carregamento e data/hora real.
- **Rodapé de grupo** – total de volumes e total de carregados por pedido.
- **Rodapé de página** – data/hora e numeração.

O dataset dentro do relatório se chama **`PosicaoPedido`**. Todos os `[PosicaoPedido."CAMPO"]`
apontam para as colunas do `SELECT`.

## Acesso a dados (importante)

O `.fr3` embute a query num objeto **`TfrxADOQuery`** (componente genérico da
FastReport), apenas para o relatório ficar autocontido. **Adapte para o
componente que o seu sistema usa** (IBX / FIBPlus / UniDAC etc.):

1. No **Designer** da FastReport, abra a aba **Data**.
2. Remova o `TfrxADOQuery` chamado `PosicaoPedido` (ou aponte-o para sua conexão).
3. Adicione o componente de query do seu sistema, dê a ele o **UserName
   `PosicaoPedido`** e cole o SQL de `posicao-pedido-wms.sql`.
   Mantendo o nome `PosicaoPedido`, todos os campos já ficam ligados.

## Parâmetro `CARGA_IDS` e o filtro `IN (...)`

`WHERE PV.CARGA_ID IN (:CARGA_IDS)` é o ponto de atenção: **um parâmetro só
carrega um valor**, então `IN (:CARGA_IDS)` funciona para **uma** carga. Para
uma **lista** (ex.: `10,11,12`), a lista precisa entrar como **texto** no SQL,
porque comparar `CARGA_ID` (numérico) com a string `'10,11,12'` não filtra.

Formas de resolver:

- **Na aplicação:** monte o SQL da query substituindo `:CARGA_IDS` pela lista já
  formatada antes de abrir o dataset.
- **Por script no relatório:** na aba de script do `.fr3`, reescreva o SQL usando
  uma variável de relatório com a lista. Exemplo (PascalScript):

  ```pascal
  begin
    PosicaoPedido.SQL.Text :=
      // ... mesmo SELECT ...
      ' WHERE PV.CARGA_ID IN (' + <CARGA_IDS> + ') ' +
      // ... resto do SELECT ...
      '';
    PosicaoPedido.Open;
  end.
  ```

  Aqui `<CARGA_IDS>` é uma variável de relatório contendo `10,11,12` (a mesma
  lista que o n8n montava em `carga_ids`).

## Regenerar o `.fr3`

Ajuste colunas/layout em `scripts/build_fr3.py` e rode:

```bash
python3 scripts/build_fr3.py
```
