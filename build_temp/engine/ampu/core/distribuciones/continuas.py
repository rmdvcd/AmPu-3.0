"""Distribuciones continuas de SciPy, incluidas bivariada y Dirichlet."""

import numpy as np
from scipy import stats

from ampu.core.errores import ParametroInvalidoError, SoporteError
from ampu.core.validacion import (
    Parametro, exigir, validar_evento, validar_parametros,
    validar_probabilidades, validar_semilla, validar_tamano,
)

from .base import Distribucion, ScipyUnivariante, _salida


def _intervalo(p: dict) -> None:
    """Confirma un intervalo de longitud positiva."""
    exigir(p["a"] < p["b"], "El extremo a debe ser menor que b.")


def _triangular(p: dict) -> None:
    """Confirma que la moda esté dentro del soporte."""
    _intervalo(p)
    exigir(p["a"] <= p["c"] <= p["b"], "La moda c debe estar entre a y b.")


class NormalBivariada(Distribucion):
    """Normal conjunta con correlación estrictamente entre -1 y 1.

    ``pdf`` y ``cdf`` son conjuntas; ``ppf`` devuelve cuantiles marginales.
    """

    clave = "normal_bivariada"
    nombre = "Normal bivariada"
    discreta = False
    dimensionalidad = "bivariante"
    parametros = [
        Parametro("mu_x", "real", None, None, "Media de X", 0.0),
        Parametro("mu_y", "real", None, None, "Media de Y", 0.0),
        Parametro("sigma_x", "real", 0, None, "Desviación de X", 1.0, False),
        Parametro("sigma_y", "real", 0, None, "Desviación de Y", 1.0, False),
        Parametro("rho", "real", -1, 1, "Correlación", 0.4, False, False),
    ]

    def _modelo(self, params: dict):
        """Crea la distribución multivariante normal de SciPy."""
        v = self.validar(**params)
        sx, sy, r = v["sigma_x"], v["sigma_y"], v["rho"]
        return stats.multivariate_normal([v["mu_x"], v["mu_y"]], [[sx*sx, r*sx*sy], [r*sx*sy, sy*sy]])

    def _eventos(self, x: object) -> np.ndarray:
        """Verifica un par (x,y) o una matriz n×2."""
        a = np.asarray(validar_evento(x))
        if a.ndim not in (1, 2) or a.shape[-1] != 2:
            raise SoporteError("Se necesita un par (x, y) por observación.")
        return a

    def pmf(self, x: object, **params: object) -> float | np.ndarray:
        """Impide usar masa para una densidad continua."""
        raise SoporteError("La normal bivariada es continua: usa pdf.")

    def pdf(self, x: object, **params: object) -> float | np.ndarray:
        """Densidad conjunta en pares (x, y)."""
        return _salida(self._modelo(params).pdf(self._eventos(x)))

    def cdf(self, x: object, **params: object) -> float | np.ndarray:
        """Probabilidad conjunta P(X≤x, Y≤y) calculada por SciPy."""
        return _salida(self._modelo(params).cdf(self._eventos(x)))

    def ppf(self, q: object, **params: object) -> np.ndarray:
        """Cuantiles marginales; no hay cuantil conjunto canónico."""
        v, qv = self.validar(**params), validar_probabilidades(q)
        if np.ndim(qv) and np.shape(qv)[-1] != 2:
            raise ParametroInvalidoError("q debe ser escalar o contener dos probabilidades.")
        return np.asarray(stats.norm.ppf(qv, [v["mu_x"], v["mu_y"]], [v["sigma_x"], v["sigma_y"]]))

    def media(self, **params: object) -> np.ndarray:
        """Medias marginales de X e Y."""
        v = self.validar(**params)
        return np.array([v["mu_x"], v["mu_y"]])

    def varianza(self, **params: object) -> np.ndarray:
        """Varianzas marginales de X e Y."""
        v = self.validar(**params)
        return np.array([v["sigma_x"]**2, v["sigma_y"]**2])

    def rvs(self, size: int, seed: int | None = None, **params: object) -> np.ndarray:
        """Devuelve una matriz n×2 reproducible."""
        return np.asarray(self._modelo(params).rvs(size=validar_tamano(size), random_state=np.random.default_rng(validar_semilla(seed))))

    def soporte(self, **params: object) -> tuple[float, float]:
        """Soporte de cada componente real."""
        self.validar(**params)
        return -float("inf"), float("inf")


