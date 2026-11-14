"""Ciclo de vida del motor local, sin importar Tk ni el motor al cargar el módulo."""

from __future__ import annotations

from dataclasses import dataclass
import errno
import importlib
import json
import logging
from queue import SimpleQueue
import threading
import time
import urllib.error
import urllib.request

log = logging.getLogger("ampu.arranque")


@dataclass(frozen=True)
class Evento:
    tipo: str
    detalle: str = ""
    version: str = ""


def url_local(anfitrion: str, puerto: int) -> str:
    host = {"0.0.0.0": "127.0.0.1", "::": "::1"}.get(anfitrion, anfitrion)
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    return f"http://{host}:{puerto}"


def esperar_servidor(url, version, hilo, detener, *, plazo=25.0) -> bool:
    """Consulta solo el servidor propio, sin proxy y con cancelación acotada."""
    abrir = urllib.request.build_opener(urllib.request.ProxyHandler({})).open
    limite = time.monotonic() + plazo
    while not detener.is_set() and hilo.is_alive() and time.monotonic() < limite:
        try:
            with abrir(f"{url}/api/salud", timeout=0.6) as respuesta:
                salud = json.load(respuesta)
                if (respuesta.status == 200 and isinstance(salud, dict)
                        and salud.get("estado") == "ok" and salud.get("version") == version
                        and hilo.is_alive() and not detener.is_set()):
                    return True
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            pass
        detener.wait(0.15)
    return False


def crear_servidor(modulo, anfitrion, puerto):
    """Reserva el puerto antes de sondear salud y conserva todos los recursos.

    El launcher usa Waitress, incluido en requirements.txt. Un mapa y un
    dispatcher propios evitan cerrar otros servidores del mismo proceso o
    dejar trabajadores tras un intento fallido de arranque.
    """
    from waitress import create_server, wasyncore
    from waitress.task import ThreadedTaskDispatcher

    mapa = {}
    dispatcher = ThreadedTaskDispatcher()

    def cerrar():
        # Deja de aceptar conexiones, pero conserva los triggers hasta que
        # terminen los workers: cerrar primero el mapa puede provocar EBADF
        # en la última respuesta, aunque el cliente ya la haya recibido.
        for canal in list(mapa.values()):
            if canal.accepting:
                wasyncore.dispatcher.close(canal)
        try:
            dispatcher.shutdown(timeout=1)
        finally:
            wasyncore.close_all(mapa, ignore_all=True)

    try:
        dispatcher.set_thread_count(8)
        servidor = create_server(
            modulo.app, host=anfitrion, port=puerto, map=mapa,
            _dispatcher=dispatcher, threads=8, channel_timeout=60, ident="AmPu",
            asyncore_loop_timeout=0.2,
            max_request_body_size=modulo.app.config["MAX_CONTENT_LENGTH"],
        )
        return servidor, cerrar
    except BaseException:
        cerrar()
        raise


class MotorLocal:
    """Importa y supervisa el servidor en segundo plano; la UI consume eventos.

    No toca widgets desde los trabajadores. Detener cancela también un arranque
    en curso; todos los hilos son daemon como última garantía al salir del .exe.
    """

    def __init__(self, anfitrion="127.0.0.1", puerto=5000):
        if not 1 <= puerto <= 65535:
            raise ValueError("El puerto debe ser un entero entre 1 y 65535.")
        self.anfitrion, self.puerto = anfitrion, puerto
        self.url = url_local(anfitrion, puerto)
        self.version = ""
        self.eventos: SimpleQueue[Evento] = SimpleQueue()
        self.disponible = threading.Event()
        self.terminado = threading.Event()
        self._detener = threading.Event()
        self._hilo = None

    def iniciar(self):
        if self._hilo is not None or self._detener.is_set():
            return
        self._hilo = threading.Thread(target=self._arrancar, name="AmPu-arranque", daemon=True)
        self._hilo.start()

    def detener(self):
        self.disponible.clear()
        self._detener.set()
        if self._hilo is None:
            self.terminado.set()

    def _arrancar(self):
        cerrar = None
        hilo = None
        error = None
        try:
            self.eventos.put(Evento("iniciando", "Cargando el motor estadístico…"))
            modulo = importlib.import_module("app")
            self.version = modulo.VERSION_APP
            if self._detener.is_set():
                return
            # Si el puerto está ocupado, esta llamada falla ANTES de consultar
            # salud: nunca se confunde otra instancia con nuestro propio motor.
            servidor, cerrar = crear_servidor(modulo, self.anfitrion, self.puerto)
            if self._detener.is_set():
                return
            errores_servidor = []

            def servir():
                try:
                    servidor.run()
                except (Exception, SystemExit) as fallo:
                    errores_servidor.append(fallo)
                    if not self._detener.is_set():
                        log.exception("El servidor local dejó de funcionar.")

            hilo = threading.Thread(target=servir, name="AmPu-servidor", daemon=True)
            hilo.start()
            if not esperar_servidor(self.url, self.version, hilo, self._detener):
                if not self._detener.is_set():
                    raise RuntimeError("El servidor no respondió a la comprobación de salud.")
                return
            if self._detener.is_set():
                return
            self.disponible.set()
            self.eventos.put(Evento("listo", "El motor está listo para trabajar.", self.version))
            log.info("AmPu %s disponible en %s", self.version, self.url)
            while not self._detener.wait(0.25):
                if not hilo.is_alive():
                    raise RuntimeError("El servidor se ha detenido inesperadamente.") from (errores_servidor[0] if errores_servidor else None)
        except (Exception, SystemExit) as fallo:
            if not self._detener.is_set():
                log.exception("No se pudo mantener el motor de AmPu.")
                if isinstance(fallo, OSError) and (fallo.errno == errno.EADDRINUSE or getattr(fallo, "winerror", None) == 10048):
                    detalle = f"El puerto {self.puerto} ya está en uso. Cierra la otra instancia o cambia AMPU_PORT antes de volver a iniciar."
                elif isinstance(fallo, ImportError):
                    detalle = "Falta una dependencia de AmPu. Revisa la instalación y consulta el registro."
                else:
                    detalle = "El motor no pudo iniciarse o se ha detenido. Consulta el registro para ver el detalle."
                error = Evento("error", detalle, self.version)
        finally:
            self.disponible.clear()
            if cerrar is not None:
                try:
                    cerrar()
                except Exception:
                    log.exception("Error al liberar los recursos del motor.")
            if hilo is not None:
                hilo.join(timeout=1)
            self.eventos.put(error or Evento("detenido", "El motor se ha detenido."))
            self.terminado.set()
