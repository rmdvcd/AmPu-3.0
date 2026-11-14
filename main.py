"""Arranque de escritorio de AmPu.

En Windows muestra un launcher nativo, minimizable a la bandeja, sin consola
propia. AmPu.pyw o el .exe --windowed son las entradas de doble clic. El motor
se importa en segundo plano después de crear la ventana.

Variables de entorno:
    AMPU_HOST   interfaz de escucha (por defecto 127.0.0.1)
    AMPU_PORT / PORT   puerto (por defecto 5000)
    AMPU_NO_BROWSER=1  no abre el navegador automáticamente
    AMPU_NO_TRAY=1     mantiene el launcher sin bandeja
    AMPU_NO_LAUNCHER=1 modo de consola explícito, para diagnóstico
    AMPU_HOSTS_PERMITIDOS  nombres de host extra aceptados (separados por comas; * = todos)
    AMPU_PERMITIR_IFRAME=1 permite incrustar AmPu en un marco
    AMPU_LIMITE_SEGUNDOS   plazo orientativo de cálculo por petición
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from queue import Empty
import sys
import webbrowser

BASE_DIR = Path(__file__).resolve().parent
MEIPASS = Path(getattr(sys, "_MEIPASS", BASE_DIR))
for ruta in (MEIPASS / "vendor", MEIPASS / "engine", BASE_DIR / "vendor", BASE_DIR / "engine"):
    if ruta.exists() and str(ruta) not in sys.path:
        sys.path.insert(0, str(ruta))

from arranque import MotorLocal  # noqa: E402
from escritorio import (  # noqa: E402
    activar_consola, configurar_registro, identificar_aplicacion,
    mostrar_error_nativo, ocultar_consola_propia,
)


def motor_configurado():
    try:
        puerto = int(os.environ.get("AMPU_PORT", os.environ.get("PORT", "5000")))
    except ValueError:
        raise ValueError("AMPU_PORT / PORT debe ser un entero entre 1 y 65535.") from None
    return MotorLocal(os.environ.get("AMPU_HOST", "127.0.0.1"), puerto)


def modo_consola(motor):
    """Diagnóstico optativo en Windows; comportamiento habitual sin GUI en Linux."""
    motor.iniciar()
    try:
        while True:
            try:
                evento = motor.eventos.get(timeout=0.25)
            except Empty:
                continue
            if evento.tipo == "listo":
                print(f"AmPu {evento.version} disponible en {motor.url}")
                print("Modo de diagnóstico: Ctrl+C cierra AmPu. Cerrar la pestaña no detiene el motor.")
                if os.environ.get("AMPU_NO_BROWSER") != "1":
                    try:
                        webbrowser.open(motor.url)
                    except Exception:
                        logging.getLogger("ampu.arranque").exception("Abre manualmente %s", motor.url)
            elif evento.tipo == "error":
                raise SystemExit(evento.detalle)
            elif evento.tipo == "detenido":
                return
    except KeyboardInterrupt:
        print("\nCerrando AmPu…")
    finally:
        motor.detener()
        motor.terminado.wait(timeout=3)


def main():
    if sys.platform == "win32" and os.environ.get("AMPU_NO_LAUNCHER") != "1":
        registro = configurar_registro()
        identificar_aplicacion()
        ocultar_consola_propia()
        motor = None
        try:
            from lanzador import ejecutar

            motor = motor_configurado()
            ejecutar(motor, registro)
        except (Exception, SystemExit):
            logging.getLogger("ampu.arranque").exception("No se pudo abrir el launcher.")
            ubicacion = f"\n\nRegistro: {registro}" if registro else ""
            mostrar_error_nativo("No se pudo abrir AmPu", "No se pudo crear el launcher. Comprueba la instalación de Python con Tcl/Tk y la configuración del puerto." + ubicacion)
            raise SystemExit(1) from None
        finally:
            if motor is not None:
                motor.detener()
        return

    if sys.platform == "win32":
        activar_consola()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    modo_consola(motor_configurado())


if __name__ == "__main__":
    main()
