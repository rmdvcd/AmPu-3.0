"""Empaqueta AmPu 3.1 como aplicación de escritorio con PyInstaller.

Uso:
    PYTHONPATH=vendor python3 build_exe.py

En Windows genera ``dist/ampu_portable_3_0.exe``. En Linux/macOS genera un
ejecutable sin extensión. El script no simula resultados: si PyInstaller falla,
el proceso termina con un mensaje de error y el código de salida correspondiente.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

APP_NAME = "ampu_portable_3_0"
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
ENGINE_DIR = BASE_DIR / "engine"
VENDOR_DIR = BASE_DIR / "vendor"
BUILD_DIR = BASE_DIR / "build_temp"
OUTPUT_DIR = BASE_DIR / "dist"


def preparar_entorno() -> Path:
    if not ENGINE_DIR.exists():
        raise SystemExit("No se encontró engine/. Ejecuta el script desde la raíz del proyecto.")
    if not (FRONTEND_DIR / "index.html").exists():
        raise SystemExit("No se encontró frontend/index.html.")

    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True)

    shutil.copytree(FRONTEND_DIR, BUILD_DIR / "frontend")
    shutil.copytree(ENGINE_DIR, BUILD_DIR / "engine", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    shutil.copy2(BASE_DIR / "app.py", BUILD_DIR / "app.py")
    shutil.copy2(BASE_DIR / "main.py", BUILD_DIR / "main.py")
    if (BASE_DIR / "requirements.txt").exists():
        shutil.copy2(BASE_DIR / "requirements.txt", BUILD_DIR / "requirements.txt")
    return BUILD_DIR


def construir(build_dir: Path) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    destino = OUTPUT_DIR / (f"{APP_NAME}.exe" if os.name == "nt" else APP_NAME)
    if destino.exists():
        destino.unlink()

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name",
        APP_NAME,
        "--paths",
        str(build_dir / "engine"),
        "--paths",
        str(VENDOR_DIR),
        "--add-data",
        f"{build_dir / 'frontend'}{os.pathsep}frontend",
        "--add-data",
        f"{build_dir / 'engine'}{os.pathsep}engine",
        "--collect-all",
        "ampu",
        "--hidden-import",
        "numpy",
        "--hidden-import",
        "scipy",
        "--hidden-import",
        "pandas",
        "--hidden-import",
        "matplotlib",
        "--hidden-import",
        "openpyxl",
        "--hidden-import",
        "reportlab",
        "--hidden-import",
        "flask",
        "--hidden-import",
        "werkzeug",
        "--hidden-import",
        "markdown",
        "--hidden-import",
        "waitress",
        "--hidden-import",
        "mpmath",
        str(build_dir / "main.py"),
    ]
    if os.name == "nt":
        cmd.insert(4, "--windowed")

    entorno = dict(os.environ)
    entorno["PYTHONPATH"] = os.pathsep.join([str(VENDOR_DIR), str(build_dir / "engine"), entorno.get("PYTHONPATH", "")])

    print("Ejecutando:\n  " + " ".join(cmd))
    resultado = subprocess.run(cmd, cwd=build_dir, env=entorno)
    if resultado.returncode != 0:
        raise SystemExit(f"PyInstaller terminó con código {resultado.returncode}.")

    generado = build_dir / "dist" / destino.name
    if not generado.exists():
        raise SystemExit(f"PyInstaller no generó {generado}.")
    shutil.copy2(generado, destino)
    print(f"\nListo: {destino} ({destino.stat().st_size / 1024 / 1024:.1f} MB)")
    print("Distribuye el ejecutable junto con nada más: es un archivo único.")
    return destino


def main() -> None:
    if not (VENDOR_DIR / "PyInstaller").exists():
        raise SystemExit("PyInstaller no está en vendor/. Instala las dependencias con: pip install --target vendor -r requirements-build.txt")
    construir(preparar_entorno())


if __name__ == "__main__":
    main()
