"""Muestreo aleatorio simple y tamaños para poblaciones finitas/infinita."""

import math
from collections.abc import Sequence

import numpy as np
from scipy.stats import norm

from ampu.core.errores import ParametroInvalidoError
from ampu.core.validacion import validar_nivel, validar_semilla, validar_tamano


def _tamano(varianza: float, error: float, confianza: float, N: int | None) -> int:
    """Aplica aproximación normal y corrección por población finita."""
    z = norm.ppf(1 - (1 - validar_nivel(confianza)) / 2)
    if not np.isfinite(varianza) or varianza <= 0 or not np.isfinite(error) or error <= 0:
        raise ParametroInvalidoError("La varianza y el error permitido deben ser positivos.")
    n0 = (z / error) ** 2 * varianza
    if N is not None:
        if isinstance(N, bool) or not isinstance(N, (int, np.integer)) or N < 1:
            raise ParametroInvalidoError("N debe ser un entero positivo.")
        n0 = N * n0 / (N - 1 + n0)
    if not np.isfinite(n0):
        raise ParametroInvalidoError("No se puede determinar el tamaño: revisa el error permitido.")
    return max(1, min(N, math.ceil(n0)) if N is not None else math.ceil(n0))


def tamano_proporcion(p: float, error: float, confianza: float = 0.95, N: int | None = None) -> int:
    """Tamaño mínimo para estimar una proporción con margen absoluto.

    ``N=None`` indica población grande. Se redondea siempre hacia arriba,
    no al entero más cercano; para p=0 o p=1 no hay información de varianza.
    """
    if isinstance(p, bool) or not isinstance(p, (int, float)) or not 0 < p < 1:
        raise ParametroInvalidoError("Para diseñar la muestra, p debe estar entre 0 y 1 (sin extremos).")
    return _tamano(p * (1 - p), error, confianza, N)


def tamano_media(sigma: float, error: float, confianza: float = 0.95, N: int | None = None) -> int:
    """Tamaño mínimo para la media suponiendo sigma poblacional conocido."""
    return _tamano(float(sigma)**2, error, confianza, N)


def tamano_diferencia_medias(sigma_1: float, sigma_2: float, error: float, confianza: float = 0.95) -> int:
    """Tamaño **por grupo** para error en diferencia de dos medias independientes."""
    if sigma_1 <= 0 or sigma_2 <= 0:
        raise ParametroInvalidoError("Las desviaciones deben ser positivas.")
    return _tamano(sigma_1**2 + sigma_2**2, error, confianza, None)


def tamano_diferencia_proporciones(p1: float, p2: float, error: float, confianza: float = 0.95) -> int:
    """Tamaño **por grupo** para dos proporciones independientes."""
    if any(isinstance(p, bool) or not 0 < p < 1 for p in (p1, p2)):
        raise ParametroInvalidoError("Las proporciones de diseño deben estar entre 0 y 1.")
    return _tamano(p1*(1-p1) + p2*(1-p2), error, confianza, None)


def muestra_aleatoria(poblacion: Sequence, n: int, seed: int | None = None, reemplazo: bool = False) -> np.ndarray:
    """Selecciona n unidades sin reemplazo salvo solicitud explícita.

    Args:
        poblacion: Secuencia de identificadores o valores.
        n: Número de unidades elegidas.
        seed: Semilla reproducible, sin modificar RNG global.
        reemplazo: Si es True permite repeticiones (modelo infinito).
    """
    universo = np.asarray(list(poblacion))
    n = validar_tamano(n)
    if universo.ndim != 1 or not len(universo):
        raise ParametroInvalidoError("La población debe contener al menos una unidad.")
    if not reemplazo and n > len(universo):
        raise ParametroInvalidoError("La muestra no puede superar la población sin reemplazo.")
    indices = np.random.default_rng(validar_semilla(seed)).choice(len(universo), size=n, replace=reemplazo)
    return universo[indices]
