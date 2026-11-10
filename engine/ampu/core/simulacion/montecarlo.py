"""Simulación reproducible e inferencia de modelos con ``scipy.stats.fit``."""

from dataclasses import dataclass
from typing import Callable

import numpy as np
from scipy import optimize, stats

from ampu.core.distribuciones.registro import obtener
from ampu.core.errores import CalculoNoConvergenteError, ParametroInvalidoError
from ampu.core.validacion import validar_muestra, validar_nivel, validar_semilla, validar_tamano


@dataclass(frozen=True)
class Estimacion:
    """Media Monte Carlo, error estándar estimado e intervalo normal."""

    valor: float
    error_estandar: float
    intervalo: tuple[float, float]
    n: int


@dataclass(frozen=True)
class Ajuste:
    """Parámetros estimados, log-verosimilitud y contraste exploratorio KS."""

    nombre: str
    parametros: dict[str, float]
    aic: float
    ks: float
    p_ks: float


def _estimar(valores: np.ndarray, confianza: float, escala: float = 1) -> Estimacion:
    """Resume observaciones Monte Carlo usando error de simulación."""
    n = len(valores)
    nivel = validar_nivel(confianza)
    media = float(np.mean(valores) * escala)
    se = float(np.std(valores, ddof=1) / np.sqrt(n) * abs(escala))
    margen = stats.norm.ppf((1+nivel)/2) * se
    return Estimacion(media, se, (media-margen, media+margen), n)


def integrar(
    funcion: Callable[[np.ndarray], np.ndarray], a: float, b: float,
    n: int = 10_000, seed: int | None = None, confianza: float = 0.95,
) -> Estimacion:
    """Integra f en [a,b] por promedio uniforme, con IC asintótico."""
    n = validar_tamano(n)
    if n < 2 or not np.isfinite(a) or not np.isfinite(b) or a >= b:
        raise ParametroInvalidoError("Se necesitan n≥2 y extremos finitos a<b.")
    x = np.random.default_rng(validar_semilla(seed)).uniform(a, b, size=n)
    try:
        y = np.asarray(funcion(x), dtype=float)
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("La función no admite los puntos del intervalo.") from exc
    if y.shape != x.shape or not np.all(np.isfinite(y)):
        raise CalculoNoConvergenteError("La función debe devolver un valor finito por cada punto.")
    return _estimar(y, confianza, b-a)


def puntos_pi(n: int, seed: int | None = None) -> tuple[np.ndarray, np.ndarray]:
    """Puntos y máscara interior de un cuarto de círculo, para visualización."""
    coordenadas = np.random.default_rng(validar_semilla(seed)).random((validar_tamano(n), 2))
    return coordenadas, np.sum(coordenadas**2, axis=1) <= 1


def simular_pi(n: int = 10_000, seed: int | None = None, confianza: float = 0.95) -> Estimacion:
    """Estima π mediante la fracción de puntos en un cuarto de círculo."""
    n = validar_tamano(n)
    if n < 2:
        raise ParametroInvalidoError("Se necesitan al menos dos puntos.")
    _, dentro = puntos_pi(n, seed)
    return _estimar(dentro.astype(float), confianza, 4)


def generar_muestra(clave: str, parametros: dict, size: int, seed: int | None = None) -> np.ndarray:
    """Genera muestras desde cualquier distribución registrada."""
    return obtener(clave).rvs(size, seed=seed, **parametros)


_AJUSTABLES = {
    "normal": stats.norm,
    "exponencial": stats.expon,
    "gamma": stats.gamma,
    "weibull": stats.weibull_min,
    "lognormal": stats.lognorm,
    "beta": stats.beta,
}


