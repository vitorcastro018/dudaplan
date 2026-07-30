/*
  Posição do Pedido - Situações e WMS
  Banco: Firebird 2.0

  Query de origem do relatório FastReport "Posicao do pedido situacoes e WMS.fr3".

  Observações:
  - Corrigidos os identificadores que vieram com "*" (formatação) para "_":
      ALMOXVOLUME_ID, INDICE_CID, INDICE_CLI, OUT_ALMOXAREA_ID, CLIFOR_ID,
      CIDADE_ID, ALMOXAREA_ID, OUT_ALMOXPEDVENDA_ID, CARGA_ID.
  - O filtro de cargas usava sintaxe do n8n:
        {{ $('Filtra cargas').item.json.carga_ids }}
    Em relatório isso vira um parâmetro. Aqui está como :CARGA_IDS.
    ATENÇÃO: IN (:CARGA_IDS) só funciona como parâmetro único se o banco
    receber UM valor. Para uma LISTA (ex.: 10,11,12) a lista precisa ser
    injetada como TEXTO no SQL (ver reports/README.md).
*/

SELECT
    SEL.*
FROM (
    SELECT
        BASE.*,
        (
            SELECT FIRST 1 L.DESCRICAO
            FROM ALMOXVOLUMESLOG L
            WHERE L.ALMOXVOLUME_ID = BASE.ALMOXVOLUME_ID
              AND L.SITUACAO = 10
              AND BASE.SITUACAO >= 10
            ORDER BY L.DATA DESC, L.HORA DESC
        ) AS DESCRICAOCARREGAMENTO,
        (
            SELECT FIRST 1 CAST((L.DATA || ' ' || L.HORA) AS TIMESTAMP)
            FROM ALMOXVOLUMESLOG L
            WHERE L.ALMOXVOLUME_ID = BASE.ALMOXVOLUME_ID
              AND L.SITUACAO = 10
              AND BASE.SITUACAO >= 10
            ORDER BY L.DATA DESC, L.HORA DESC
        ) AS DATAHORAREAL
    FROM (
        SELECT DISTINCT
            PV.PEDVENDA_ID,
            PV.CARGA_ID,
            PV.CLIFOR_ID,
            C.NOME AS NOMECLIENTE,
            PV.OBSERVACAO,
            COALESCE(PV.INDICE_CID, CI.INDICE) AS INDICE_CID,
            COALESCE(PV.INDICE_CLI, C.INDICE)  AS INDICE_CLI,
            VA.OUT_ALMOXAREA_ID,
            CAST(A.DESCRICAO AS VARCHAR(40) CHARACTER SET WIN1252) AS DESCRICAO,
            V.ALMOXVOLUME_ID,
            V.ALMOXVOLUMETIPO_ID,
            V.ALMOXAREA_ID,
            V.CODIGOBARRAS,
            V.DATA,
            V.HORA,
            V.SITUACAO,
            CASE WHEN V.SITUACAO >= 10 THEN 1 ELSE 0 END AS CARREGADO,
            V.USUARIO_ID,
            V.EXPEDIDOR_ID
        FROM PEDVENDAS PV
        INNER JOIN CLIFORS C
            ON C.CLIFOR_ID = PV.CLIFOR_ID
        INNER JOIN CIDADES CI
            ON CI.CIDADE_ID = C.CIDADE_ID
        LEFT JOIN PEDVENDA_VOLUMES_AREA(PV.PEDVENDA_ID, 1) VA
            ON 0 = 0
        LEFT JOIN ALMOXAREA A
            ON A.ALMOXAREA_ID = VA.OUT_ALMOXAREA_ID
        LEFT JOIN ALMOXVOLUMES V
            ON V.ALMOXPEDVENDA_ID = VA.OUT_ALMOXPEDVENDA_ID
        WHERE PV.CARGA_ID IN (:CARGA_IDS)
          AND COALESCE(VA.OUT_ALMOXAREA_ID, 0) <> 2
          AND PV.SITUACAO <> 'ABERTO'
    ) BASE
) SEL
WHERE (
    SEL.DESCRICAOCARREGAMENTO IS NULL
    OR SEL.DESCRICAOCARREGAMENTO <> 'CARREGAR_BARRAS'
)
ORDER BY
    SEL.PEDVENDA_ID DESC,
    SEL.CODIGOBARRAS
