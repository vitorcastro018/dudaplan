#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera o arquivo FastReport VCL (.fr3) "Posicao do pedido situacoes e WMS.fr3"
a partir da query em reports/posicao-pedido-wms.sql.

FastReport .fr3 e' XML. Objetos = <TfrxXxx .../>. Propriedades de lista de
strings (Memo, SQL) sao serializadas como elemento filho <Prop.Text>...</Prop.Text>.
Coordenadas em pixels (96 dpi); margens em mm. Pagina A4 paisagem.
"""
import os
import xml.sax.saxutils as sx

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SQL_PATH = os.path.join(ROOT, "reports", "posicao-pedido-wms.sql")
OUT_PATH = os.path.join(ROOT, "reports", "Posicao do pedido situacoes e WMS.fr3")

# SQL (sem os comentarios de cabecalho do .sql; extraimos so o SELECT)
with open(SQL_PATH, encoding="utf-8") as f:
    raw = f.read()
SQL = raw[raw.index("SELECT"):].rstrip() + "\n"

DS = "PosicaoPedido"  # nome do dataset/query dentro do relatorio

def esc(s):
    return sx.escape(s)

# ---------------------------------------------------------------- helpers
def memo(name, x, y, w, h, text, *, size=10, bold=False, halign="haLeft",
         valign="vaCenter", frame=0, wordwrap=False, color=0, fill=None):
    font_h = -int(round(size * 96 / 72.0))
    style = 1 if bold else 0
    attrs = [
        f'Name="{name}"',
        f'Left="{x}"', f'Top="{y}"', f'Width="{w}"', f'Height="{h}"',
        'ShowHint="False"',
        'Font.Charset="0"', f'Font.Color="{color}"', f'Font.Height="{font_h}"',
        'Font.Name="Arial"', f'Font.Style="{style}"',
        f'HAlign="{halign}"', f'VAlign="{valign}"',
        f'WordWrap="{1 if wordwrap else 0}"',
    ]
    if frame:
        attrs += [f'Frame.Typ="{frame}"', 'Frame.Width="1"', 'Frame.Color="0"']
    if fill is not None:
        attrs += ['Color="%d"' % fill, 'Fill.BackColor="%d"' % fill]
    return (f'      <TfrxMemoView {" ".join(attrs)}>\n'
            f'        <Memo.Text>{esc(text)}</Memo.Text>\n'
            f'      </TfrxMemoView>\n')

# ---------------------------------------------------------------- columns
# (rotulo, expressao-de-dado, x, largura, alinhamento)
COLS = [
    ("Cod. Barras",          f'[{DS}."CODIGOBARRAS"]',                            0,   115, "haLeft"),
    ("Area destino",         f'[{DS}."DESCRICAO"]',                             115,   175, "haLeft"),
    ("Situacao",             f'[{DS}."SITUACAO"]',                              290,    60, "haCenter"),
    ("Carregado",            f'[IIF(<{DS}."CARREGADO"> = 1, \'Sim\', \'Nao\')]', 350,   70, "haCenter"),
    ("Data",                 f'[{DS}."DATA"]',                                  420,    75, "haCenter"),
    ("Hora",                 f'[{DS}."HORA"]',                                  495,    65, "haCenter"),
    ("Descr. Carregamento",  f'[{DS}."DESCRICAOCARREGAMENTO"]',                 560,   250, "haLeft"),
    ("Data/Hora Real",       f'[{DS}."DATAHORAREAL"]',                          810,   237, "haCenter"),
]
PAGE_W = 1047  # largura util (277mm @96dpi)

# ---------------------------------------------------------------- bands
out = []

# ReportTitle -------------------------------------------------------------
band = ['    <TfrxReportTitle Name="ReportTitle1" Left="0" Top="18.9" '
        'Width="1047" Height="64">\n']
band.append(memo("MTitle", 0, 0, PAGE_W, 26,
                 "Posicao do Pedido - Situacoes e WMS",
                 size=16, bold=True, halign="haCenter"))
band.append(memo("MEmit", 0, 30, 500, 18,
                 "Emitido em: [Date] [Time]", size=9))
band.append(memo("MFiltro", 0, 46, PAGE_W, 18,
                 "Filtro de cargas: definido na aplicacao (parametro CARGA_IDS)",
                 size=9))
band.append('    </TfrxReportTitle>\n')
out.append("".join(band))

# PageHeader (cabecalho das colunas) --------------------------------------
band = ['    <TfrxPageHeader Name="PageHeader1" Left="0" Top="94" '
        'Width="1047" Height="22">\n']
for i, (label, _expr, x, w, _al) in enumerate(COLS, 1):
    band.append(memo(f"H{i}", x, 0, w, 22, label, size=9, bold=True,
                     halign="haCenter", frame=15, fill=0xE0E0E0))
band.append('    </TfrxPageHeader>\n')
out.append("".join(band))

# GroupHeader (por pedido) ------------------------------------------------
band = ['    <TfrxGroupHeader Name="GH_Pedido" Left="0" Top="124" '
        'Width="1047" Height="46" '
        f'Condition="{DS}.&quot;PEDVENDA_ID&quot;" KeepChild="1">\n']
band.append(memo("GPed", 0, 2, 190, 18,
                 f'Pedido: [{DS}."PEDVENDA_ID"]', size=10, bold=True))
band.append(memo("GCarga", 190, 2, 150, 18,
                 f'Carga: [{DS}."CARGA_ID"]', size=10, bold=True))
band.append(memo("GCli", 340, 2, 500, 18,
                 f'Cliente: [{DS}."NOMECLIENTE"] (cod. [{DS}."CLIFOR_ID"])',
                 size=10, bold=True))
band.append(memo("GInd", 840, 2, 207, 18,
                 f'Ind.Cid: [{DS}."INDICE_CID"]  Ind.Cli: [{DS}."INDICE_CLI"]',
                 size=9, halign="haRight"))
band.append(memo("GObs", 0, 24, 1047, 18,
                 f'Observacao: [{DS}."OBSERVACAO"]', size=9))
band.append('    </TfrxGroupHeader>\n')
out.append("".join(band))

# MasterData (volumes) ----------------------------------------------------
band = ['    <TfrxMasterData Name="MD_Volumes" Left="0" Top="176" '
        f'Width="1047" Height="20" DataSet="{DS}" DataSetName="{DS}" '
        'RowCount="0">\n']
for i, (_label, expr, x, w, al) in enumerate(COLS, 1):
    band.append(memo(f"D{i}", x, 0, w, 20, expr, size=9, halign=al,
                     frame=15, wordwrap=(al == "haLeft")))
band.append('    </TfrxMasterData>\n')
out.append("".join(band))

# GroupFooter (totais do pedido) -----------------------------------------
band = ['    <TfrxGroupFooter Name="GF_Pedido" Left="0" Top="202" '
        'Width="1047" Height="22">\n']
band.append(memo("FTot", 0, 2, 400, 18,
                 "Volumes: [COUNT(MD_Volumes)]   Carregados: "
                 f'[SUM(<{DS}."CARREGADO">,MD_Volumes)]',
                 size=9, bold=True))
band.append('    </TfrxGroupFooter>\n')
out.append("".join(band))

# PageFooter --------------------------------------------------------------
band = ['    <TfrxPageFooter Name="PageFooter1" Left="0" Top="230" '
        'Width="1047" Height="20">\n']
band.append(memo("PgDt", 0, 2, 400, 16, "[Date] [Time]", size=8))
band.append(memo("PgNo", 647, 2, 400, 16,
                 "Pagina [Page#] de [TotalPages#]", size=8, halign="haRight"))
band.append('    </TfrxPageFooter>\n')
out.append("".join(band))

bands_xml = "".join(out)

# ---------------------------------------------------------------- query obj
query_xml = (
    f'  <TfrxADOQuery Name="{DS}" UserName="{DS}" CloseDataSource="0" '
    f'BCDToCurrency="0" IgnoreDupParams="0">\n'
    f'    <SQL.Text>{esc(SQL)}</SQL.Text>\n'
    f'    <TfrxADOQueryParams>\n'
    f'      <TfrxADOQueryParams1 Name="CARGA_IDS" DataType="ftInteger" '
    f'ParamType="ptInput" Value="0"/>\n'
    f'    </TfrxADOQueryParams>\n'
    f'  </TfrxADOQuery>\n'
)

# ---------------------------------------------------------------- report
report = f'''<?xml version="1.0" encoding="utf-8"?>
<Report Version="6.9.13" DotMatrix="0" Left="0" Top="0" Base="0" Persistent="1" PrintIfEmpty="0" ScriptLanguage="PascalScript" ScriptText="begin&#13;&#10;&#13;&#10;end." ConvertNullToZero="1" DoublePass="0">
  <TfrxDataPage Name="Data" Width="1000" Height="1000">
{query_xml}  </TfrxDataPage>
  <TfrxReportPage Name="Page1" PaperWidth="297" PaperHeight="210" PaperSize="9" LeftMargin="10" RightMargin="10" TopMargin="10" BottomMargin="10" Orientation="poLandscape" Frame.Typ="0" MirrorMode="" Columns="0" ColumnWidth="0" ColumnPositions.Text="" DataSet="{DS}" DataSetName="{DS}">
{bands_xml}  </TfrxReportPage>
</Report>
'''

with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(report)

print("wrote:", OUT_PATH)
print("bytes:", len(report.encode("utf-8")))
