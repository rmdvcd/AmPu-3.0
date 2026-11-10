"""Pruebas paramétricas/no paramétricas e intervalos con interpretación."""

from dataclasses import dataclass, field
from math import sqrt

import numpy as np
from scipy import stats

from ampu.core.errores import CalculoNoConvergenteError, ParametroInvalidoError
from ampu.core.validacion import validar_muestra, validar_nivel


@dataclass(frozen=True)
class ResultadoPrueba:
    """Resultado en unidades originales y conclusión a nivel alfa declarado."""

    metodo: str
    estadistico: float
    p_valor: float
    alfa: float
    conclusion: str
    gl: float | None = None
    intervalo: tuple[float, float] | None = None
    detalles: dict = field(default_factory=dict)


def _alternativa(alternativa: str) -> str:
    """Comprueba las tres alternativas soportadas por SciPy."""
    if alternativa not in ("two-sided", "less", "greater"):
        raise ParametroInvalidoError("La alternativa debe ser two-sided, less o greater.")
    return alternativa


def _pvalor(est: float, alternativa: str, distribucion) -> float:
    """Calcula un p-valor estable desde la función de supervivencia."""
    if alternativa == "two-sided":
        return float(2 * distribucion.sf(abs(est)))
    return float(distribucion.cdf(est) if alternativa == "less" else distribucion.sf(est))


def _resultado(
    metodo: str, est: float, p: float, alfa: float, gl: float | None = None,
    intervalo: tuple[float, float] | None = None, detalles: dict | None = None,
) -> ResultadoPrueba:
    """Construye interpretación; nunca afirma que aceptar H0 pruebe H0."""
    alfa = validar_nivel(alfa)
    if not np.isfinite(est) or not np.isfinite(p) or not 0 <= p <= 1:
        raise CalculoNoConvergenteError("La prueba no converge: muestra constante o tabla degenerada.")
    texto = (f"Se rechaza H₀ (p = {p:.4g} < α = {alfa:.3g}). Hay evidencia estadística de un efecto."
             if p < alfa else
             f"No se rechaza H₀ (p = {p:.4g} ≥ α = {alfa:.3g}); esto no demuestra que H₀ sea cierta.")
    return ResultadoPrueba(metodo, float(est), float(p), alfa, texto,
                           None if gl is None else float(gl), intervalo, detalles or {})


def intervalo_media(datos: object, confianza: float = 0.95, sigma: float | None = None) -> tuple[float, float]:
    """IC para la media: t si sigma desconocida, normal si conocida."""
    x = validar_muestra(datos)
    confianza = validar_nivel(confianza)
    if sigma is not None and (not np.isfinite(sigma) or sigma <= 0):
        raise ParametroInvalidoError("La desviación poblacional debe ser positiva.")
    desviacion = np.std(x, ddof=1) if sigma is None else sigma
    critico = stats.t.ppf((1+confianza)/2, len(x)-1) if sigma is None else stats.norm.ppf((1+confianza)/2)
    margen = critico * desviacion / sqrt(len(x))
    return float(np.mean(x) - margen), float(np.mean(x) + margen)


def intervalo_proporcion(exitos: int, n: int, confianza: float = 0.95) -> tuple[float, float]:
    """Intervalo Wilson de proporción; válido incluso para 0 y n éxitos."""
    _conteos(exitos, n)
    z = stats.norm.ppf((1 + validar_nivel(confianza)) / 2)
    p = exitos / n
    denom = 1 + z*z/n
    centro = (p + z*z/(2*n)) / denom
    margen = z * sqrt(p*(1-p)/n + z*z/(4*n*n)) / denom
    return (0. if exitos == 0 else max(0., float(centro-margen)),
            1. if exitos == n else min(1., float(centro+margen)))


def _conteos(exitos: int, n: int) -> None:
    """Rechaza conteos no enteros o fuera de 0..n."""
    if any(isinstance(v, bool) or not isinstance(v, (int, np.integer)) for v in (exitos, n)) or n <= 0 or not 0 <= exitos <= n:
        raise ParametroInvalidoError("Se necesitan 0 ≤ éxitos ≤ n, con n entero positivo.")


