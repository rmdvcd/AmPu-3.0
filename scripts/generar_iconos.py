"""Genera la identidad de AmPu y sus derivados, sin fuentes ni red.

    PYTHONPATH=vendor python3 scripts/generar_iconos.py

Una sola curva de probabilidad sobre fondo verde. La geometría es la misma
para SVG, PNG e ICO; los tamaños pequeños se rasterizan por separado para no
perder nitidez. Pillow ya forma parte de las dependencias de Matplotlib.
"""

from __future__ import annotations

from math import hypot
from pathlib import Path

from PIL import Image, ImageDraw

BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "frontend" / "static"
TAMANOS_ICO = (16, 20, 24, 32, 40, 48, 64, 128, 256)
FONDO = "#0b4a42"
TINTA = "#ffffff"
CURVA = ((12, 45), (24, 45), (22, 18), (32, 18), (42, 18), (40, 45), (52, 45))
SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <title>AmPu</title>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="#0b4a42"/>
  <path d="M12 45C24 45 22 18 32 18S40 45 52 45M12 45H52" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'''


def rasterizar(lado: int) -> Image.Image:
    """Rasteriza el símbolo a la resolución solicitada con antialiasing 4×."""
    escala = lado * 4 / 64
    lienzo = Image.new("RGBA", (lado * 4, lado * 4))
    dibujo = ImageDraw.Draw(lienzo)
    dibujo.rounded_rectangle(tuple(round(v * escala) for v in (2, 2, 62, 62)), radius=14 * escala, fill=FONDO)

    def bezier(puntos):
        for paso in range(97):
            t = paso / 96
            u = 1 - t
            punto = tuple(escala * (u**3 * puntos[0][i] + 3*u*u*t * puntos[1][i] +
                                   3*u*t*t * puntos[2][i] + t**3 * puntos[3][i]) for i in (0, 1))
            dx, dy = (3*u*u*(puntos[1][i]-puntos[0][i]) + 6*u*t*(puntos[2][i]-puntos[1][i]) +
                      3*t*t*(puntos[3][i]-puntos[2][i]) for i in (0, 1))
            normal = (-dy / hypot(dx, dy), dx / hypot(dx, dy))
            yield punto, normal

    radio = 2.5 * escala
    puntos = list(bezier(CURVA[:4])) + list(bezier(CURVA[3:]))[1:]
    borde = [(p[0]+radio*n[0], p[1]+radio*n[1]) for p, n in puntos]
    borde += [(p[0]-radio*n[0], p[1]-radio*n[1]) for p, n in reversed(puntos)]
    dibujo.polygon(borde, fill=TINTA)
    dibujo.rectangle((12*escala, 45*escala-radio, 52*escala, 45*escala+radio), fill=TINTA)
    for x, y in ((12, 45), (52, 45)):
        x, y = x * escala, y * escala
        dibujo.ellipse((x-radio, y-radio, x+radio, y+radio), fill=TINTA)
    return lienzo.resize((lado, lado), Image.Resampling.LANCZOS)


def generar(destino: Path = STATIC_DIR) -> None:
    destino.mkdir(parents=True, exist_ok=True)
    (destino / "img").mkdir(exist_ok=True)
    (destino / "favicon.svg").write_text(SVG, encoding="utf-8")
    (destino / "img" / "icono_ampu.svg").write_text(SVG, encoding="utf-8")
    rasterizar(256).save(destino / "img" / "icono_ampu.png", optimize=True)
    imagenes = [rasterizar(n) for n in TAMANOS_ICO]
    imagenes[-1].save(destino / "favicon.ico", sizes=[(n, n) for n in TAMANOS_ICO], append_images=imagenes[:-1])


if __name__ == "__main__":
    generar()
    # Las páginas de teoría independientes también funcionan sin conexión.
    (BASE_DIR / "engine" / "ampu" / "docs" / "render" / "icono_ampu.svg").write_text(SVG, encoding="utf-8")
