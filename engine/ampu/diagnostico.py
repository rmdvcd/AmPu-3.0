"""Autopruebas de recursos y de la interfaz Dear PyGui sin depender de pytest."""

from __future__ import annotations

import math
import sys
import tempfile
from pathlib import Path


def verificar_recursos() -> dict:
    """Comprueba contenido distribuido, teoría y los cuatro exportadores."""
    from matplotlib.figure import Figure
    from openpyxl import load_workbook
    import pandas as pd

    from ampu.docs.expresiones import previsualizar_latex
    from ampu.docs.teoria import DOCUMENTOS, PLANTILLA, listar_teoria, renderizar
    from ampu.io import ServicioExportacion as io

    raiz = DOCUMENTOS.parent.parent
    icono = raiz / "ui" / "recursos" / "icono.svg"
    render = PLANTILLA.parent
    recursos = [PLANTILLA, icono, render / "katex.min.js", render / "katex.min.css",
                render / "auto-render.min.js", render / "fonts" / "KaTeX_Main-Regular.woff2",
                render / "fonts" / "stix-two-math-latin-400-normal.woff2",
                DOCUMENTOS / "binomial.md", DOCUMENTOS.parent / "imagenes" / "binomial.png"]
    ausentes = [str(ruta) for ruta in recursos if not ruta.is_file() or ruta.stat().st_size == 0]
    if ausentes:
        raise RuntimeError("Faltan recursos empaquetados: " + ", ".join(ausentes))
    import xml.dom.minidom
    try:
        xml.dom.minidom.parse(str(icono))
    except Exception as exc:
        raise RuntimeError(f"El icono de la aplicación no es un SVG válido: {exc}") from exc
    lecciones = listar_teoria()
    imagenes = list((DOCUMENTOS.parent / "imagenes").glob("*.png"))
    if len(lecciones) != 57 or len(imagenes) != 31:
        raise RuntimeError(f"Catálogo incompleto: {len(lecciones)} lecciones, {len(imagenes)} imágenes")
    for tema in ("claro", "oscuro"):
        html = renderizar("binomial", tema)
        formula = previsualizar_latex(r"\frac{x}{2}", tema)
        if f'data-tema="{tema}"' not in html or "formula-bloque" not in html:
            raise RuntimeError(f"La plantilla documental {tema} no se pudo renderizar")
        if "htmlAndMathml" not in formula or "katex.min.js" not in formula:
            raise RuntimeError(f"Faltan recursos documentales {tema}")

    with tempfile.TemporaryDirectory(prefix="ampu-autoprueba-") as temporal:
        carpeta = Path(temporal)
        tabla = pd.DataFrame({"probabilidad": [0.12345678912345678], "etiqueta": ["AmPu"]})
        figura = Figure(figsize=(2, 2))
        figura.subplots().plot([0, 1], [0, 1])
        archivos = [io.excel({"Prueba": tabla}, carpeta / "prueba.xlsx"),
                    io.csv(tabla, carpeta / "prueba.csv"), io.png(figura, carpeta / "prueba.png"),
                    io.pdf(carpeta / "prueba.pdf", "Autoprueba", "Funciona sin red", {"Prueba": tabla}, figura)]
        io.guardar({"semilla": 42}, carpeta / "sesion.json")
        if io.cargar(carpeta / "sesion.json")["semilla"] != 42:
            raise RuntimeError("No se pudo leer la sesión empaquetada")
        if any(not ruta.is_file() or not ruta.stat().st_size for ruta in archivos):
            raise RuntimeError("Algún exportador no generó un archivo")
        excel = load_workbook(archivos[0], read_only=True)
        try:
            if not math.isclose(excel.active["A2"].value, tabla.iloc[0, 0], rel_tol=0, abs_tol=5e-16):
                raise RuntimeError("Se perdió precisión al exportar Excel")
        finally:
            excel.close()
    return {"recursos": "correctos", "lecciones": len(lecciones), "imagenes": len(imagenes),
            "formatos": ["xlsx", "csv", "png", "pdf", "json"],
            "congelado": bool(getattr(sys, "frozen", False)), "ui": "Dear PyGui"}


def verificar_interfaz(ventana) -> dict:
    """Ejercita la UI real sin viewport: widgets, motor, teoría y asistente."""
    import dearpygui.dearpygui as dpg

    modulos = ("distribuciones", "muestreo", "descriptiva", "probabilidad", "inferencia", "simulacion")
    for clave in modulos:
        if not ventana.cambiar(clave) or not ventana.esperar(30):
            raise RuntimeError(f"La vista {clave} no terminó su cálculo")
        vista = ventana.vistas[clave]
        if vista.ultimo is None or vista.tabla.rowCount() == 0 or not vista.tablas_exportables():
            raise RuntimeError(f"La vista {clave} no produjo resultados exportables")
        if not vista.grafico.figura.axes or not vista.resumen_exportable():
            raise RuntimeError(f"La vista {clave} no produjo gráfico y resumen")
    ventana.abrir_teoria("binomial")
    if "Binomial" not in str(dpg.get_value(ventana.vistas["teoria"].contenido)):
        raise RuntimeError("La biblioteca Dear PyGui no cargó la lección binomial")
    ventana.calculadora()
    dpg.set_value(ventana.asistente.entrada, "sqrt(2)+sin(pi/2)")
    ventana.asistente._evaluar()
    if ventana.asistente._resultado is None:
        raise RuntimeError("El asistente no evaluó su expresión de autoprueba")
    ventana.aplicar_tema("oscuro")
    if ventana.tema_actual != "oscuro":
        raise RuntimeError("No se aplicó el tema oscuro")
    ventana.aplicar_tema("claro")
    return {"interfaz": "Dear PyGui correcta", "modulos": len(modulos),
            "teoria": "texto y figura local", "asistente": "correcto", "temas": ["claro", "oscuro"]}
