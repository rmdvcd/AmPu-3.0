"""Ajuste lineal simple y múltiple con incertidumbre e inferencia t."""

from dataclasses import dataclass

import numpy as np
from scipy import stats

from ampu.core.errores import CalculoNoConvergenteError, ParametroInvalidoError
from ampu.core.validacion import validar_muestra, validar_nivel


@dataclass(frozen=True)
class ResultadoRegresion:
    """Modelo lineal con intercepto en coeficientes[0]."""

    nombres: tuple[str, ...]
    coeficientes: np.ndarray
    r_cuadrado: float
    p_valores: np.ndarray
    intervalos: np.ndarray
    n: int
    gl: int
    conclusion: str

    def predecir(self, x: object) -> np.ndarray:
        """Predice una o varias filas de nuevas variables explicativas."""
        a = np.asarray(x, dtype=float)
        if a.ndim == 1:
            a = a.reshape(1, -1)
        if a.ndim != 2 or a.shape[1] != len(self.coeficientes)-1 or not np.all(np.isfinite(a)):
            raise ParametroInvalidoError("Las nuevas filas tienen otra cantidad de predictores.")
        return self.coeficientes[0] + a @ self.coeficientes[1:]


def _ajustar(x: np.ndarray, y: np.ndarray, nombres: tuple[str, ...], confianza: float) -> ResultadoRegresion:
    """Resuelve mínimos cuadrados por SVD y calcula inferencia por t."""
    confianza = validar_nivel(confianza)
    n, k = x.shape
    if n <= k+1:
        raise ParametroInvalidoError("Se requieren más filas que coeficientes para estimar el error.")
    diseño = np.column_stack([np.ones(n), x])
    beta, _, rango, _ = np.linalg.lstsq(diseño, y, rcond=None)
    if rango < k+1:
        raise CalculoNoConvergenteError("Los predictores tienen dependencia lineal exacta.")
    residuo = y - diseño @ beta
    gl = n-k-1
    sigma2 = float(residuo @ residuo / gl)
    errores = np.sqrt(np.diag(np.linalg.inv(diseño.T @ diseño)) * sigma2)
    with np.errstate(divide="ignore", invalid="ignore"):
        t = np.divide(beta, errores, out=np.where(beta == 0, 0., np.inf), where=errores != 0)
    p = 2 * stats.t.sf(abs(t), df=gl)
    margen = stats.t.ppf((1+confianza)/2, gl) * errores
    ss_total = float(((y-y.mean())**2).sum())
    if ss_total == 0:
        raise CalculoNoConvergenteError("La respuesta es constante; R² no está definido.")
    r2 = 1 - float(residuo @ residuo) / ss_total
    conclusion = (f"El modelo explica el {max(0., r2)*100:.1f} % de la variabilidad observada (R²). "
                  "La asociación no implica causalidad.")
    return ResultadoRegresion(("Intercepto", *nombres), beta, r2, np.asarray(p),
                              np.column_stack([beta-margen, beta+margen]), n, gl, conclusion)


def lineal_simple(x: object, y: object, confianza: float = 0.95) -> ResultadoRegresion:
    """Ajusta y=β₀+β₁x; equivale a ``scipy.stats.linregress``."""
    a, b = validar_muestra(x, minimo=3), validar_muestra(y, minimo=3)
    if len(a) != len(b):
        raise ParametroInvalidoError("x e y deben tener igual longitud.")
    if np.std(a) == 0:
        raise CalculoNoConvergenteError("x es constante.")
    return _ajustar(a[:, None], b, ("x",), confianza)


def lineal_multiple(x: object, y: object, confianza: float = 0.95, nombres: list[str] | None = None) -> ResultadoRegresion:
    """Regresión OLS multivariable sin dependencia de paquetes externos."""
    try:
        a = np.asarray(x, dtype=float)
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("Los predictores deben ser numéricos.") from exc
    b = validar_muestra(y, minimo=3)
    if a.ndim != 2 or a.shape[0] != len(b) or a.shape[1] < 2 or not np.all(np.isfinite(a)):
        raise ParametroInvalidoError("X debe ser una matriz finita con dos o más predictores.")
    if nombres is not None and len(nombres) != a.shape[1]:
        raise ParametroInvalidoError("Se necesita un nombre por predictor.")
    return _ajustar(a, b, tuple(nombres or [f"x{i+1}" for i in range(a.shape[1])]), confianza)
