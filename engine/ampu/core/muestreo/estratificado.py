"""Asignación proporcional, de Neyman y óptima con redondeo controlado."""

from collections.abc import Mapping, Sequence

import numpy as np

from ampu.core.errores import ParametroInvalidoError
from ampu.core.validacion import validar_semilla, validar_tamano


def asignacion_estratos(
    tamanos: Mapping[str, int], n: int, metodo: str = "proporcional",
    desviaciones: Mapping[str, float] | None = None,
    costos: Mapping[str, float] | None = None,
) -> dict[str, int]:
    """Asigna enteros cuya suma es n sin superar las capacidades de estrato.

    Args:
        tamanos: Nh por nombre de estrato.
        n: Tamaño total de muestra.
        metodo: ``proporcional``, ``neyman`` u ``optimo``.
        desviaciones: Sh por estrato (obligatorias para Neyman/óptimo).
        costos: Coste por unidad (obligatorios para óptimo).
    """
    n = validar_tamano(n)
    if not tamanos or any(isinstance(v, bool) or not isinstance(v, (int, np.integer)) or v < 1 for v in tamanos.values()):
        raise ParametroInvalidoError("Cada estrato debe tener un tamaño entero positivo.")
    claves = list(tamanos)
    capacidad = np.array([tamanos[k] for k in claves], dtype=int)
    if n > capacidad.sum():
        raise ParametroInvalidoError("La muestra no puede superar la población estratificada.")
    if metodo not in ("proporcional", "neyman", "optimo"):
        raise ParametroInvalidoError("La asignación debe ser proporcional, neyman u optimo.")
    pesos = capacidad.astype(float)
    if metodo != "proporcional":
        if desviaciones is None or set(desviaciones) != set(claves):
            raise ParametroInvalidoError("Faltan las desviaciones de los estratos.")
        sigma = np.array([desviaciones[k] for k in claves], dtype=float)
        if np.any(~np.isfinite(sigma)) or np.any(sigma < 0):
            raise ParametroInvalidoError("Las desviaciones no pueden ser negativas ni infinitas.")
        pesos *= sigma
    if metodo == "optimo":
        if costos is None or set(costos) != set(claves):
            raise ParametroInvalidoError("Faltan los costes de los estratos.")
        c = np.array([costos[k] for k in claves], dtype=float)
        if np.any(~np.isfinite(c)) or np.any(c <= 0):
            raise ParametroInvalidoError("Los costes deben ser estrictamente positivos.")
        pesos /= np.sqrt(c)
    if pesos.sum() <= 0:
        raise ParametroInvalidoError("Las desviaciones no pueden ser todas cero.")
    ideal = n * pesos / pesos.sum()
    cuotas = np.minimum(capacidad, np.floor(ideal).astype(int))
    while int(cuotas.sum()) < n:
        # Cuando un estrato está lleno, redistribuir el remanente a otros.
        candidatos = np.where(cuotas < capacidad, ideal - cuotas, -np.inf)
        cuotas[int(np.argmax(candidatos))] += 1
    return dict(zip(claves, cuotas.tolist()))


def muestra_estratificada(
    estratos: Mapping[str, Sequence], asignacion: Mapping[str, int], seed: int | None = None,
) -> dict[str, np.ndarray]:
    """Extrae de cada estrato sin reemplazo usando un solo RNG local."""
    if not estratos or set(estratos) != set(asignacion):
        raise ParametroInvalidoError("Cada estrato debe tener su tamaño asignado.")
    rng = np.random.default_rng(validar_semilla(seed))
    resultado: dict[str, np.ndarray] = {}
    for clave, elementos in estratos.items():
        valores = np.asarray(list(elementos))
        n = asignacion[clave]
        if valores.ndim != 1 or isinstance(n, bool) or not isinstance(n, (int, np.integer)) or not 0 <= n <= len(valores):
            raise ParametroInvalidoError(f"Asignación inválida en el estrato {clave}.")
        resultado[clave] = valores[rng.choice(len(valores), size=n, replace=False)]
    return resultado
