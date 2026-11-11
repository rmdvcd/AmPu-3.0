"""Genera los favicons a partir del PNG original de AmPu 2.0, sin redibujarlo.

    PYTHONPATH=vendor python3 scripts/generar_iconos.py

Pillow ya es dependencia transitiva de Matplotlib. No descarga recursos.
"""

from __future__ import annotations

import base64
from pathlib import Path

from PIL import Image

BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "frontend" / "static"
ORIGINAL = STATIC_DIR / "img" / "icono_ampu.png"
TAMANOS_ICO = (16, 24, 32, 48, 64, 128, 256)


def generar(destino: Path = STATIC_DIR) -> None:
    destino.mkdir(parents=True, exist_ok=True)
    datos = ORIGINAL.read_bytes()
    with Image.open(ORIGINAL) as imagen:
        imagen = imagen.convert("RGBA")
        ancho, alto = imagen.size
        lado = max(ancho, alto)
        lienzo = Image.new("RGBA", (lado, lado))
        lienzo.paste(imagen, ((lado - ancho) // 2, (lado - alto) // 2))
        lienzo.save(destino / "favicon.ico", sizes=[(n, n) for n in TAMANOS_ICO])

    # Un SVG autocontenido funciona también como favicon: las referencias a
    # archivos externos suelen estar bloqueadas en ese contexto del navegador.
    png = base64.b64encode(datos).decode("ascii")
    (destino / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n'
        '  <title>AmPu</title>\n'
        '  <image width="1024" height="1024" preserveAspectRatio="xMidYMid meet" '
        f'href="data:image/png;base64,{png}"/>\n'
        '</svg>\n',
        encoding="utf-8",
    )


if __name__ == "__main__":
    generar()
