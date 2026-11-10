"""Arranque de AmPu en escritorio.

Inicia el servidor local (Waitress; Flask como respaldo) y abre el navegador cuando la aplicación ya
responde. Se puede usar tanto desde el código fuente como desde el ejecutable
generado con ``build_exe.py``.

Variables de entorno:
    AMPU_HOST   interfaz de escucha (por defecto 127.0.0.1)
    PORT        puerto (por defecto 5000)
    AMPU_NO_BROWSER=1  no abre el navegador automáticamente
    AMPU_HOSTS_PERMITIDOS  nombres de host extra aceptados (separados por comas; * = todos)
    AMPU_PERMITIR_IFRAME=1 permite incrustar AmPu en un marco (desactivado por defecto)
    AMPU_LIMITE_SEGUNDOS   plazo orientativo de cálculo por petición (por defecto 20)
"""

from __future__ import annotations

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


def _esperar_servidor(url: str, intentos: int = 60) -> bool:
    for _ in range(intentos):
        try:
            with urllib.request.urlopen(f"{url}/api/salud", timeout=0.8) as respuesta:
                if respuesta.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.25)
    return False


def main() -> None:
    host = os.environ.get("AMPU_HOST", "127.0.0.1")
    puerto = int(os.environ.get("PORT", "5000"))
    url = f"http://{'127.0.0.1' if host in ('0.0.0.0', '::') else host}:{puerto}"

    hilo = threading.Thread(
        target=lambda: ampu_app.servir(host, puerto),
        daemon=True,
    )
    hilo.start()

    if os.environ.get("AMPU_NO_BROWSER") != "1" and _esperar_servidor(url):
        webbrowser.open(url)

    print(f"AmPu {ampu_app.VERSION_APP} disponible en {url}")
    print("Pulsa Ctrl+C para cerrar.")
    try:
        while hilo.is_alive():
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nCerrando AmPu…")


if __name__ == "__main__":
    main()