def z_una_muestra(datos: object, mu0: float, sigma: float, alfa: float = 0.05, alternativa: str = "two-sided") -> ResultadoPrueba:
    """Contrasta una media con sigma poblacional conocida."""
    x, alt = validar_muestra(datos), _alternativa(alternativa)
    if not np.isfinite(mu0) or not np.isfinite(sigma) or sigma <= 0:
        raise ParametroInvalidoError("mu0 debe ser finita y sigma positiva.")
    est = (np.mean(x) - mu0) / (sigma / sqrt(len(x)))
    return _resultado("z · una media", est, _pvalor(est, alt, stats.norm), alfa,
                      intervalo=intervalo_media(x, 1-alfa, sigma), detalles={"n": len(x), "mu0": mu0})


def t_una_muestra(datos: object, mu0: float, alfa: float = 0.05, alternativa: str = "two-sided") -> ResultadoPrueba:
    """Contrasta una media con t de Student y varianza desconocida."""
    x, alt = validar_muestra(datos), _alternativa(alternativa)
    if not np.isfinite(mu0):
        raise ParametroInvalidoError("La media nula debe ser finita.")
    if np.std(x, ddof=1) == 0:
        raise CalculoNoConvergenteError("No se puede hacer una prueba t con varianza cero.")
    prueba = stats.ttest_1samp(x, mu0, alternative=alt)
    return _resultado("t · una media", prueba.statistic, prueba.pvalue, alfa,
                      gl=len(x)-1, intervalo=intervalo_media(x, 1-alfa), detalles={"n": len(x), "mu0": mu0})


def z_dos_muestras(
    a: object, b: object, sigma_a: float, sigma_b: float,
    alfa: float = 0.05, alternativa: str = "two-sided",
) -> ResultadoPrueba:
    """Compara medias independientes con sigmas poblacionales conocidas."""
    x, y, alt = validar_muestra(a), validar_muestra(b), _alternativa(alternativa)
    if min(sigma_a, sigma_b) <= 0 or not np.all(np.isfinite([sigma_a, sigma_b])):
        raise ParametroInvalidoError("Las desviaciones poblacionales deben ser positivas.")
    se = sqrt(sigma_a**2/len(x) + sigma_b**2/len(y))
    diferencia = float(np.mean(x) - np.mean(y))
    z = diferencia / se
    margen = stats.norm.ppf(1-alfa/2) * se
    return _resultado("z · dos medias", z, _pvalor(z, alt, stats.norm), alfa,
                      intervalo=(diferencia-margen, diferencia+margen), detalles={"n1": len(x), "n2": len(y)})


def t_dos_muestras(a: object, b: object, alfa: float = 0.05, alternativa: str = "two-sided") -> ResultadoPrueba:
    """Prueba t de Welch para dos medias independientes, sin asumir varianzas iguales."""
    x, y, alt = validar_muestra(a), validar_muestra(b), _alternativa(alternativa)
    vx, vy = np.var(x, ddof=1)/len(x), np.var(y, ddof=1)/len(y)
    if vx + vy == 0:
        raise CalculoNoConvergenteError("Ambas muestras tienen varianza cero.")
    gl = (vx+vy)**2 / (vx**2/(len(x)-1) + vy**2/(len(y)-1))
    prueba = stats.ttest_ind(x, y, equal_var=False, alternative=alt)
    diff = float(np.mean(x) - np.mean(y))
    margen = stats.t.ppf(1-alfa/2, gl) * sqrt(vx+vy)
    return _resultado("t de Welch · dos medias", prueba.statistic, prueba.pvalue, alfa, gl,
                      (diff-margen, diff+margen), {"n1": len(x), "n2": len(y)})


