"""Recursos, registro y bandeja nativa de Windows; sin dependencias GUI al importar."""

from __future__ import annotations

import ctypes
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import sys
import tempfile
import threading

from arranque import Evento

log = logging.getLogger("ampu.escritorio")
ID_APLICACION = "AmPu.Laboratorio.3"


def ruta_icono() -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return base / "frontend" / "static" / "img" / "icono_ampu.png"


def ruta_ico() -> Path:
    return ruta_icono().parent.parent / "favicon.ico"


def identificar_aplicacion() -> None:
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


def ocultar_consola_propia() -> None:
    """Oculta solo una consola exclusiva de AmPu, nunca el terminal del usuario.

    AmPu.pyw y el .exe --windowed no crean consola. Este respaldo cubre un
    doble clic sobre main.py asociado a python.exe, sin ocultar una consola
    compartida con cmd, PowerShell u otros procesos.
    """
    if sys.platform != "win32":
        return
    try:
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.GetConsoleWindow.restype = ctypes.c_void_p
        kernel.GetConsoleProcessList.argtypes = [ctypes.POINTER(ctypes.c_ulong), ctypes.c_ulong]
        kernel.GetConsoleProcessList.restype = ctypes.c_ulong
        procesos = (ctypes.c_ulong * 2)()
        ventana = kernel.GetConsoleWindow()
        if (ventana and kernel.GetConsoleProcessList(procesos, 2) == 1
                and procesos[0] == os.getpid()):
            user = ctypes.WinDLL("user32", use_last_error=True)
            user.ShowWindow.argtypes = [ctypes.c_void_p, ctypes.c_int]
            user.ShowWindow.restype = ctypes.c_int
            user.ShowWindow(ventana, 0)  # SW_HIDE
    except (AttributeError, OSError):
        log.warning("No se pudo ocultar la consola exclusiva de AmPu.", exc_info=True)


def activar_consola() -> None:
    """Consola solo para el modo de diagnóstico solicitado explícitamente."""
    if sys.platform != "win32" or sys.stdout is not None:
        return
    try:
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        if kernel.AllocConsole():
            sys.stdout = open("CONOUT$", "w", encoding="utf-8", buffering=1)
            sys.stderr = open("CONOUT$", "w", encoding="utf-8", buffering=1)
    except OSError:
        log.warning("No se pudo abrir la consola de diagnóstico.", exc_info=True)


def configurar_registro() -> Path | None:
    """Guarda hasta tres archivos de 1 MiB fuera de la carpeta de instalación."""
    raiz = logging.getLogger()
    for handler in raiz.handlers:
        if handler.get_name() == "ampu-archivo":
            return Path(handler.baseFilename)
    local = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    for carpeta in (local / "AmPu" / "logs", Path(tempfile.gettempdir()) / "AmPu" / "logs"):
        try:
            carpeta.mkdir(parents=True, exist_ok=True)
            archivo = carpeta / "ampu.log"
            handler = RotatingFileHandler(archivo, maxBytes=1024 * 1024, backupCount=2, encoding="utf-8")
            handler.set_name("ampu-archivo")
            handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
            raiz.addHandler(handler)
            raiz.setLevel(logging.INFO)
            return archivo
        except OSError:
            continue
    return None


def mostrar_error_nativo(titulo: str, mensaje: str) -> None:
    """Último respaldo gráfico si ni siquiera se puede crear la ventana Tk."""
    if sys.platform == "win32":
        try:
            user = ctypes.WinDLL("user32", use_last_error=True)
            user.MessageBoxW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_uint]
            user.MessageBoxW.restype = ctypes.c_int
            user.MessageBoxW(None, mensaje, titulo, 0x10)  # MB_OK | MB_ICONERROR
            return
        except (AttributeError, OSError):
            pass
    log.error("%s: %s", titulo, mensaje)


class BandejaWindows:
    """Win32 en un hilo daemon; los callbacks solo encolan acciones para Tk.

    pystray restaura el icono al reiniciarse Explorer. El setup termina en
    cuanto se muestra el icono, por lo que stop no espera un vigilante infinito.
    """

    def __init__(self, eventos, disponible):
        self.eventos = eventos
        self.disponible = disponible
        self.lista = threading.Event()
        self.terminada = threading.Event()
        self._cerrada = threading.Event()
        self._fallo = threading.Event()
        self._icono = None
        self._hilo = None
        self._lock_retirada = threading.Lock()
        self._retirando = False

    def iniciar(self):
        if self._hilo is not None or self._cerrada.is_set() or self.terminada.is_set():
            return
        if sys.platform != "win32" or os.environ.get("AMPU_NO_TRAY") == "1":
            self.eventos.put(Evento("bandeja_no", "Bandeja desactivada. La ventana permanece disponible en la barra de tareas."))
            self.terminada.set()
            return
        self._hilo = threading.Thread(target=self._ejecutar, name="AmPu-bandeja", daemon=True)
        self._hilo.start()

    def _fallar(self):
        if not self._cerrada.is_set() and not self._fallo.is_set():
            self._fallo.set()
            self.lista.clear()
            self.eventos.put(Evento("bandeja_error", "La bandeja no está disponible. Mantén el launcher en la barra de tareas y usa «Salir» para cerrar AmPu."))

    def _ejecutar(self):
        try:
            from PIL import Image
            from pystray import Icon, Menu, MenuItem

            with Image.open(ruta_icono()) as archivo:
                imagen = archivo.convert("RGBA")
            self._icono = Icon("ampu", imagen, "AmPu · Launcher", menu=Menu(
                MenuItem("Mostrar launcher", lambda *_: self.eventos.put(Evento("mostrar")), default=True),
                MenuItem("Abrir AmPu", lambda *_: self.eventos.put(Evento("abrir")), enabled=lambda _: self.disponible.is_set()),
                Menu.SEPARATOR,
                MenuItem("Salir de AmPu", lambda *_: self.eventos.put(Evento("salir"))),
            ))
            if self._cerrada.is_set():
                return

            def preparar(icono):
                try:
                    if self._cerrada.is_set():
                        icono.stop()
                        return
                    icono.visible = True
                    if self._cerrada.is_set():
                        icono.stop()
                        return
                    self.lista.set()
                    self.eventos.put(Evento("bandeja_lista"))
                except Exception:
                    log.exception("Windows no pudo mostrar la bandeja de AmPu.")
                    self._fallar()
                    self.cerrar()

            self._icono.run(setup=preparar)
        except Exception:
            log.exception("No se pudo iniciar la bandeja de AmPu.")
            self._fallar()
        finally:
            self.lista.clear()
            self._fallar()
            self.cerrar()
            self.terminada.set()

    def actualizar_menu(self):
        if self._icono is not None and self.lista.is_set():
            try:
                self._icono.update_menu()
            except Exception:
                log.exception("No se pudo actualizar el menú de la bandeja.")
                self._fallar()
                self.cerrar()

    def cerrar(self):
        self._cerrada.set()
        self.lista.clear()
        if self._hilo is None:
            self.terminada.set()
        if self._icono is None:
            return
        with self._lock_retirada:
            if self._retirando:
                return
            self._retirando = True

        def retirar():
            try:
                self._icono.stop()
            except Exception:
                log.warning("No se pudo retirar el icono de la bandeja.", exc_info=True)

        # stop puede esperar el setup de pystray; nunca bloquear el hilo de Tk.
        threading.Thread(target=retirar, name="AmPu-retirar-bandeja", daemon=True).start()