def ajustar_distribucion(datos: object, clave: str, seed: int | None = 42) -> Ajuste:
    """Ajusta familias soportadas con ``scipy.stats.fit`` y límites explícitos.

    La p de KS es *exploratoria*: no ajusta la nulidad al hecho de haber
    estimado parámetros con los mismos datos (no usar para decisión formal).
    """
    x = validar_muestra(datos, minimo=5)
    if clave not in _AJUSTABLES:
        raise ParametroInvalidoError(f"Ajuste no disponible para {clave}.")
    dist = _AJUSTABLES[clave]
    amplitud = max(float(np.ptp(x)), float(np.std(x)), 1e-4)
    minimo, maximo = float(x.min()), float(x.max())
    if clave in ("exponencial", "gamma", "weibull", "lognormal") and minimo <= 0:
        raise ParametroInvalidoError("Los datos deben ser estrictamente positivos para esta familia.")
    if clave == "beta" and not np.all((x > 0) & (x < 1)):
        raise ParametroInvalidoError("La beta requiere observaciones estrictamente entre 0 y 1.")
    if clave == "normal":
        bounds = {"loc": (minimo-amplitud, maximo+amplitud), "scale": (1e-5, amplitud*4)}
    elif clave == "exponencial":
        bounds = {"loc": (0, 0), "scale": (1e-5, maximo*3)}
    else:
        shape = {"gamma": "a", "weibull": "c", "lognormal": "s", "beta": "a"}[clave]
        bounds = {shape: (0.05, 30), "loc": (0, 0), "scale": (1, 1) if clave == "beta" else (1e-5, maximo*4)}
        if clave == "beta":
            bounds["b"] = (0.05, 30)
    semilla = validar_semilla(seed)

    def optimizador(fun, bounds, x0=None, integrality=None):
        """Optimización de ajuste estocástica, controlada por semilla."""
        return optimize.differential_evolution(fun, bounds, x0=x0, integrality=integrality,
                                                seed=semilla, maxiter=150, popsize=8, tol=1e-8)

    try:
        ajuste = stats.fit(dist, x, bounds=bounds, optimizer=optimizador)
        if not ajuste.success:
            raise CalculoNoConvergenteError(f"El ajuste no converge: {ajuste.message}")
        params = ajuste.params._asdict()
        congelada = dist(*ajuste.params)
        ks = stats.kstest(x, congelada.cdf)
    except (ValueError, FloatingPointError) as exc:
        raise CalculoNoConvergenteError(f"No se pudo ajustar {clave}: {exc}") from exc
    libres = sum(b != a for a, b in bounds.values())
    return Ajuste(clave, {k: float(v) for k, v in params.items()}, float(2*libres + 2*ajuste.nllf()),
                  float(ks.statistic), float(ks.pvalue))


def qq_plot(datos: object, clave: str, parametros: dict) -> tuple[np.ndarray, np.ndarray]:
    """Pares (cuantiles teóricos, observaciones ordenadas) para un QQ-plot."""
    x = np.sort(validar_muestra(datos))
    modelo = obtener(clave)
    if modelo.dimensionalidad != "univariante":
        raise ParametroInvalidoError("QQ-plot disponible solo para modelos univariantes.")
    probabilidades = (np.arange(1, len(x)+1) - 0.5) / len(x)
    cuantiles = np.asarray(modelo.ppf(probabilidades, **parametros))
    if not np.all(np.isfinite(cuantiles)):
        raise CalculoNoConvergenteError("Los cuantiles teóricos no son finitos.")
    return cuantiles, x


def curva_ajustada(ajuste: Ajuste, datos: object) -> tuple[np.ndarray, np.ndarray]:
    """Retorna PDF del ajuste sobre un dominio de cuantiles apto para gráfico."""
    x = validar_muestra(datos)
    if ajuste.nombre not in _AJUSTABLES:
        raise ParametroInvalidoError("El modelo ajustado no se encuentra en el catálogo.")
    congelada = _AJUSTABLES[ajuste.nombre](**ajuste.parametros)
    lo = min(float(x.min()), float(congelada.ppf(.005)))
    hi = max(float(x.max()), float(congelada.ppf(.995)))
    grid = np.linspace(lo, hi, 220)
    return grid, np.asarray(congelada.pdf(grid))


def familias_ajustables() -> tuple[str, ...]:
    """Lista pública de distribuciones soportadas por el ajuste bounded fit."""
    return tuple(_AJUSTABLES)


def integral_cuadrado(n: int, seed: int | None = None) -> tuple[Estimacion, float]:
    """Ejemplo didáctico reproducible: integral de x² en [0,1] y referencia exacta."""
    return integrar(lambda x: x**2, 0, 1, n=n, seed=seed), 1/3