def proporcion_una(exitos: int, n: int, p0: float, alfa: float = 0.05, alternativa: str = "two-sided") -> ResultadoPrueba:
    """Aproximación z para una proporción; IC descriptivo de Wilson."""
    _conteos(exitos, n)
    alt = _alternativa(alternativa)
    if not np.isfinite(p0) or not 0 < p0 < 1:
        raise ParametroInvalidoError("La proporción hipotética p0 debe estar entre 0 y 1.")
    est = (exitos/n - p0) / sqrt(p0*(1-p0)/n)
    return _resultado("z · una proporción", est, _pvalor(est, alt, stats.norm), alfa,
                      intervalo=intervalo_proporcion(exitos, n, 1-alfa),
                      detalles={"éxitos": exitos, "n": n, "proporcion_observada": exitos/n,
                                "proporcion_fallos": (n-exitos)/n})


def proporcion_dos(x1: int, n1: int, x2: int, n2: int, alfa: float = 0.05, alternativa: str = "two-sided") -> ResultadoPrueba:
    """Prueba z con estimador agrupado H0:p1=p2 e IC no agrupado."""
    _conteos(x1, n1)
    _conteos(x2, n2)
    alt = _alternativa(alternativa)
    p1, p2, agrupada = x1/n1, x2/n2, (x1+x2)/(n1+n2)
    if agrupada in (0, 1):
        raise CalculoNoConvergenteError("No hay variación entre éxitos y fracasos.")
    se0 = sqrt(agrupada*(1-agrupada)*(1/n1+1/n2))
    est = (p1-p2) / se0
    margen = stats.norm.ppf(1-alfa/2) * sqrt(p1*(1-p1)/n1+p2*(1-p2)/n2)
    return _resultado("z · dos proporciones", est, _pvalor(est, alt, stats.norm), alfa,
                      intervalo=(p1-p2-margen, p1-p2+margen),
                      detalles={"n1": n1, "n2": n2, "proporciones_observadas": (p1, p2)})


def chi_bondad(observadas: object, esperadas: object, alfa: float = 0.05, parametros_estimados: int = 0) -> ResultadoPrueba:
    """Contraste chi² de bondad de ajuste con parámetros estimados opcionales."""
    try:
        obs, esp = np.asarray(observadas, dtype=float), np.asarray(esperadas, dtype=float)
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("Las frecuencias deben ser numéricas.") from exc
    if obs.ndim != 1 or obs.size < 2 or esp.shape != obs.shape or np.any(~np.isfinite(obs)) or np.any(~np.isfinite(esp)) or np.any(obs < 0) or np.any(esp <= 0) or not np.isclose(obs.sum(), esp.sum(), atol=1e-9, rtol=1e-9):
        raise ParametroInvalidoError("Frecuencias no negativas, esperadas positivas y totales iguales requeridos.")
    if not isinstance(parametros_estimados, int) or not 0 <= parametros_estimados < len(obs)-1:
        raise ParametroInvalidoError("Grados de libertad insuficientes.")
    prueba = stats.chisquare(obs, esp, ddof=parametros_estimados)
    return _resultado("χ² · bondad de ajuste", prueba.statistic, prueba.pvalue, alfa,
                      gl=len(obs)-1-parametros_estimados,
                      detalles={"advertencia": "Alguna frecuencia esperada es < 5; interpreta con prudencia." if np.any(esp < 5) else ""})


def chi_independencia(tabla: object, alfa: float = 0.05) -> ResultadoPrueba:
    """Prueba chi² de independencia de dos variables categóricas."""
    try:
        a = np.asarray(tabla, dtype=float)
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("La tabla debe ser numérica.") from exc
    if a.ndim != 2 or min(a.shape) < 2 or np.any(~np.isfinite(a)) or np.any(a < 0):
        raise ParametroInvalidoError("Se necesita una tabla ≥2×2 de frecuencias no negativas.")
    try:
        est, p, gl, esperadas = stats.chi2_contingency(a, correction=False)
    except ValueError as exc:
        raise ParametroInvalidoError("Hay una fila o columna de total cero.") from exc
    return _resultado("χ² · independencia", est, p, alfa, gl,
                      detalles={"esperadas": esperadas.tolist(), "totales_fila": a.sum(axis=1).tolist(),
                                "advertencia": "Alguna frecuencia esperada es < 5; interpreta con prudencia." if np.any(esperadas < 5) else ""})