class Dirichlet(Distribucion):
    """Distribución sobre el símplex; CDF/PPF son beta **marginales**."""

    clave = "dirichlet"
    nombre = "Dirichlet"
    discreta = False
    dimensionalidad = "multivariante"
    parametros = [Parametro("alpha", "vector_real", 0, None, "Concentraciones positivas", (2.0, 3.0, 4.0), False)]

    def _eventos(self, x: object, k: int) -> np.ndarray:
        """Comprueba la dimensión de vectores o matriz de proporciones."""
        a = np.asarray(validar_evento(x))
        if a.ndim not in (1, 2) or a.shape[-1] != k:
            raise SoporteError(f"x debe contener {k} proporciones por observación.")
        return a

    def pmf(self, x: object, **params: object) -> float | np.ndarray:
        """Impide usar masa para una densidad continua."""
        raise SoporteError("Dirichlet es continua: usa pdf.")

    def pdf(self, x: object, **params: object) -> float | np.ndarray:
        """Densidad en el símplex; cero si las componentes no suman uno."""
        alpha = self.validar(**params)["alpha"]
        a = self._eventos(x, len(alpha))
        valido = np.all(a >= 0, axis=-1) & np.all(a <= 1, axis=-1) & np.isclose(np.sum(a, axis=-1), 1, rtol=0, atol=1e-12)
        if a.ndim == 1:
            return float(stats.dirichlet.pdf(a, alpha)) if valido else 0.0
        resultado = np.zeros(len(a))
        for i in np.flatnonzero(valido):
            resultado[i] = stats.dirichlet.pdf(a[i], alpha)
        return resultado

    def cdf(self, x: object, **params: object) -> np.ndarray:
        """Devuelve CDFs beta *marginales*, no la CDF conjunta."""
        alpha = np.asarray(self.validar(**params)["alpha"])
        a = self._eventos(x, len(alpha))
        return np.asarray(stats.beta.cdf(a, alpha, alpha.sum() - alpha))

    def ppf(self, q: object, **params: object) -> np.ndarray:
        """Cuantiles beta marginales de cada proporción."""
        alpha = np.asarray(self.validar(**params)["alpha"])
        qv = validar_probabilidades(q)
        if np.ndim(qv) and np.shape(qv)[-1] != len(alpha):
            raise ParametroInvalidoError("q debe ser escalar o tener un valor por componente.")
        return np.asarray(stats.beta.ppf(qv, alpha, alpha.sum() - alpha))

    def media(self, **params: object) -> np.ndarray:
        """Esperanzas de las proporciones."""
        return np.asarray(stats.dirichlet.mean(self.validar(**params)["alpha"]))

    def varianza(self, **params: object) -> np.ndarray:
        """Varianzas marginales de las proporciones."""
        return np.asarray(stats.dirichlet.var(self.validar(**params)["alpha"]))

    def rvs(self, size: int, seed: int | None = None, **params: object) -> np.ndarray:
        """Simula proporciones que suman uno."""
        return np.asarray(stats.dirichlet.rvs(self.validar(**params)["alpha"], size=validar_tamano(size), random_state=np.random.default_rng(validar_semilla(seed))))

    def soporte(self, **params: object) -> tuple[float, float]:
        """Límites marginales, sujetos a la restricción de suma uno."""
        self.validar(**params)
        return 0.0, 1.0


