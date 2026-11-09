"""Resultados listos para tablas y gráficos: la UI no hace estadística."""

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ampu.core.errores import ParametroInvalidoError
from ampu.core.validacion import validar_evento, validar_probabilidades

from .base import ScipyUnivariante
from .registro import obtener


@dataclass
class ResultadoDistribucion:
    """Carga numérica completa de una consulta de distribución."""

    tabla: pd.DataFrame
    x: np.ndarray
    y: np.ndarray
    acumulada: np.ndarray
    evento: float
    respuesta: dict
    marginal: bool
    discreta: bool


def _mostrar(valor: object) -> str | float:
    """Presenta momentos escalares o vectores sin perder precisión interna."""
    a = np.asarray(valor)
    if a.ndim:
        return ", ".join(f"{v:.6g}" for v in a.ravel())
    return float(a)


def _malla(modelo: ScipyUnivariante, params: dict, evento: float, puntos: int) -> np.ndarray:
    """Construye un dominio acotado mediante cuantiles incluso para colas infinitas."""
    izq, der = modelo.soporte(**params)
    lo, hi = modelo.ppf(0.001, **params), modelo.ppf(0.999, **params)
    if not np.isfinite(lo):
        lo = izq if np.isfinite(izq) else evento - 5
    if not np.isfinite(hi):
        hi = der if np.isfinite(der) else evento + 5
    if modelo.discreta:
        # Mostrar el soporte exacto cuando cabe, no eliminar colas pequeñas.
        if np.isfinite(izq) and np.isfinite(der) and der - izq < puntos:
            lo, hi = int(izq), int(der)
        else:
            lo, hi = int(np.ceil(lo)), int(np.floor(hi))
        if lo >= hi:
            lo, hi = int(lo), int(lo) + 2
        if hi - lo > puntos - 1:
            return np.unique(np.linspace(lo, hi, puntos).astype(int))
        return np.arange(lo, hi + 1, dtype=int)
    if lo >= hi:
        centro = modelo.media(**params)
        lo, hi = float(centro) - 1, float(centro) + 1
    lo = min(lo, evento) if abs(evento - lo) < (hi - lo) * 3 else lo
    hi = max(hi, evento) if abs(evento - hi) < (hi - lo) * 3 else hi
    return np.linspace(lo, hi, puntos)


def analizar(
    clave: str, parametros: dict, x: float | list[float], q: float = 0.5,
    seed: int | None = 42, puntos: int = 161,
) -> ResultadoDistribucion:
    """Devuelve tabla, curvas PMF/PDF/CDF y resultado puntual.

    Args:
        clave: Clave del registro de distribuciones.
        parametros: Metadatos validados por el propio modelo.
        x: Evento escalar o vector para distribuciones multivariadas.
        q: Probabilidad para el cuantil.
        seed: Semilla de la aproximación visual marginal multivariante.
        puntos: Resolución limitada del gráfico (41–401).

    Returns:
        Tabla con columnas del módulo original y datos para Matplotlib.
    """
    if not isinstance(puntos, int) or not 41 <= puntos <= 401:
        raise ParametroInvalidoError("La resolución debe estar entre 41 y 401.")
    modelo = obtener(clave)
    params = modelo.validar(**parametros)
    evento = validar_evento(x)
    q = validar_probabilidades(q)
    if np.ndim(q):
        raise ParametroInvalidoError("Escribe un único cuantil q.")
    marginal = modelo.dimensionalidad != "univariante"
    densidad = modelo.pmf if modelo.discreta else modelo.pdf
    respuesta = {
        "probabilidad_o_densidad": densidad(evento, **params),
        "acumulada": modelo.cdf(evento, **params),
        "cuantil": modelo.ppf(q, **params),
        "media": modelo.media(**params),
        "varianza": modelo.varianza(**params),
        "desviacion": modelo.desviacion(**params),
    }
    if marginal:
        # Una histogramación visual de la primera marginal no sustituye la PMF/PDF conjunta.
        muestra = modelo.rvs(5000, seed=seed, **params)[:, 0]
        if modelo.discreta:
            xs, counts = np.unique(muestra, return_counts=True)
            ys = counts / muestra.size
            cs = np.cumsum(ys)
        else:
            ys, bordes = np.histogram(muestra, bins=60, density=True)
            xs = (bordes[1:] + bordes[:-1]) / 2
            cs = np.cumsum(ys * np.diff(bordes))
        fila = {"x": _mostrar(evento), "P(X=x)" if modelo.discreta else "f(x)": _mostrar(respuesta["probabilidad_o_densidad"]),
                "CDF": _mostrar(respuesta["acumulada"]), "Media": _mostrar(respuesta["media"]),
                "Varianza": _mostrar(respuesta["varianza"]), "DE": _mostrar(respuesta["desviacion"])}
        for k, v in reversed(list(params.items())):
            fila = {k: _mostrar(v), **fila}
        return ResultadoDistribucion(pd.DataFrame([fila]), xs, ys, cs, float(np.asarray(evento)[0]), respuesta, True, modelo.discreta)

    if np.ndim(evento):
        raise ParametroInvalidoError("Introduce un único valor x para esta distribución.")
    if not np.isfinite(evento):
        raise ParametroInvalidoError("El valor dibujado x debe ser finito.")
    xs = _malla(modelo, params, float(evento), puntos)
    ys = np.asarray(densidad(xs, **params), dtype=float)
    cs = np.asarray(modelo.cdf(xs, **params), dtype=float)
    sf = np.asarray(modelo.cola_inclusiva(xs, **params))
    # Columnas equivalentes a las originales y adicionales de análisis moderno.
    columnas: dict[str, object] = {k: [_mostrar(v)] * len(xs) for k, v in params.items()}
    columnas = {"x": xs, **columnas, "P(X=x)" if modelo.discreta else "f(x)": ys,
                "P(X≤x)": cs, "P(X≥x)": sf,
                "Media": [respuesta["media"]] * len(xs), "Varianza": [respuesta["varianza"]] * len(xs),
                "Desviación": [respuesta["desviacion"]] * len(xs)}
    return ResultadoDistribucion(pd.DataFrame(columnas), xs, ys, cs, float(evento), respuesta, False, modelo.discreta)
