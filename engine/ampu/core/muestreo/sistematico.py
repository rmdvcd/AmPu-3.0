"""Muestreo sistemático con inicio aleatorio y paso fraccionario."""

from collections.abc import Sequence

import numpy as np

from ampu.core.errores import ParametroInvalidoError
from ampu.core.validacion import validar_semilla, validar_tamano


def muestra_sistematica(poblacion: Sequence, n: int, seed: int | None = None) -> np.ndarray:
    """Selecciona n posiciones espaciadas por N/n tras un arranque uniforme.

    Se preserva el orden original; una población ordenada periódicamente
    puede producir una muestra sesgada (reordenar antes si corresponde).
    """
    valores = np.asarray(list(poblacion))
    n = validar_tamano(n)
    if valores.ndim != 1 or n > len(valores):
        raise ParametroInvalidoError("n no puede superar el número de unidades.")
    paso = len(valores) / n
    inicio = np.random.default_rng(validar_semilla(seed)).uniform(0, paso)
    indices = np.floor(inicio + np.arange(n) * paso).astype(int)
    return valores[indices]
