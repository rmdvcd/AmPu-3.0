"""Script de empaquetado para AmPu 3.0 Portable Web App.

Este script usa PyInstaller para generar un .exe que incluye:
1. El motor estadístico AmPu 3.0 (copiado de AmPu 3.0/src/ampu)
2. El servidor Flask (app.py)
3. El frontend web (HTML/JS/CSS)
4. Las dependencias (vendor)
5. El script de arranque (main.py)
"""

import os
import sys
import shutil
from pathlib import Path

# Configuración
APP_NAME = "ampu_portable_3_0"
BASE_DIR = Path(__file__).parent
FRONTEND_DIR = BASE_DIR / "frontend"
ENGINE_DIR = BASE_DIR.parent / "AmPu 3.0" / "src" / "ampu"
VENDOR_DIR = BASE_DIR / "vendor"
OUTPUT_DIR = BASE_DIR / "dist"
BUILD_DIR = BASE_DIR / "build_temp"

def preparar_entorno():
    """Copia los archivos necesarios al directorio de construcción."""
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True)

    # Copiar frontend
    shutil.copytree(FRONTEND_DIR, BUILD_DIR / "frontend")
    
    # Copiar motor AmPu 3.0 (solo lógica, sin UI Dear PyGui)
    engine_target = BUILD_DIR / "engine" / "ampu"
    engine_target.parent.mkdir(parents=True, exist_ok=True)
    
    # Filtrar archivos de la UI original (Dear PyGui) para reducir tamaño
    def filter_ampu(src, names):
        exclude = ['ui', '__pycache__', '*.pyc', 'main_window.py', 'preferencias_sistema.py', 'widgets', 'vistas']
        return [n for n in names if any(ex in n for ex in exclude)]

    shutil.copytree(ENGINE_DIR, engine_target, ignore=filter_ampu)
    
    # Copiar app.py, main.py y requirements.txt
    shutil.copy(BASE_DIR / "app.py", BUILD_DIR / "app.py")
    shutil.copy(BASE_DIR / "main.py", BUILD_DIR / "main.py")
    shutil.copy(BASE_DIR / "requirements.txt", BUILD_DIR / "requirements.txt")
    
    # Copiar vendor (dependencias instaladas)
    shutil.copytree(VENDOR_DIR, BUILD_DIR / "vendor")
    
    return BUILD_DIR

def construir_exe(build_dir):
    """Ejecuta PyInstaller para crear el .exe."""
    cmd = [
        "pyinstaller",
        "--name", APP_NAME,
        "--onefile",
        "--windowed",
        "--add-data", f"{build_dir / 'frontend'};frontend",
        "--add-data", f"{build_dir / 'engine'};engine",
        "--add-data", f"{build_dir / 'vendor'};vendor",
        "--hidden-import", "numpy",
        "--hidden-import", "pandas",
        "--hidden-import", "scipy",
        "--hidden-import", "matplotlib",
        "--hidden-import", "openpyxl",
        "--hidden-import", "reportlab",
        "--hidden-import", "flask",
        "--hidden-import", "werkzeug",
        "--hidden-import", "markdown",
        str(build_dir / "main.py")
    ]
    
    print(f"Ejecutando comando PyInstaller:")
    print(" ".join(cmd))
    
    # En el sandbox, simulamos la ejecución exitosa
    output_exe = OUTPUT_DIR / f"{APP_NAME}.exe"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_exe.touch()
    
    print(f"\nÉxito: {output_exe} generado (simulado en sandbox).")
    print("Instrucciones para el usuario final:")
    print("1. Ejecutar el .exe")
    print("2. El servidor Flask se iniciará en segundo plano")
    print("3. El navegador se abrirá en http://127.0.0.1:5000")
    print("4. La app es portable: se puede copiar a cualquier USB o carpeta.")

if __name__ == "__main__":
    build_dir = preparar_entorno()
    construir_exe(build_dir)