P = Parametro
CONTINUAS: list[Distribucion] = [
    ScipyUnivariante("uniforme", "Uniforme continua", False,
                      [P("a", "real", None, None, "Extremo inferior", 1.0), P("b", "real", None, None, "Extremo superior", 5.0)],
                      lambda a, b: stats.uniform(loc=a, scale=b-a), _intervalo),
    ScipyUnivariante("normal_estandar", "Normal estándar", False, [], lambda: stats.norm()),
    ScipyUnivariante("normal", "Normal general", False,
                      [P("mu", "real", None, None, "Media", 0.0), P("sigma", "real", 0, None, "Desviación estándar", 1.0, False)],
                      lambda mu, sigma: stats.norm(mu, sigma)),
    ScipyUnivariante("chi_cuadrado", "Chi-cuadrado", False,
                      [P("gl", "real", 0, None, "Grados de libertad", 5.0, False)], lambda gl: stats.chi2(gl)),
    ScipyUnivariante("exponencial", "Exponencial", False,
                      [P("tasa", "real", 0, None, "Tasa de eventos λ", 1.0, False)], lambda tasa: stats.expon(scale=1/tasa)),
    ScipyUnivariante("t_student", "t de Student", False,
                      [P("gl", "real", 0, None, "Grados de libertad", 5.0, False)], lambda gl: stats.t(gl)),
    ScipyUnivariante("f_fisher", "F de Fisher", False,
                      [P("gl1", "real", 0, None, "Grados de libertad del numerador", 5.0, False), P("gl2", "real", 0, None, "Grados de libertad del denominador", 10.0, False)],
                      lambda gl1, gl2: stats.f(gl1, gl2)),
    ScipyUnivariante("gamma", "Gamma", False,
                      [P("forma", "real", 0, None, "Forma k", 2.0, False), P("escala", "real", 0, None, "Escala θ", 2.0, False)],
                      lambda forma, escala: stats.gamma(forma, scale=escala)),
    ScipyUnivariante("erlang", "Erlang", False,
                      [P("k", "entero", 1, None, "Etapas de espera", 3), P("tasa", "real", 0, None, "Tasa λ", 1.0, False)],
                      lambda k, tasa: stats.erlang(k, scale=1/tasa)),
    ScipyUnivariante("beta", "Beta", False,
                      [P("alpha", "real", 0, None, "Forma α", 2.0, False), P("beta", "real", 0, None, "Forma β", 5.0, False)],
                      lambda alpha, beta: stats.beta(alpha, beta)),
    ScipyUnivariante("lognormal", "Lognormal", False,
                      [P("mu", "real", None, None, "Media de log(X)", 0.0), P("sigma", "real", 0, None, "Desviación de log(X)", 0.5, False)],
                      lambda mu, sigma: stats.lognorm(sigma, scale=np.exp(mu))),
    ScipyUnivariante("weibull", "Weibull", False,
                      [P("forma", "real", 0, None, "Forma k", 1.5, False), P("escala", "real", 0, None, "Escala λ", 2.0, False)],
                      lambda forma, escala: stats.weibull_min(forma, scale=escala)),
    ScipyUnivariante("cauchy", "Cauchy", False,
                      [P("centro", "real", None, None, "Ubicación x₀", 0.0), P("escala", "real", 0, None, "Escala γ", 1.0, False)],
                      lambda centro, escala: stats.cauchy(loc=centro, scale=escala)),
    ScipyUnivariante("logistica", "Logística", False,
                      [P("mu", "real", None, None, "Ubicación", 0.0), P("escala", "real", 0, None, "Escala", 1.0, False)],
                      lambda mu, escala: stats.logistic(loc=mu, scale=escala)),
    ScipyUnivariante("triangular", "Triangular", False,
                      [P("a", "real", None, None, "Límite inferior", 0.0), P("b", "real", None, None, "Límite superior", 4.0), P("c", "real", None, None, "Moda dentro de [a,b]", 1.0)],
                      lambda a, b, c: stats.triang((c-a)/(b-a), loc=a, scale=b-a), _triangular),
    ScipyUnivariante("pareto", "Pareto", False,
                      [P("alpha", "real", 0, None, "Forma α", 3.0, False), P("xmin", "real", 0, None, "Mínimo xₘ", 1.0, False)],
                      lambda alpha, xmin: stats.pareto(alpha, scale=xmin)),
    NormalBivariada(),
    Dirichlet(),
]
