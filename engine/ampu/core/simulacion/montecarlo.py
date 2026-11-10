"""Simulación reproducible e inferencia de modelos con ``scipy.stats.fit``."""

from dataclasses import dataclass
from typing import Callable

import numpy as np
from scipy import stats

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
        raise ParametroInvalidoError("Se necesitan al menos 2 puntos y extremos finitos con a < b.")
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


def ajustar_distribucion(datos: object, clave: str, seed: int | None = None) -> Ajuste:
    """Ajusta una familia por máxima verosimilitud, de forma **determinista**.

    Normal, exponencial y lognormal tienen estimador cerrado; gamma, Weibull y
    beta usan el optimizador local de SciPy desde el arranque por momentos.
    El resultado depende solo de los datos: ``seed`` se conserva por
    compatibilidad y no interviene (antes un optimizador estocástico hacía que
    los parámetros cambiasen con la semilla).

    La p de KS es *exploratoria*: no corrige el hecho de haber estimado los
    parámetros con los mismos datos (no usar para una decisión formal).
    """
    del seed
    x = validar_muestra(datos, minimo=5)
    if clave not in _AJUSTABLES:
        raise ParametroInvalidoError(
            f"El ajuste no está disponible para «{clave}».", campo="clave",
            sugerencia="Familias admitidas: " + ", ".join(_AJUSTABLES) + ".")
    dist = _AJUSTABLES[clave]
    if float(np.ptp(x)) <= 1e-12 * max(1.0, float(np.max(np.abs(x)))):
        raise CalculoNoConvergenteError(
            "Todos los datos son iguales: no hay variación que ajustar.", campo="datos")
    if clave in ("exponencial", "gamma", "weibull", "lognormal") and float(x.min()) <= 0:
        raise ParametroInvalidoError(
            "Esta familia solo admite datos estrictamente positivos.", campo="datos",
            sugerencia="Elimina los ceros y negativos o elige la distribución normal.")
    if clave == "beta" and not np.all((x > 0) & (x < 1)):
        raise ParametroInvalidoError(
            "La distribución beta requiere datos estrictamente entre 0 y 1.", campo="datos")
    try:
        with np.errstate(all="ignore"):
            if clave == "normal":
                params = {"loc": float(np.mean(x)), "scale": float(np.std(x))}
            elif clave == "exponencial":
                params = {"loc": 0.0, "scale": float(np.mean(x))}
            elif clave == "lognormal":
                logx = np.log(x)
                params = {"s": float(np.std(logx)), "loc": 0.0, "scale": float(np.exp(np.mean(logx)))}
            elif clave == "beta":
                a_, b_, loc, scale = dist.fit(x, floc=0, fscale=1)
                params = {"a": float(a_), "b": float(b_), "loc": 0.0, "scale": 1.0}
            else:
                forma, loc, scale = dist.fit(x, floc=0)
                params = {{"gamma": "a", "weibull": "c"}[clave]: float(forma), "loc": 0.0, "scale": float(scale)}
        congelada = dist(**params)
        logv = float(np.sum(congelada.logpdf(x)))
        ks = stats.kstest(x, congelada.cdf)
    except (ValueError, FloatingPointError, RuntimeError) as exc:
        raise CalculoNoConvergenteError(
            f"No se pudo ajustar la distribución {clave} a estos datos.", campo="datos",
            sugerencia="Prueba con otra familia o revisa valores extremos.") from exc
    if not np.isfinite(logv) or not all(np.isfinite(v) for v in params.values()):
        raise CalculoNoConvergenteError(
            f"El ajuste de la distribución {clave} no converge con estos datos.", campo="datos")
    libres = {"normal": 2, "exponencial": 1, "gamma": 2, "weibull": 2, "lognormal": 2, "beta": 2}[clave]
    return Ajuste(clave, params, float(2*libres - 2*logv), float(ks.statistic), float(ks.pvalue))


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


@dataclass(frozen=True)
class Integrando:
    """Función integrable del catálogo didáctico, con su primitiva exacta."""

    clave: str
    etiqueta: str
    funcion: Callable[[np.ndarray], np.ndarray]
    primitiva: Callable[[float], float]
    intervalo: tuple[float, float]
    dominio: tuple[float, float]
    expresion_exacta: str

    def exacta(self, a: float, b: float) -> float:
        """Valor exacto de la integral en **el intervalo pedido**, F(b) − F(a)."""
        return float(self.primitiva(b) - self.primitiva(a))


INTEGRANDOS: dict[str, Integrando] = {
    "cuadrado": Integrando("cuadrado", "x²", lambda x: x**2, lambda x: x**3 / 3,
                           (0.0, 1.0), (-1e6, 1e6), "(b³ − a³)/3"),
    "seno": Integrando("seno", "sen(x)", np.sin, lambda x: -np.cos(x),
                       (0.0, float(np.pi)), (-1e6, 1e6), "cos(a) − cos(b)"),
    "exponencial": Integrando("exponencial", "eˣ", np.exp, np.exp,
                              (0.0, 1.0), (-700.0, 700.0), "e^b − e^a"),
    "circulo": Integrando("circulo", "√(1−x²)", lambda x: np.sqrt(np.clip(1 - x**2, 0, None)),
                          lambda x: (x * np.sqrt(max(0.0, 1 - x*x)) + np.arcsin(x)) / 2,
                          (0.0, 1.0), (-1.0, 1.0), "[x·√(1−x²) + arcsen(x)]/2 entre a y b"),
}


def integrando(clave: str, a: float | None = None, b: float | None = None) -> tuple[Integrando, float, float]:
    """Devuelve el integrando y el intervalo efectivo, validado contra su dominio."""
    if clave not in INTEGRANDOS:
        raise ParametroInvalidoError(
            "Función no disponible.", campo="funcion",
            sugerencia="Elige x², sen(x), eˣ o √(1−x²).")
    f = INTEGRANDOS[clave]
    a = f.intervalo[0] if a is None else float(a)
    b = f.intervalo[1] if b is None else float(b)
    if not np.isfinite(a) or not np.isfinite(b) or not a < b:
        raise ParametroInvalidoError("El extremo inferior a debe ser menor que b.", campo="a")
    for valor, campo in ((a, "a"), (b, "b")):
        if not f.dominio[0] <= valor <= f.dominio[1]:
            raise ParametroInvalidoError(
                f"{f.etiqueta} solo se integra entre {f.dominio[0]:g} y {f.dominio[1]:g}.", campo=campo)
    return f, a, b


def integral_cuadrado(n: int, seed: int | None = None) -> tuple[Estimacion, float]:
    """Ejemplo didáctico reproducible: integral de x² en [0,1] y referencia exacta."""
    return integrar(lambda x: x**2, 0, 1, n=n, seed=seed), 1/3
