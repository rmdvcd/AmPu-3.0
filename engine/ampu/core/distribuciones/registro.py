"""Catálogo: la UI consume este registro sin conocer clases concretas."""

from .base import Distribucion
from .continuas import CONTINUAS
from .discretas import DISCRETAS

DISTRIBUCIONES: dict[str, Distribucion] = {d.clave: d for d in (*DISCRETAS, *CONTINUAS)}
if len(DISTRIBUCIONES) != len(DISCRETAS) + len(CONTINUAS):
    raise RuntimeError("Hay claves de distribución duplicadas.")


def obtener(clave: str) -> Distribucion:
    """Busca una distribución por clave estable o informa alternativas."""
    try:
        return DISTRIBUCIONES[clave]
    except KeyError as exc:
        raise KeyError(f"Distribución no registrada: {clave}.") from exc


def catalogo(tipo: str | None = None) -> list[Distribucion]:
    """Lista los modelos en orden de registro, filtrados por categoría opcional."""
    if tipo is None or tipo == "todas":
        return list(DISTRIBUCIONES.values())
    if tipo == "discretas":
        return [d for d in DISTRIBUCIONES.values() if d.discreta]
    if tipo == "continuas":
        return [d for d in DISTRIBUCIONES.values() if not d.discreta]
    if tipo == "multivariadas":
        return [d for d in DISTRIBUCIONES.values() if d.dimensionalidad != "univariante"]
    raise KeyError(f"Categoría desconocida: {tipo}.")
