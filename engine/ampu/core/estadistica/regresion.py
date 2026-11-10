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
    errores: np.ndarray | None = None
    estadisticos_t: np.ndarray | None = None
    ajustados: np.ndarray | None = None
    residuos: np.ndarray | None = None
    diagnostico: dict | None = None

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
        raise ParametroInvalidoError(
            f"Con {n} observaciones no se pueden estimar {k+1} coeficientes y el error: hacen falta al menos {k+2}.", campo="x")
    diseño = np.column_stack([np.ones(n), x])
    beta, _, rango, _ = np.linalg.lstsq(diseño, y, rcond=None)
    if rango < k+1:
        raise CalculoNoConvergenteError(
            "Los predictores son linealmente dependientes (alguna columna es combinación de otras).", campo="x",
            sugerencia="Elimina la columna redundante.")
    residuo = y - diseño @ beta
    gl = n-k-1
    sigma2 = float(residuo @ residuo / gl)
    errores = np.sqrt(np.diag(np.linalg.inv(diseño.T @ diseño)) * sigma2)
    with np.errstate(divide="ignore", invalid="ignore"):
        t = np.divide(beta, errores, out=np.where(beta == 0, 0., np.inf), where=errores != 0)
    p = 2 * stats.t.sf(abs(t), df=gl)
    margen = stats.t.ppf((1+confianza)/2, gl) * errores
    ss_total = float(((y-y.mean())**2).sum())
    # «Constante» con tolerancia: 0,1 + 0,2 y 0,3 difieren en el último bit y no son variación real.
    escala = float(np.max(np.abs(y))) or 1.0
    if ss_total <= n * (8 * np.finfo(float).eps * escala) ** 2:
        raise CalculoNoConvergenteError("La respuesta y es constante: R² no está definido.", campo="y",
                                        sugerencia="Comprueba que Y contiene valores distintos.")
    r2 = 1 - float(residuo @ residuo) / ss_total
    explicado = max(0., r2) * 100
    if 99.95 <= explicado < 100:
        texto_r2 = "más del 99,9"      # no redondear a «100,0 %» un ajuste que no es perfecto
    elif 0 < explicado < 0.05:
        texto_r2 = "menos del 0,1"
    else:
        texto_r2 = f"el {explicado:.1f}".replace(".", ",")
    conclusion = (f"El modelo explica {texto_r2} % de la variabilidad observada (R²). "
                  "La asociación no implica causalidad.")
    return ResultadoRegresion(("Intercepto", *nombres), beta, r2, np.asarray(p),
                              np.column_stack([beta-margen, beta+margen]), n, gl, conclusion,
                              errores, np.asarray(t), diseño @ beta, residuo,
                              _diagnosticar(diseño, x, y, residuo, sigma2, r2, gl, nombres))


