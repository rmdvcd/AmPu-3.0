"""Punto de entrada multiplataforma de AmPu 3.0 con Dear PyGui."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from ampu import __version__
from ampu.ui.preferencias import ruta_preferencias


def configurar_logging() -> Path:
    """Usa datos de usuario, nunca el directorio del paquete instalado."""
    carpeta = ruta_preferencias().parent / "logs"
    carpeta.mkdir(parents=True, exist_ok=True)
    registro = carpeta / "ampu.log"
    if not any(isinstance(h, RotatingFileHandler) and Path(h.baseFilename) == registro
               for h in logging.getLogger("ampu").handlers):
        manejador = RotatingFileHandler(registro, maxBytes=2_000_000,
                                        backupCount=3, encoding="utf-8")
        manejador.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
        logging.getLogger("ampu").addHandler(manejador)
    logging.getLogger("ampu").setLevel(logging.INFO)
    return registro


def main(argv: list[str] | None = None) -> int:
    """``--version`` y recursos no crean contexto gráfico; la UI usa Dear PyGui."""
    parser = argparse.ArgumentParser(prog="ampu",
        description="Laboratorio educativo de probabilidad y estadística")
    parser.add_argument("--version", action="version", version=f"AmPu {__version__}")
    parser.add_argument("--verify-resources", action="store_true",
                        help="Comprueba recursos y exportaciones, sin crear ventanas")
    parser.add_argument("--self-test", action="store_true",
                        help="Comprueba la interfaz Dear PyGui y los seis análisis sin viewport")
    opciones = parser.parse_args(argv)
    if opciones.verify_resources:
        from ampu.diagnostico import verificar_recursos
        try:
            print(json.dumps(verificar_recursos(), ensure_ascii=False))
            return 0
        except Exception as exc:
            print(f"Autoprueba fallida (recursos): {exc}", file=sys.stderr)
            return 1
    try:
        import matplotlib
        matplotlib.use("Agg", force=True)
        import dearpygui.dearpygui as dpg
    except (ImportError, OSError) as exc:
        print(f"Faltan bibliotecas gráficas de Dear PyGui: {exc}. "
              "Consulta las dependencias del README.", file=sys.stderr)
        return 1
    configurar_logging()
    dpg.create_context()
    try:
        from ampu.ui.main_window import VentanaPrincipal
        ventana = VentanaPrincipal()
        if opciones.self_test:
            try:
                reporte = verificar_recursos_local(ventana)
                print(json.dumps(reporte, ensure_ascii=False))
                return 0
            except Exception as exc:
                logging.getLogger("ampu").exception("Falló la autoprueba Dear PyGui")
                print(f"Autoprueba fallida (Dear PyGui): {exc}", file=sys.stderr)
                return 1
        return ventana.ejecutar()
    finally:
        ventana.cerrar() if "ventana" in locals() else None
        dpg.destroy_context()


def verificar_recursos_local(ventana) -> dict:
    """Combina recursos y UI manteniendo las importaciones pesadas fuera del arranque CLI."""
    from ampu.diagnostico import verificar_interfaz, verificar_recursos
    reporte = verificar_recursos()
    reporte.update(verificar_interfaz(ventana))
    return reporte
