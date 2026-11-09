"""Reportes PDF autónomos con tabla, gráfico, resumen y fórmula pertinente."""

from html import escape
from io import BytesIO
from pathlib import Path

import pandas as pd
from matplotlib.figure import Figure
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, LongTable, Paragraph, SimpleDocTemplate, Spacer, TableStyle


def _formula_png(formula: str) -> BytesIO | None:
    """Dibuja LaTeX compatible con MathText sin abrir GUI ni cargar TeX externo."""
    if not formula or len(formula) > 450:
        return None
    try:
        figura = Figure(figsize=(8.8, 0.9), dpi=155, facecolor="white")
        figura.text(0.03, 0.48, "$" + formula.strip().replace("\n", " ") + "$",
                    va="center", fontsize=15, color="#172a4a")
        memoria = BytesIO()
        figura.savefig(memoria, format="png", bbox_inches="tight", facecolor="white")
        memoria.seek(0)
        return memoria
    except (ValueError, RuntimeError):
        return None


def exportar_pdf(
    destino: str | Path, titulo: str, resumen: str,
    tablas: dict[str, pd.DataFrame], figura: Figure | None = None,
    formula: str | None = None,
) -> Path:
    """Genera un informe PDF de varias páginas con encabezados repetidos.

    Una expresión no compatible con MathText se incluye como texto legible.
    El motor de teoría interactivo (KaTeX) no se requiere para exportar.
    """
    ruta = Path(destino).with_suffix(".pdf")
    estilos = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(ruta), pagesize=landscape(A4),
                            leftMargin=38, rightMargin=38, topMargin=38, bottomMargin=42)
    ancho = landscape(A4)[0] - 76
    historia: list = [Paragraph(escape(titulo), estilos["Title"]), Spacer(1, 9),
                       Paragraph(escape(resumen).replace("\n", "<br/>"), estilos["BodyText"]), Spacer(1, 14)]
    if formula:
        historia.append(Paragraph("Fórmula de referencia", estilos["Heading2"]))
        imagen = _formula_png(formula)
        if imagen is not None:
            lector = ImageReader(imagen)
            iw, ih = lector.getSize()
            altura = min(66, ih * ancho / iw)
            historia.append(Image(imagen, width=altura * iw / ih, height=altura))
        # La imagen nunca es la única representación: texto lineal seleccionable.
        historia.append(Paragraph("Código LaTeX: " + escape(formula).replace("\n", " "), estilos["Code"]))
        historia.append(Spacer(1, 10))
    if figura is not None:
        memoria = BytesIO()
        figura.savefig(memoria, format="png", dpi=135, bbox_inches="tight", facecolor="white")
        memoria.seek(0)
        iw, ih = ImageReader(memoria).getSize()
        altura = min(295, ih * ancho / iw)
        historia.extend([Image(memoria, width=altura*iw/ih, height=altura), Spacer(1, 12)])
    for nombre, tabla in tablas.items():
        if not isinstance(tabla, pd.DataFrame) or tabla.empty or not len(tabla.columns):
            continue
        historia.append(Paragraph(escape(nombre), estilos["Heading2"]))
        ancho_celda = ancho / len(tabla.columns)
        limite = max(8, int(ancho_celda / 4.5))
        filas = [[str(col)[:limite] for col in tabla.columns]]
        for fila in tabla.itertuples(index=False, name=None):
            filas.append([str(v)[:limite] if pd.notna(v) else "—" for v in fila])
        tabla_pdf = LongTable(filas, colWidths=[ancho_celda]*len(tabla.columns), repeatRows=1, hAlign="LEFT")
        tabla_pdf.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#172A4A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F7FB")]),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("LEADING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#27B4A5")),
        ]))
        historia.extend([tabla_pdf, Spacer(1, 13)])

    def _pie(canvas, documento):
        """Numeración sencilla en todas las páginas."""
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#60758C"))
        canvas.drawString(38, 22, "AmPu 3.0 · Informe estadístico")
        canvas.drawRightString(landscape(A4)[0]-38, 22, f"Página {documento.page}")
        canvas.restoreState()

    doc.build(historia, onFirstPage=_pie, onLaterPages=_pie)
    return ruta