def anova(grupos: list[object], alfa: float = 0.05) -> ResultadoPrueba:
    """ANOVA de una vía con al menos dos grupos y observaciones por grupo."""
    if len(grupos) < 2:
        raise ParametroInvalidoError("ANOVA requiere al menos dos grupos.")
    muestras = [validar_muestra(g) for g in grupos]
    prueba = stats.f_oneway(*muestras)
    return _resultado("ANOVA · una vía", prueba.statistic, prueba.pvalue, alfa,
                      gl=len(muestras)-1, detalles={"gl_residual": sum(map(len, muestras))-len(muestras), "medias": [float(np.mean(g)) for g in muestras]})


def correlacion(x: object, y: object, metodo: str = "pearson", alfa: float = 0.05) -> ResultadoPrueba:
    """Contrasta correlación de Pearson o Spearman entre dos series pareadas."""
    a, b = validar_muestra(x, minimo=3), validar_muestra(y, minimo=3)
    if len(a) != len(b):
        raise ParametroInvalidoError("Las dos series deben tener la misma longitud.")
    if metodo not in ("pearson", "spearman"):
        raise ParametroInvalidoError("Método de correlación no reconocido.")
    prueba = stats.pearsonr(a, b) if metodo == "pearson" else stats.spearmanr(a, b)
    intervalo = (tuple(map(float, prueba.confidence_interval(confidence_level=1-alfa)))
                 if metodo == "pearson" and len(a) > 3 else None)
    return _resultado(f"Correlación de {metodo.title()}", prueba.statistic, prueba.pvalue, alfa,
                      gl=len(a)-2 if metodo == "pearson" else None, intervalo=intervalo)


def mann_whitney(a: object, b: object, alfa: float = 0.05) -> ResultadoPrueba:
    """Prueba de Mann–Whitney para dos muestras independientes."""
    x, y = validar_muestra(a), validar_muestra(b)
    prueba = stats.mannwhitneyu(x, y, alternative="two-sided")
    return _resultado("Mann–Whitney U", prueba.statistic, prueba.pvalue, alfa)


def wilcoxon(a: object, b: object, alfa: float = 0.05) -> ResultadoPrueba:
    """Prueba de rangos con signo para pares de observaciones."""
    x, y = validar_muestra(a), validar_muestra(b)
    if len(x) != len(y) or np.array_equal(x, y):
        raise ParametroInvalidoError("Se requieren pares del mismo tamaño y alguna diferencia no nula.")
    prueba = stats.wilcoxon(x, y)
    return _resultado("Wilcoxon pareado", prueba.statistic, prueba.pvalue, alfa)


def kruskal(grupos: list[object], alfa: float = 0.05) -> ResultadoPrueba:
    """Prueba de Kruskal–Wallis para dos o más grupos independientes."""
    if len(grupos) < 2:
        raise ParametroInvalidoError("Indica al menos dos grupos.")
    muestras = [validar_muestra(g) for g in grupos]
    try:
        prueba = stats.kruskal(*muestras)
    except ValueError as exc:
        raise CalculoNoConvergenteError("No hay variación entre los rangos.") from exc
    return _resultado("Kruskal–Wallis", prueba.statistic, prueba.pvalue, alfa, gl=len(grupos)-1,
                      detalles={"medias_descriptivas": [float(np.mean(g)) for g in muestras]})


def error_absoluto(estimacion: float, referencia: float) -> float:
    """Diferencia absoluta sin unidades relativas."""
    if not np.all(np.isfinite([estimacion, referencia])):
        raise ParametroInvalidoError("Se necesitan valores finitos.")
    return abs(estimacion - referencia)


def error_relativo(estimacion: float, referencia: float) -> float:
    """Error relativo |estimación−referencia|/|referencia|."""
    if referencia == 0:
        raise ParametroInvalidoError("No se define error relativo respecto a cero.")
    return error_absoluto(estimacion, referencia) / abs(referencia)
