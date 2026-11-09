"""Selección aleatoria de grupos completos o en dos etapas."""

from collections.abc import Mapping, Sequence

import numpy as np

from ampu.core.errores import ParametroInvalidoError
from ampu.core.validacion import validar_semilla, validar_tamano


def muestra_conglomerados(
    grupos: Mapping[str, Sequence], n_grupos: int, seed: int | None = None,
    n_por_grupo: int | None = None,
) -> dict[str, np.ndarray]:
    """Selecciona grupos y, opcionalmente, unidades dentro de cada grupo.

    Args:
        grupos: Nombre del conglomerado → unidades de ese conglomerado.
        n_grupos: Cantidad de conglomerados sin reemplazo.
        seed: Semilla del sorteo de grupos y unidades.
        n_por_grupo: Si se omite, incluye todos los elementos de cada grupo.
    """
    n_grupos = validar_tamano(n_grupos)
    if not grupos or n_grupos > len(grupos) or any(not len(valores) for valores in grupos.values()):
        raise ParametroInvalidoError("Indica grupos no vacíos y un número válido de conglomerados.")
    if n_por_grupo is not None:
        n_por_grupo = validar_tamano(n_por_grupo)
    rng = np.random.default_rng(validar_semilla(seed))
    elegidos = rng.choice(list(grupos), size=n_grupos, replace=False)
    resultado: dict[str, np.ndarray] = {}
    for clave in elegidos:
        elementos = np.asarray(list(grupos[clave]))
        if elementos.ndim != 1 or (n_por_grupo is not None and n_por_grupo > len(elementos)):
            raise ParametroInvalidoError(f"No hay suficientes unidades en {clave}.")
        resultado[str(clave)] = elementos if n_por_grupo is None else elementos[rng.choice(len(elementos), size=n_por_grupo, replace=False)]
    return resultado
