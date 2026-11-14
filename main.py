"""Arranque de AmPu en escritorio.

Inicia el servidor local (Waitress; Flask como respaldo) y abre el navegador cuando la aplicación ya
responde. Se puede usar tanto desde el código fuente como desde el ejecutable
generado con ``build_exe.py``.

Variables de entorno:
    AMPU_HOST   interfaz de escucha (por defecto 127.0.0.1)
    PORT        puerto (por defecto 5000)
    AMPU_NO_BROWSER=1  no abre el navegador automáticamente
    AMPU_NO_TRAY=1     no muestra la bandeja de Windows (modo de consola)
    AMPU_HOSTS_PERMITIDOS  nombres de host extra aceptados (separados por comas; * = todos)
    AMPU_PERMITIR_IFRAME=1 permite incrustar AmPu en un marco (desactivado por defecto)
    AMPU_LIMITE_SEGUNDOS   plazo orientativo de cálculo por petición (por defecto 20)
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MEIPASS = Path(getattr(sys, "_MEIPASS", BASE_DIR))

# En el ejecutable, PyInstaller coloca el motor y las dependencias en _MEIPASS;
# en desarrollo viven junto a main.py. El orden importa: primero lo empaquetado.
for ruta in (MEIPASS / "vendor", MEIPASS / "engine", BASE_DIR / "vendor", BASE_DIR / "engine"):
    if ruta.exists() and str(ruta) not in sys.path:
        sys.path.insert(0, str(ruta))

import app as ampu_app  # noqa: E402
from escritorio import activar_consola, identificar_aplicacion, iniciar_bandeja  # noqa: E402


def _esperar_servidor(url: str, intentos: int = 60, servidor: threading.Thread | None = None) -> bool:
    for _ in range(intentos):
        if servidor is not None and not servidor.is_alive():
            return False
        try:
            with urllib.request.urlopen(f"{url}/api/salud", timeout=0.8) as respuesta:
                if respuesta.status == 200:
                    salud = json.load(respuesta)
                    if (isinstance(salud, dict) and salud.get("estado") == "ok"
                            and salud.get("version") == ampu_app.VERSION_APP
                            and (servidor is None or servidor.is_alive())):
                        return True
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            pass
        time.sleep(0.25)
    return False


def main() -> None:
    host = os.environ.get("AMPU_HOST", "127.0.0.1")
    puerto = int(os.environ.get("PORT", "5000"))
    url = f"http://{'127.0.0.1' if host in ('0.0.0.0', '::') else host}:{puerto}"

    identificar_aplicacion()
    detener = threading.Event()
    hilo = threading.Thread(
        target=lambda: ampu_app.servir(host, puerto),
        name="AmPu-servidor",
        daemon=True,
    )
    hilo.start()

    if not _esperar_servidor(url, servidor=hilo):
        activar_consola()
        raise SystemExit(f"No se pudo iniciar AmPu en {url}. Comprueba que el puerto no esté ocupado.")
    if os.environ.get("AMPU_NO_BROWSER") != "1":
        webbrowser.open(url)

    try:
        if iniciar_bandeja(url, hilo, detener, ampu_app.VERSION_APP):
            return
        activar_consola()
        print(f"AmPu {ampu_app.VERSION_APP} disponible en {url}")
        print("Modo de consola: Ctrl+C cierra AmPu. Cerrar la pestaña no detiene el motor.")
        while hilo.is_alive() and not detener.wait(0.5):
            pass
    except KeyboardInterrupt:
        print("\nCerrando AmPu…")
    finally:
        detener.set()


if __name__ == "__main__":
    main()
