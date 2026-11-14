"""Integración de escritorio de Windows, opcional al usar AmPu como servidor.

pystray usa Shell_NotifyIcon de Windows y restaura el icono si se reinicia
Explorer. Se importa de forma diferida: Linux, los tests y ``python app.py``
no necesitan un escritorio ni esta dependencia.
"""

from __future__ import annotations

import ctypes
import logging
import os
from pathlib import Path
import sys
import threading
import webbrowser

log = logging.getLogger("ampu.escritorio")
ID_APLICACION = "AmPu.Laboratorio.3"


def ruta_icono() -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return base / "frontend" / "static" / "img" / "icono_ampu.png"


def identificar_aplicacion() -> None:
    """Identidad estable para agrupar las ventanas nativas en Windows."""
    if sys.platform != "win32":
        return
    try:
        shell = ctypes.WinDLL("shell32", use_last_error=True)
        shell.SetCurrentProcessExplicitAppUserModelID.argtypes = [ctypes.c_wchar_p]
        shell.SetCurrentProcessExplicitAppUserModelID.restype = ctypes.c_long
        resultado = shell.SetCurrentProcessExplicitAppUserModelID(ID_APLICACION)
        if resultado < 0:
            raise OSError(f"SetCurrentProcessExplicitAppUserModelID: HRESULT {resultado}")
    except (AttributeError, OSError):
        log.warning("Windows no pudo establecer la identidad de AmPu.", exc_info=True)


def activar_consola() -> None:
    """Recupera una salida visible si falla la bandeja de un .exe sin consola."""
    if sys.platform != "win32" or sys.stdout is not None:
        return
    try:
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        if kernel.AllocConsole():
            sys.stdout = open("CONOUT$", "w", encoding="utf-8", buffering=1)
            sys.stderr = open("CONOUT$", "w", encoding="utf-8", buffering=1)
    except OSError:
        log.warning("No se pudo abrir la consola de respaldo.", exc_info=True)


def iniciar_bandeja(url: str, servidor: threading.Thread, detener: threading.Event, version: str) -> bool:
    """Mantiene la bandeja de Windows; devuelve False si no se usa o falla.

    El backend Win32 admite su bucle en un hilo propio. Se usa un hilo daemon
    para que ni sus auxiliares bloqueen la salida si falla la creación nativa.
    Salir elimina el icono y libera el arranque. El servidor y sus trabajadores
    también son daemon: terminan con el proceso, sin dejar un servidor huérfano.
    Cerrar la pestaña del navegador no detiene el motor; «Abrir AmPu» permite
    recuperarla. AMPU_NO_TRAY=1 mantiene el modo de consola.
    """
    if sys.platform != "win32" or os.environ.get("AMPU_NO_TRAY") == "1":
        return False

    bandeja = None
    fin_bandeja = threading.Event()
    fallo_bandeja = threading.Event()

    def cerrar_icono(icono):
        try:
            icono.stop()
        except Exception:
            log.warning("No se pudo retirar el icono de la bandeja.", exc_info=True)

    try:
        from PIL import Image
        from pystray import Icon, Menu, MenuItem

        with Image.open(ruta_icono()) as archivo:
            imagen = archivo.convert("RGBA")

        def abrir(icono, item):
            webbrowser.open(url)

        def salir(icono, item):
            detener.set()
            icono.stop()

        bandeja = Icon(
            "ampu",
            imagen,
            f"AmPu {version} · Laboratorio local",
            menu=Menu(
                MenuItem("Abrir AmPu", abrir, default=True),
                Menu.SEPARATOR,
                MenuItem("Salir de AmPu", salir),
            ),
        )

        def vigilar(icono):
            try:
                icono.visible = True
                while not fin_bandeja.wait(0.5):
                    if detener.is_set() or not servidor.is_alive():
                        detener.set()
                        break
            except Exception:
                fallo_bandeja.set()
                log.exception("Windows no pudo mostrar la bandeja de AmPu.")
            finally:
                cerrar_icono(icono)

        def ejecutar():
            try:
                bandeja.run(setup=vigilar)
            except Exception:
                fallo_bandeja.set()
                log.exception("No se pudo iniciar el bucle de la bandeja de AmPu.")
            finally:
                fin_bandeja.set()

        hilo_bandeja = threading.Thread(target=ejecutar, name="AmPu-bandeja", daemon=True)
        hilo_bandeja.start()
        while not fin_bandeja.wait(0.25):
            if detener.is_set():
                cerrar_icono(bandeja)
                hilo_bandeja.join(timeout=2)
                break
        if fallo_bandeja.is_set():
            return False
        detener.set()
        return True
    except Exception:  # el modo de consola sigue disponible si falla Explorer
        log.exception("No se pudo iniciar la bandeja de AmPu; se conserva el modo de consola.")
        return False
    finally:
        fin_bandeja.set()
        if bandeja is not None:
            cerrar_icono(bandeja)