def _diagnosticar(diseño: np.ndarray, x: np.ndarray, y: np.ndarray, residuo: np.ndarray,
                  sigma2: float, r2: float, gl: int, nombres: tuple[str, ...]) -> dict:
    """Comprobaciones de los supuestos del modelo lineal, con avisos en lenguaje llano.

    Incluye: contraste F global, normalidad de residuos (Shapiro–Wilk),
    homocedasticidad (Breusch–Pagan, versión de Koenker), autocorrelación
    (Durbin–Watson), puntos influyentes (apalancamiento y distancia de Cook) y
    colinealidad (VIF y número de condición).
    """
    n, k1 = diseño.shape
    k = k1 - 1
    avisos: list[str] = []
    f = (r2 / k) / ((1 - r2) / gl) if r2 < 1 else np.inf
    p_f = float(stats.f.sf(f, k, gl)) if np.isfinite(f) else 0.0

    xtx_inv = np.linalg.inv(diseño.T @ diseño)
    apalancamiento = np.clip(np.einsum("ij,jk,ik->i", diseño, xtx_inv, diseño), 0, 1)
    with np.errstate(divide="ignore", invalid="ignore"):
        estandarizados = residuo / np.sqrt(sigma2 * (1 - apalancamiento)) if sigma2 > 0 else np.zeros(n)
        cook = estandarizados**2 * apalancamiento / ((1 - apalancamiento) * k1)
    estandarizados = np.nan_to_num(estandarizados, nan=0.0, posinf=0.0, neginf=0.0)
    cook = np.nan_to_num(cook, nan=0.0, posinf=np.inf)
    influyentes = [int(i) + 1 for i in np.flatnonzero(cook > 4 / n)]
    atipicos = [int(i) + 1 for i in np.flatnonzero(np.abs(estandarizados) > 3)]

    shapiro_p = None
    if 3 <= n <= 5000 and sigma2 > 0 and float(np.ptp(residuo)) > 0:
        shapiro_p = float(stats.shapiro(residuo).pvalue)
        if shapiro_p < 0.05:
            avisos.append("Los residuos no parecen normales (Shapiro–Wilk p < 0,05): los p-valores e "
                          "intervalos de los coeficientes son aproximados, sobre todo con pocas observaciones.")

    bp_p = None
    ss_res2 = float(((residuo**2 - np.mean(residuo**2))**2).sum())
    if sigma2 > 0 and ss_res2 > 0 and n > k1 + 1:
        gamma, *_ = np.linalg.lstsq(diseño, residuo**2, rcond=None)
        r2_aux = 1 - float(((residuo**2 - diseño @ gamma)**2).sum()) / ss_res2
        bp_p = float(stats.chi2.sf(n * max(0.0, r2_aux), k))
        if bp_p < 0.05:
            avisos.append("La dispersión de los residuos cambia con los predictores (Breusch–Pagan p < 0,05): "
                          "los errores estándar pueden estar mal calibrados.")

    dw = float(np.sum(np.diff(residuo)**2) / np.sum(residuo**2)) if sigma2 > 0 else None
    if dw is not None and (dw < 1 or dw > 3):
        avisos.append(f"Durbin–Watson = {dw:.2f}".replace(".", ",") + ": los residuos consecutivos están "
                      "correlacionados; si los datos tienen orden temporal, el modelo no es adecuado.")

    vif = None
    if k > 1:
        vif = []
        for j in range(k):
            otros = np.column_stack([np.ones(n), np.delete(x, j, axis=1)])
            coef, *_ = np.linalg.lstsq(otros, x[:, j], rcond=None)
            sst_j = float(((x[:, j] - x[:, j].mean())**2).sum())
            r2_j = 1 - float(((x[:, j] - otros @ coef)**2).sum()) / sst_j if sst_j > 0 else 1.0
            vif.append(float(1 / (1 - r2_j)) if r2_j < 1 else float("inf"))
        graves = [nombres[j] for j, v in enumerate(vif) if v > 10]
        if graves:
            avisos.append("Colinealidad alta (VIF > 10) en: " + ", ".join(graves) +
                          ". Los coeficientes de esos predictores son inestables.")
    escalado = diseño / np.linalg.norm(diseño, axis=0)
    condicion = float(np.linalg.cond(escalado))

    if influyentes:
        lista = ", ".join(map(str, influyentes[:8])) + ("…" if len(influyentes) > 8 else "")
        avisos.append(f"Observaciones influyentes (distancia de Cook > 4/n): {lista}. "
                      "Comprueba si son errores de registro antes de interpretar el ajuste.")
    if n < 10 * k:
        avisos.append(f"Hay pocas observaciones ({n}) para {k} predictor{'es' if k != 1 else ''}: "
                      "el modelo puede estar sobreajustado.")
    return {
        "f": float(f), "gl_modelo": k, "gl_residual": gl, "p_f": p_f,
        "shapiro_p": shapiro_p, "breusch_pagan_p": bp_p, "durbin_watson": dw,
        "apalancamiento": apalancamiento, "cook": cook, "estandarizados": estandarizados,
        "influyentes": influyentes, "atipicos": atipicos, "vif": vif, "condicion": condicion,
        "avisos": avisos,
    }


def lineal_simple(x: object, y: object, confianza: float = 0.95) -> ResultadoRegresion:
    """Ajusta y=β₀+β₁x; equivale a ``scipy.stats.linregress``."""
    a, b = validar_muestra(x, minimo=3), validar_muestra(y, minimo=3)
    if len(a) != len(b):
        raise ParametroInvalidoError(f"x e y deben tener la misma longitud ({len(a)} frente a {len(b)}).", campo="x")
    if float(np.ptp(a)) <= 1e-12 * max(1.0, float(np.max(np.abs(a)))):
        raise CalculoNoConvergenteError(
            "El predictor x es constante: no se puede estimar una pendiente.", campo="x")
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
