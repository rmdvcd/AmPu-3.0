"""Diseños de selección y tamaños muestrales con RNG reproducible."""

from .aleatorio import muestra_aleatoria, tamano_media, tamano_proporcion, tamano_diferencia_medias, tamano_diferencia_proporciones
from .conglomerados import muestra_conglomerados
from .estratificado import asignacion_estratos, muestra_estratificada
from .sistematico import muestra_sistematica

__all__ = ["muestra_aleatoria", "tamano_media", "tamano_proporcion", "tamano_diferencia_medias", "tamano_diferencia_proporciones", "muestra_conglomerados", "asignacion_estratos", "muestra_estratificada", "muestra_sistematica"]
