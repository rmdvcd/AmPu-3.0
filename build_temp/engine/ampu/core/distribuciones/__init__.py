"""Distribuciones de SciPy disponibles a través de un contrato homogéneo."""

from .base import Distribucion
from .registro import DISTRIBUCIONES, catalogo, obtener

__all__ = ["Distribucion", "DISTRIBUCIONES", "catalogo", "obtener"]
