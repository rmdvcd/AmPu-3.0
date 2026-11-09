"""Script de arranque para el .exe portable AmPu 3.0.

Este script se ejecuta cuando el usuario abre el .exe.
Inicia el servidor Flask y abre el navegador.
"""

import sys
import os
import subprocess
import time
import webbrowser
import threading
from pathlib import Path

# Configurar PYTHONPATH para incluir el motor AmPu 3.0 y las dependencias vendidas
if hasattr(sys, "_MEIPASS"):
    # Modo .exe
    vendor_path = os.path.join(sys._MEIPASS, "vendor")
    ampu_src = os.path.join(sys._MEIPASS, "engine")
else:
    # Modo desarrollo
    base_dir = Path(__file__).parent
    vendor_path = str(base_dir / "vendor")
    ampu_src = str(base_dir / "engine")
    # También añadir la ruta original del repositorio AmPu 3.0 para pruebas
    sys.path.insert(0, str(base_dir.parent / "AmPu 3.0" / "src"))

sys.path.insert(0, vendor_path)
sys.path.insert(0, ampu_src)

# Importar Flask y la app
import app as ampu_app

def iniciar_servidor():
    """Inicia el servidor Flask en un hilo separado."""
    port = 5000
    ampu_app.app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)

def abrir_navegador(port):
    """Abre el navegador en la URL del servidor."""
    time.sleep(2)  # Esperar a que el servidor inicie
    url = f"http://127.0.0.1:{port}"
    webbrowser.open(url)

if __name__ == "__main__":
    port = 5000
    server_thread = threading.Thread(target=iniciar_servidor, daemon=True)
    server_thread.start()
    abrir_navegador(port)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Cerrando AmPu 3.0 Portable...")
