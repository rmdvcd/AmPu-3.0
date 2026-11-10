"""Distribuciones discretas parametrizadas mediante ``scipy.stats``."""

import numpy as np
from scipy import stats

from ampu.core.errores import ParametroInvalidoError, SoporteError
from ampu.core.validacion import (
    Parametro, exigir, validar_evento, validar_parametros,
    validar_probabilidades, validar_semilla, validar_tamano,
)

from .base import Distribucion, ScipyUnivariante, _salida


def _hipergeometrica(p: dict) -> None:
    """Verifica que éxitos y extracciones no superen la población."""
    exigir(p["K"] <= p["N"] and p["n"] <= p["N"], "K y n no pueden superar N.")


def _uniforme_discreta(p: dict) -> None:
    """Verifica extremos ordenados e inclusivos."""
    exigir(p["a"] <= p["b"], "El extremo a no puede superar b.")


class Multinomial(Distribucion):
    """Conteos en k categorías; CDF/PPF devuelven marginales binomiales.

    No se interpreta ``N!/x * p`` como en la implementación Java: la PMF
    requiere el *vector* de conteos x y su producto de factoriales.
    """

    clave = "multinomial"
    nombre = "Multinomial"
    discreta = True
    dimensionalidad = "multivariante"
    parametros = [
        Parametro("n", "entero", 0, None, "Número total de ensayos", 8),
        Parametro("p", "vector_real", 0, 1, "Probabilidades de las categorías (suman 1)", (0.2, 0.3, 0.5)),
    ]

    def validar(self, **params: object) -> dict:
        """Comprueba que las probabilidades sean exhaustivas."""
        v = validar_parametros(self.parametros, params)
        exigir(bool(np.isclose(sum(v["p"]), 1, rtol=0, atol=1e-12)), "Las probabilidades deben sumar 1.")
        return v

    def _eventos(self, x: object, k: int) -> np.ndarray:
        """Acepta un vector de conteos o una matriz de observaciones."""
        a = np.asarray(validar_evento(x))
        if a.ndim not in (1, 2) or a.shape[-1] != k:
            raise SoporteError(f"x debe contener {k} conteos por observación.")
        return a

    def pmf(self, x: object, **params: object) -> float | np.ndarray:
        """Calcula las masas conjuntas, devolviendo 0 fuera del soporte."""
        v = self.validar(**params)
        a = self._eventos(x, len(v["p"]))
        validos = np.all((a >= 0) & (a == np.floor(a)), axis=-1) & (np.sum(a, axis=-1) == v["n"])
        if a.ndim == 1:
            return float(stats.multinomial.pmf(a, v["n"], v["p"])) if validos else 0.0
        resultado = np.zeros(len(a))
        if np.any(validos):
            resultado[validos] = stats.multinomial.pmf(a[validos], v["n"], v["p"])
        return resultado

    def pdf(self, x: object, **params: object) -> float | np.ndarray:
        """Impide usar PDF en una distribución discreta."""
        raise SoporteError("La multinomial es discreta: usa pmf.")

    def cdf(self, x: object, **params: object) -> np.ndarray:
        """Devuelve CDFs **marginales** (NO la CDF conjunta)."""
        v = self.validar(**params)
        a = self._eventos(x, len(v["p"]))
        return np.asarray(stats.binom.cdf(a, v["n"], np.array(v["p"])))

    def ppf(self, q: object, **params: object) -> np.ndarray:
        """Devuelve cuantiles binomiales marginales por categoría."""
        v = self.validar(**params)
        qv = validar_probabilidades(q)
        if np.ndim(qv) and np.shape(qv)[-1] != len(v["p"]):
            raise ParametroInvalidoError("q debe ser escalar o tener un valor por categoría.")
        return np.asarray(stats.binom.ppf(qv, v["n"], np.array(v["p"])))

    def media(self, **params: object) -> np.ndarray:
        """Valor esperado de cada conteo."""
        v = self.validar(**params)
        return np.asarray(stats.multinomial.mean(v["n"], v["p"]))

    def varianza(self, **params: object) -> np.ndarray:
        """Diagonal de la matriz de covarianzas de los conteos."""
        v = self.validar(**params)
        return np.diag(stats.multinomial.cov(v["n"], v["p"]))

    def rvs(self, size: int, seed: int | None = None, **params: object) -> np.ndarray:
        """Genera filas de conteos reproducibles."""
        v = self.validar(**params)
        return np.asarray(stats.multinomial.rvs(v["n"], v["p"], size=validar_tamano(size), random_state=np.random.default_rng(validar_semilla(seed))))

    def soporte(self, **params: object) -> tuple[float, float]:
        """Límites de cada marginal de conteos."""
        return 0.0, float(self.validar(**params)["n"])


P = Parametro
DISCRETAS: list[Distribucion] = [
    ScipyUnivariante("bernoulli", "Bernoulli", True, [P("p", "real", 0, 1, "Probabilidad de éxito", 0.4)],
                      lambda p: stats.bernoulli(p)),
    ScipyUnivariante("binomial", "Binomial", True, [P("n", "entero", 0, None, "Ensayos independientes", 10), P("p", "real", 0, 1, "Probabilidad de éxito", 0.5)],
                      lambda n, p: stats.binom(n, p)),
    ScipyUnivariante("binomial_negativa", "Binomial negativa", True,
                      [P("r", "entero", 1, None, "Éxitos esperados", 2), P("p", "real", 0, 1, "Probabilidad de éxito", 0.5, False)],
                      lambda r, p: stats.nbinom(r, p)),
    Multinomial(),
    ScipyUnivariante("geometrica", "Geométrica", True, [P("p", "real", 0, 1, "Probabilidad de éxito", 0.5, False)],
                      lambda p: stats.geom(p)),
    ScipyUnivariante("hipergeometrica", "Hipergeométrica", True,
                      [P("N", "entero", 1, None, "Tamaño de la población", 30), P("K", "entero", 0, None, "Éxitos en la población", 12), P("n", "entero", 0, None, "Tamaño de la muestra", 8)],
                      lambda N, K, n: stats.hypergeom(N, K, n), _hipergeometrica),
    ScipyUnivariante("poisson", "Poisson", True, [P("tasa", "real", 0, None, "Eventos esperados por intervalo (λ)", 3.0)],
                      lambda tasa: stats.poisson(tasa)),
    ScipyUnivariante("uniforme_discreta", "Uniforme discreta", True,
                      [P("a", "entero", None, None, "Primer entero", 1), P("b", "entero", None, None, "Último entero incluido", 6)],
                      lambda a, b: stats.randint(a, b + 1), _uniforme_discreta),
]
