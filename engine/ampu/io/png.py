"""Gráficos Matplotlib a PNG de resolución suficiente para imprimir."""

from pathlib import Path

from matplotlib.figure import Figure


def exportar_png(figura: Figure, destino: str | Path) -> Path:
    """Guarda una figura, preservando su estado interactivo."""
    if not isinstance(figura, Figure):
        raise TypeError("Se necesita una Figure de Matplotlib.")
    ruta = Path(destino).with_suffix(".png")
    figura.savefig(ruta, dpi=180, bbox_inches="tight")
    return ruta
