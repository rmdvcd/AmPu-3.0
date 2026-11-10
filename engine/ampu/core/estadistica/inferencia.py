"""Pruebas paramétricas/no paramétricas e intervalos con interpretación.

Contrato de cada prueba (``ResultadoPrueba``):

* ``p_valor`` sin redondear: el formato es asunto de la capa de presentación.
* ``alternativa``: la hipótesis alternativa realmente contrastada, o ``None``
  cuando la prueba no admite dirección (χ², ANOVA, Kruskal–Wallis).
* ``intervalo``: coherente con la alternativa (unilateral ⇒ una cota infinita).
* ``nula``: distribución de referencia **con la que se calculó el p-valor**
  (familia, grados de libertad y estadístico en esa misma escala).  Quien
  dibuje la curva debe usar solo este campo; es ``None`` si la prueba es exacta
  y no existe una curva continua que represente la decisión.
* ``exacta``: ``True`` si el p-valor procede de una distribución exacta.
* ``avisos``: supuestos dudosos o decisiones automáticas (p. ej. cambio a una
  prueba exacta), siempre declarados.
* ``extras``: tamaños de efecto y resumen descriptivo.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import asin, inf, sqrt

import numpy as np
from scipy import stats

from ampu.core.errores import CalculoNoConvergenteError, ParametroInvalidoError
from ampu.core.validacion import validar_muestra, validar_nivel

ALTERNATIVAS = ("two-sided", "less", "greater")
_COLAS = {"two-sided": "dos", "less": "izquierda", "greater": "derecha"}


@dataclass(frozen=True)
class ResultadoPrueba:
    """Resultado en unidades originales y conclusión al nivel alfa declarado."""

    metodo: str
    estadistico: float
    p_valor: float
    alfa: float
    conclusion: str
    gl: float | None = None
    intervalo: tuple[float, float] | None = None
    detalles: dict = field(default_factory=dict)
    alternativa: str | None = None
    nula: dict | None = None
    exacta: bool = False
    simbolo: str = ""
    avisos: tuple[str, ...] = ()
    extras: dict = field(default_factory=dict)
    intervalo_de: str = ""

    @property
    def rechaza(self) -> bool:
        """Decisión única: se rechaza H₀ si y solo si p < α."""
        return self.p_valor < self.alfa


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _alternativa(alternativa: str) -> str:
    """Comprueba las tres alternativas soportadas."""
    if alternativa not in ALTERNATIVAS:
        raise ParametroInvalidoError(
            "La alternativa debe ser bilateral (two-sided), menor (less) o mayor (greater).",
            campo="alternativa")
    return alternativa


def formatear_p(p: float) -> str:
    """Texto legible de un p-valor; nunca muestra «0» para un valor positivo."""
    if p == 0:
        return "< 1e-300"
    if p < 1e-4:
        mantisa, exponente = f"{p:.2e}".split("e")
        superindice = str(int(exponente)).translate(str.maketrans("-0123456789", "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"))
        return f"{mantisa.replace('.', ',')} × 10{superindice}"
    return f"{p:.4f}".replace(".", ",")


def _es(valor: float) -> str:
    """Número breve con coma decimal para textos en español."""
    return f"{valor:.3g}".replace(".", ",")


def _pvalor(est: float, alternativa: str, distribucion) -> float:
    """Calcula un p-valor estable desde la función de supervivencia."""
    if alternativa == "two-sided":
        return float(min(1.0, 2 * distribucion.sf(abs(est))))
    return float(distribucion.cdf(est) if alternativa == "less" else distribucion.sf(est))


def _z_desde_p(p: float, alternativa: str, signo: float) -> float | None:
    """Puntuación z equivalente a un p-valor asintótico (misma escala que la curva)."""
    if not 0 < p < 1:
        return None
    if alternativa == "two-sided":
        z = float(stats.norm.isf(p / 2))
        return z if signo >= 0 else -z
    return float(stats.norm.ppf(p) if alternativa == "less" else stats.norm.isf(p))


def _constante(x: np.ndarray) -> bool:
    """Detecta una muestra sin variación con tolerancia relativa (no ``== 0``)."""
    return float(np.ptp(x)) <= 1e-12 * max(1.0, float(np.max(np.abs(x))))


def _unilateral(centro: float, margen_fn, alternativa: str, alfa: float,
                minimo: float = -inf, maximo: float = inf) -> tuple[float, float]:
    """IC coherente con la alternativa; ``margen_fn(q)`` da el margen para el cuantil q."""
    if alternativa == "two-sided":
        m = margen_fn(1 - alfa / 2)
        return max(minimo, centro - m), min(maximo, centro + m)
    m = margen_fn(1 - alfa)
    return (max(minimo, centro - m), maximo) if alternativa == "greater" else (minimo, min(maximo, centro + m))


def _nula(familia: str, estadistico: float | None, alternativa: str | None, *, gl=None, gl2=None,
          etiqueta: str = "", aproximada: bool = False) -> dict | None:
    """Describe la distribución nula usada; ``None`` si no hay estadístico finito."""
    if estadistico is None or not np.isfinite(estadistico):
        return None
    return {
        "familia": familia,
        "gl": None if gl is None else float(gl),
        "gl2": None if gl2 is None else float(gl2),
        "estadistico": float(estadistico),
        "etiqueta": etiqueta,
        "cola": _COLAS.get(alternativa or "greater", "derecha"),
        "aproximada": bool(aproximada),
    }


def _resultado(
    metodo: str, est: float, p: float, alfa: float, gl: float | None = None,
    intervalo: tuple[float, float] | None = None, detalles: dict | None = None, *,
    alternativa: str | None = None, nula: dict | None = None, exacta: bool = False,
    simbolo: str = "", avisos: list[str] | tuple[str, ...] = (), extras: dict | None = None,
    intervalo_de: str = "",
) -> ResultadoPrueba:
    """Construye la interpretación; nunca afirma que no rechazar H₀ pruebe H₀."""
    alfa = validar_nivel(alfa)
    if not np.isfinite(est) or not np.isfinite(p) or not 0 <= p <= 1:
        raise CalculoNoConvergenteError(
            "La prueba no puede calcularse: la muestra es constante o la tabla está degenerada.",
            sugerencia="Comprueba que los datos tengan variación y que ninguna fila o columna sea cero.")
    p = float(p)
    p_txt, alfa_txt = formatear_p(p), _es(alfa)
    if p < alfa:
        texto = f"Se rechaza H₀ (p = {p_txt} < α = {alfa_txt}). Los datos aportan evidencia a favor de H₁."
    else:
        texto = (f"No se rechaza H₀ (p = {p_txt} ≥ α = {alfa_txt}); "
                 "esto no demuestra que H₀ sea cierta, solo que la evidencia es insuficiente.")
    return ResultadoPrueba(
        metodo, float(est), p, alfa, texto, None if gl is None else float(gl),
        None if intervalo is None else (float(intervalo[0]), float(intervalo[1])),
        detalles or {}, alternativa, nula, exacta, simbolo,
        tuple(a for a in avisos if a), extras or {}, intervalo_de,
    )


def _aviso_normalidad(*tamanos: int) -> str:
    if min(tamanos) < 30:
        return ("Con menos de 30 observaciones la prueba depende de que los datos sean aproximadamente "
                "normales; revisa el histograma o usa la alternativa no paramétrica.")
    return ""


def _conteos(exitos: int, n: int) -> None:
    """Rechaza conteos no enteros o fuera de 0..n."""
    if any(isinstance(v, bool) or not isinstance(v, (int, np.integer)) for v in (exitos, n)) or n <= 0 or not 0 <= exitos <= n:
        raise ParametroInvalidoError("Se necesitan 0 ≤ éxitos ≤ n, con n entero positivo.")


# ---------------------------------------------------------------------------
# Intervalos
# ---------------------------------------------------------------------------

def intervalo_media(datos: object, confianza: float = 0.95, sigma: float | None = None,
                    alternativa: str = "two-sided") -> tuple[float, float]:
    """IC para la media: t si sigma desconocida, normal si conocida."""
    x = validar_muestra(datos)
    confianza, alt = validar_nivel(confianza), _alternativa(alternativa)
    if sigma is not None and (not np.isfinite(sigma) or sigma <= 0):
        raise ParametroInvalidoError("La desviación poblacional debe ser positiva.", campo="sigma")
    desviacion = float(np.std(x, ddof=1)) if sigma is None else float(sigma)
    dist = stats.t(len(x) - 1) if sigma is None else stats.norm
    error = desviacion / sqrt(len(x))
    return _unilateral(float(np.mean(x)), lambda q: float(dist.ppf(q)) * error, alt, 1 - confianza)


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


# ---------------------------------------------------------------------------
# Medias
# ---------------------------------------------------------------------------

def z_una_muestra(datos: object, mu0: float, sigma: float, alfa: float = 0.05,
                  alternativa: str = "two-sided") -> ResultadoPrueba:
    """Contrasta una media con sigma poblacional conocida."""
    x, alt, alfa = validar_muestra(datos), _alternativa(alternativa), validar_nivel(alfa)
    if not np.isfinite(mu0):
        raise ParametroInvalidoError("La media nula μ₀ debe ser un número finito.", campo="mu0")
    if not np.isfinite(sigma) or sigma <= 0:
        raise ParametroInvalidoError("La desviación poblacional σ debe ser positiva.", campo="sigma")
    media = float(np.mean(x))
    est = (media - mu0) / (sigma / sqrt(len(x)))
    return _resultado(
        "z · una media", est, _pvalor(est, alt, stats.norm), alfa,
        intervalo=intervalo_media(x, 1 - alfa, sigma, alt), detalles={"n": len(x), "mu0": mu0},
        alternativa=alt, nula=_nula("normal", est, alt, etiqueta="z"), simbolo="z",
        avisos=[_aviso_normalidad(len(x))], intervalo_de="μ",
        extras={"d_cohen": (media - mu0) / sigma, "n": len(x), "media_muestral": media})


def t_una_muestra(datos: object, mu0: float, alfa: float = 0.05,
                  alternativa: str = "two-sided") -> ResultadoPrueba:
    """Contrasta una media con t de Student y varianza desconocida."""
    x, alt, alfa = validar_muestra(datos), _alternativa(alternativa), validar_nivel(alfa)
    if not np.isfinite(mu0):
        raise ParametroInvalidoError("La media nula μ₀ debe ser un número finito.", campo="mu0")
    if _constante(x):
        raise CalculoNoConvergenteError(
            "No se puede hacer una prueba t: todos los valores de la muestra son iguales.",
            campo="datos", sugerencia="La prueba necesita variación en los datos.")
    prueba = stats.ttest_1samp(x, mu0, alternative=alt)
    media, s = float(np.mean(x)), float(np.std(x, ddof=1))
    return _resultado(
        "t · una media", prueba.statistic, prueba.pvalue, alfa, gl=len(x) - 1,
        intervalo=intervalo_media(x, 1 - alfa, None, alt), detalles={"n": len(x), "mu0": mu0},
        alternativa=alt, nula=_nula("t", float(prueba.statistic), alt, gl=len(x) - 1, etiqueta="t"),
        simbolo="t", avisos=[_aviso_normalidad(len(x))], intervalo_de="μ",
        extras={"d_cohen": (media - mu0) / s, "n": len(x), "media_muestral": media})


def z_dos_muestras(
    a: object, b: object, sigma_a: float, sigma_b: float,
    alfa: float = 0.05, alternativa: str = "two-sided",
) -> ResultadoPrueba:
    """Compara medias independientes con sigmas poblacionales conocidas."""
    x, y, alt, alfa = validar_muestra(a), validar_muestra(b), _alternativa(alternativa), validar_nivel(alfa)
    for valor, campo in ((sigma_a, "sigma_a"), (sigma_b, "sigma_b")):
        if not np.isfinite(valor) or valor <= 0:
            raise ParametroInvalidoError("Las desviaciones poblacionales deben ser positivas.", campo=campo)
    se = sqrt(sigma_a**2/len(x) + sigma_b**2/len(y))
    medias = [float(np.mean(x)), float(np.mean(y))]
    diferencia = medias[0] - medias[1]
    z = diferencia / se
    return _resultado(
        "z · dos medias", z, _pvalor(z, alt, stats.norm), alfa,
        intervalo=_unilateral(diferencia, lambda q: float(stats.norm.ppf(q)) * se, alt, alfa),
        detalles={"n1": len(x), "n2": len(y)}, alternativa=alt,
        nula=_nula("normal", z, alt, etiqueta="z"), simbolo="z",
        avisos=[_aviso_normalidad(len(x), len(y))], intervalo_de="μ₁ − μ₂",
        extras={"d_cohen": diferencia / sqrt((sigma_a**2 + sigma_b**2) / 2),
                "n1": len(x), "n2": len(y), "medias": medias})


def t_dos_muestras(a: object, b: object, alfa: float = 0.05,
                   alternativa: str = "two-sided") -> ResultadoPrueba:
    """Prueba t de Welch para dos medias independientes, sin asumir varianzas iguales."""
    x, y, alt, alfa = validar_muestra(a), validar_muestra(b), _alternativa(alternativa), validar_nivel(alfa)
    if _constante(x) and _constante(y):
        raise CalculoNoConvergenteError(
            "No se puede hacer la prueba t: las dos muestras son constantes.",
            campo="datos", sugerencia="La prueba necesita variación en al menos un grupo.")
    s2x, s2y = float(np.var(x, ddof=1)), float(np.var(y, ddof=1))
    vx, vy = s2x/len(x), s2y/len(y)
    gl = (vx+vy)**2 / (vx**2/(len(x)-1) + vy**2/(len(y)-1))
    prueba = stats.ttest_ind(x, y, equal_var=False, alternative=alt)
    medias = [float(np.mean(x)), float(np.mean(y))]
    diff, se = medias[0] - medias[1], sqrt(vx + vy)
    agrupada = sqrt(((len(x)-1)*s2x + (len(y)-1)*s2y) / (len(x) + len(y) - 2))
    return _resultado(
        "t de Welch · dos medias", prueba.statistic, prueba.pvalue, alfa, gl,
        _unilateral(diff, lambda q: float(stats.t.ppf(q, gl)) * se, alt, alfa),
        {"n1": len(x), "n2": len(y)}, alternativa=alt,
        nula=_nula("t", float(prueba.statistic), alt, gl=gl, etiqueta="t"), simbolo="t",
        avisos=[_aviso_normalidad(len(x), len(y))], intervalo_de="μ₁ − μ₂",
        extras={"d_cohen": diff / agrupada if agrupada > 0 else None,
                "n1": len(x), "n2": len(y), "medias": medias})


# ---------------------------------------------------------------------------
# Proporciones
# ---------------------------------------------------------------------------

def proporcion_una(exitos: int, n: int, p0: float, alfa: float = 0.05,
                   alternativa: str = "two-sided") -> ResultadoPrueba:
    """Una proporción: z si la aproximación normal es válida; binomial exacta si no.

    La regla es n·p₀ ≥ 5 y n·(1−p₀) ≥ 5.  Siempre se devuelven los dos p-valores
    en ``detalles`` y el método realmente usado en ``metodo``.
    """
    _conteos(exitos, n)
    alt, alfa = _alternativa(alternativa), validar_nivel(alfa)
    if not np.isfinite(p0) or not 0 < p0 < 1:
        raise ParametroInvalidoError("La proporción hipotética p₀ debe estar estrictamente entre 0 y 1.", campo="p0")
    observada = exitos / n
    z = (observada - p0) / sqrt(p0*(1-p0)/n)
    p_z = _pvalor(z, alt, stats.norm)
    binomial = stats.binomtest(int(exitos), int(n), p0, alternative=alt)
    p_exacto = float(binomial.pvalue)
    exacta = min(n*p0, n*(1-p0)) < 5
    ic = binomial.proportion_ci(confidence_level=1 - alfa, method="exact" if exacta else "wilson")
    detalles = {"éxitos": exitos, "n": n, "proporcion_observada": observada,
                "proporcion_fallos": (n-exitos)/n, "p_valor_z": p_z, "p_valor_exacto": p_exacto,
                "z": z, "esperados_minimos": min(n*p0, n*(1-p0))}
    extras = {"h_cohen": 2*asin(sqrt(observada)) - 2*asin(sqrt(p0)), "n": n, "proporcion": observada}
    if exacta:
        aviso = (f"n·p₀ = {_es(n*p0)} o n·(1−p₀) = {_es(n*(1-p0))} es menor que 5: la aproximación normal no es "
                 f"fiable y se usa la prueba binomial exacta. Con la aproximación z saldría p = {formatear_p(p_z)}.")
        return _resultado(
            "Binomial exacta · una proporción", z, p_exacto, alfa, intervalo=(ic.low, ic.high),
            detalles=detalles, alternativa=alt, nula=None, exacta=True, simbolo="z (referencia)",
            avisos=[aviso], extras=extras, intervalo_de="p (Clopper–Pearson)")
    return _resultado(
        "z · una proporción", z, p_z, alfa, intervalo=(ic.low, ic.high), detalles=detalles,
        alternativa=alt, nula=_nula("normal", z, alt, etiqueta="z", aproximada=True), simbolo="z",
        extras=extras, intervalo_de="p (Wilson)")


def proporcion_dos(x1: int, n1: int, x2: int, n2: int, alfa: float = 0.05,
                   alternativa: str = "two-sided") -> ResultadoPrueba:
    """Dos proporciones: z agrupada, o exacta de Fisher si algún conteo esperado es < 5."""
    _conteos(x1, n1)
    _conteos(x2, n2)
    alt, alfa = _alternativa(alternativa), validar_nivel(alfa)
    p1, p2, agrupada = x1/n1, x2/n2, (x1+x2)/(n1+n2)
    if agrupada in (0, 1):
        raise CalculoNoConvergenteError(
            "No hay variación entre éxitos y fracasos: las dos muestras son todo éxitos o todo fracasos.",
            sugerencia="La comparación necesita al menos un éxito y un fracaso en total.")
    se0 = sqrt(agrupada*(1-agrupada)*(1/n1+1/n2))
    z = (p1-p2) / se0
    p_z = _pvalor(z, alt, stats.norm)
    tabla = [[int(x1), int(n1-x1)], [int(x2), int(n2-x2)]]
    p_exacto = float(stats.fisher_exact(tabla, alternative=alt)[1])
    esperado_min = min(n1*agrupada, n1*(1-agrupada), n2*agrupada, n2*(1-agrupada))
    exacta = esperado_min < 5
    se = sqrt(p1*(1-p1)/n1 + p2*(1-p2)/n2)
    intervalo = _unilateral(p1-p2, lambda q: float(stats.norm.ppf(q)) * se, alt, alfa, -1.0, 1.0)
    detalles = {"n1": n1, "n2": n2, "proporciones_observadas": (p1, p2), "p_valor_z": p_z,
                "p_valor_exacto": p_exacto, "z": z, "esperados_minimos": esperado_min}
    extras = {"h_cohen": 2*asin(sqrt(p1)) - 2*asin(sqrt(p2)), "n1": n1, "n2": n2, "proporciones": [p1, p2]}
    if exacta:
        aviso = (f"Algún conteo esperado es menor que 5 (mínimo {_es(esperado_min)}): se usa la prueba exacta de "
                 f"Fisher en lugar de la aproximación z (que daría p = {formatear_p(p_z)}). "
                 "El intervalo mostrado es el de Wald y es solo orientativo con muestras tan pequeñas.")
        return _resultado(
            "Exacta de Fisher · dos proporciones", z, p_exacto, alfa, intervalo=intervalo, detalles=detalles,
            alternativa=alt, nula=None, exacta=True, simbolo="z (referencia)", avisos=[aviso],
            extras=extras, intervalo_de="p₁ − p₂ (Wald)")
    return _resultado(
        "z · dos proporciones", z, p_z, alfa, intervalo=intervalo, detalles=detalles, alternativa=alt,
        nula=_nula("normal", z, alt, etiqueta="z", aproximada=True), simbolo="z", extras=extras,
        intervalo_de="p₁ − p₂ (Wald)")


# ---------------------------------------------------------------------------
# Frecuencias
# ---------------------------------------------------------------------------

_AVISO_ESPERADAS = ("Alguna frecuencia esperada es menor que 5: la aproximación χ² puede ser imprecisa. "
                    "Agrupa categorías o interpreta el resultado con prudencia.")


def chi_bondad(observadas: object, esperadas: object, alfa: float = 0.05,
               parametros_estimados: int = 0) -> ResultadoPrueba:
    """Contraste χ² de bondad de ajuste con parámetros estimados opcionales."""
    try:
        obs, esp = np.asarray(observadas, dtype=float), np.asarray(esperadas, dtype=float)
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("Las frecuencias deben ser numéricas.", campo="observadas") from exc
    if obs.ndim != 1 or obs.size < 2:
        raise ParametroInvalidoError("Se necesitan al menos dos categorías.", campo="observadas")
    if esp.shape != obs.shape:
        raise ParametroInvalidoError(
            f"Hay {obs.size} frecuencias observadas y {esp.size} esperadas; deben coincidir.", campo="esperadas")
    if np.any(~np.isfinite(obs)) or np.any(obs < 0):
        raise ParametroInvalidoError("Las frecuencias observadas deben ser números no negativos.", campo="observadas")
    if np.any(~np.isfinite(esp)) or np.any(esp <= 0):
        raise ParametroInvalidoError("Las frecuencias esperadas deben ser positivas.", campo="esperadas")
    if not np.isclose(obs.sum(), esp.sum(), atol=1e-9, rtol=1e-9):
        raise ParametroInvalidoError(
            f"Los totales no coinciden: observadas suman {_es(float(obs.sum()))} y esperadas {_es(float(esp.sum()))}.",
            campo="esperadas", sugerencia="Escala las esperadas para que sumen lo mismo que las observadas.")
    if isinstance(parametros_estimados, bool) or not isinstance(parametros_estimados, (int, np.integer)) \
            or not 0 <= parametros_estimados < len(obs)-1:
        raise ParametroInvalidoError(
            "Los parámetros estimados dejan la prueba sin grados de libertad.", campo="parametros_estimados")
    prueba = stats.chisquare(obs, esp, ddof=int(parametros_estimados))
    gl = len(obs) - 1 - int(parametros_estimados)
    n = float(obs.sum())
    return _resultado(
        "χ² · bondad de ajuste", prueba.statistic, prueba.pvalue, alfa, gl=gl,
        detalles={"residuos": ((obs - esp) / np.sqrt(esp)).tolist()}, alternativa=None,
        nula=_nula("chi2", float(prueba.statistic), None, gl=gl, etiqueta="χ²", aproximada=True),
        simbolo="χ²", avisos=[_AVISO_ESPERADAS if np.any(esp < 5) else ""],
        extras={"w_cohen": sqrt(float(prueba.statistic) / n) if n > 0 else None, "k": int(obs.size), "n": n})


def chi_independencia(tabla: object, alfa: float = 0.05) -> ResultadoPrueba:
    """χ² de independencia; en tablas 2×2 con esperadas < 5 decide con Fisher exacta."""
    try:
        a = np.asarray(tabla, dtype=float)
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("La tabla debe ser numérica y rectangular.", campo="tabla") from exc
    if a.ndim != 2 or min(a.shape) < 2 or np.any(~np.isfinite(a)) or np.any(a < 0):
        raise ParametroInvalidoError("Se necesita una tabla de al menos 2×2 con frecuencias no negativas.", campo="tabla")
    try:
        est, p, gl, esperadas = stats.chi2_contingency(a, correction=False)
    except ValueError as exc:
        raise ParametroInvalidoError(
            "Hay una fila o columna cuyo total es cero.", campo="tabla",
            sugerencia="Elimina la categoría sin observaciones.") from exc
    n = float(a.sum())
    pocas = bool(np.any(esperadas < 5))
    detalles = {"esperadas": esperadas.tolist(), "totales_fila": a.sum(axis=1).tolist(),
                "totales_columna": a.sum(axis=0).tolist(), "p_valor_chi2": float(p)}
    extras = {"v_cramer": sqrt(float(est) / (n * (min(a.shape) - 1))) if n > 0 else None, "n": n}
    nula = _nula("chi2", float(est), None, gl=gl, etiqueta="χ²", aproximada=True)
    enteros = bool(np.all(a == np.round(a)))
    if a.shape == (2, 2) and pocas and enteros:
        p_exacto = float(stats.fisher_exact(a.astype(int))[1])
        detalles["p_valor_exacto"] = p_exacto
        aviso = (f"Tabla 2×2 con alguna frecuencia esperada menor que 5 (mínimo {_es(float(esperadas.min()))}): "
                 f"se decide con la prueba exacta de Fisher. La aproximación χ² daría p = {formatear_p(float(p))}.")
        return _resultado("Exacta de Fisher · tabla 2×2", est, p_exacto, alfa, gl, detalles=detalles,
                          alternativa=None, nula=None, exacta=True, simbolo="χ² (referencia)",
                          avisos=[aviso], extras=extras)
    return _resultado("χ² · independencia", est, p, alfa, gl, detalles=detalles, alternativa=None,
                      nula=nula, simbolo="χ²", avisos=[_AVISO_ESPERADAS if pocas else ""], extras=extras)


# ---------------------------------------------------------------------------
# Varios grupos
# ---------------------------------------------------------------------------

def anova(grupos: list[object], alfa: float = 0.05) -> ResultadoPrueba:
    """ANOVA de una vía con al menos dos grupos y observaciones por grupo."""
    if len(grupos) < 2:
        raise ParametroInvalidoError("ANOVA requiere al menos dos grupos.", campo="grupos")
    muestras = [validar_muestra(g) for g in grupos]
    todos = np.concatenate(muestras)
    if all(_constante(g) for g in muestras):
        raise CalculoNoConvergenteError(
            "No hay variación dentro de ningún grupo: el estadístico F no está definido.", campo="grupos")
    prueba = stats.f_oneway(*muestras)
    gl1, gl2 = len(muestras) - 1, len(todos) - len(muestras)
    ss_total = float(((todos - todos.mean()) ** 2).sum())
    ss_entre = float(sum(len(g) * (float(np.mean(g)) - float(todos.mean())) ** 2 for g in muestras))
    desviaciones = [float(np.std(g, ddof=1)) for g in muestras]
    avisos = [_aviso_normalidad(*map(len, muestras))]
    if min(desviaciones) > 0 and max(desviaciones) / min(desviaciones) > 2:
        avisos.append("Las desviaciones típicas de los grupos difieren en más del doble: el supuesto de "
                      "varianzas iguales es dudoso. Considera Kruskal–Wallis.")
    return _resultado(
        "ANOVA · una vía", prueba.statistic, prueba.pvalue, alfa, gl=gl1,
        detalles={"gl_residual": gl2, "medias": [float(np.mean(g)) for g in muestras],
                  "desviaciones": desviaciones, "tamanos": [len(g) for g in muestras]},
        alternativa=None, nula=_nula("f", float(prueba.statistic), None, gl=gl1, gl2=gl2, etiqueta="F"),
        simbolo="F", avisos=avisos,
        extras={"eta2": ss_entre / ss_total if ss_total > 0 else None, "k": len(muestras), "n": int(len(todos))})


def kruskal(grupos: list[object], alfa: float = 0.05) -> ResultadoPrueba:
    """Prueba de Kruskal–Wallis para dos o más grupos independientes."""
    if len(grupos) < 2:
        raise ParametroInvalidoError("Indica al menos dos grupos.", campo="grupos")
    muestras = [validar_muestra(g) for g in grupos]
    try:
        prueba = stats.kruskal(*muestras)
    except ValueError as exc:
        raise CalculoNoConvergenteError(
            "Todos los valores son iguales: no hay variación entre los rangos.", campo="grupos") from exc
    n, k = int(sum(map(len, muestras))), len(muestras)
    avisos = []
    if min(map(len, muestras)) < 5:
        avisos.append("Algún grupo tiene menos de 5 observaciones: la aproximación χ² del estadístico H es poco precisa.")
    return _resultado(
        "Kruskal–Wallis", prueba.statistic, prueba.pvalue, alfa, gl=k - 1,
        detalles={"medianas": [float(np.median(g)) for g in muestras], "tamanos": [len(g) for g in muestras]},
        alternativa=None,
        nula=_nula("chi2", float(prueba.statistic), None, gl=k - 1, etiqueta="H", aproximada=True),
        simbolo="H", avisos=avisos,
        extras={"epsilon2": float(prueba.statistic) / (n - 1) if n > 1 else None, "k": k, "n": n})


# ---------------------------------------------------------------------------
# Asociación
# ---------------------------------------------------------------------------

def correlacion(x: object, y: object, metodo: str = "pearson", alfa: float = 0.05,
                alternativa: str = "two-sided") -> ResultadoPrueba:
    """Contrasta correlación de Pearson o Spearman entre dos series pareadas."""
    a, b = validar_muestra(x, minimo=3), validar_muestra(y, minimo=3)
    alt, alfa = _alternativa(alternativa), validar_nivel(alfa)
    if len(a) != len(b):
        raise ParametroInvalidoError(
            f"Las dos series deben tener la misma longitud (x tiene {len(a)} valores; y tiene {len(b)}).", campo="y")
    if metodo not in ("pearson", "spearman"):
        raise ParametroInvalidoError("El método de correlación debe ser «pearson» o «spearman».", campo="metodo")
    for serie, campo in ((a, "x"), (b, "y")):
        if _constante(serie):
            raise CalculoNoConvergenteError(
                f"La serie «{campo}» es constante: la correlación no está definida.", campo=campo)
    n = len(a)
    if metodo == "pearson":
        prueba = stats.pearsonr(a, b, alternative=alt)
        intervalo = tuple(map(float, prueba.confidence_interval(confidence_level=1 - alfa))) if n > 3 else None
    else:
        prueba = stats.spearmanr(a, b, alternative=alt)
        intervalo = None
    r = float(prueba.statistic)
    t = r * sqrt((n - 2) / (1 - r*r)) if abs(r) < 1 else None
    avisos = []
    if metodo == "pearson" and n < 30:
        avisos.append("El p-valor de Pearson supone normalidad bivariante; con pocas observaciones "
                      "compara con Spearman.")
    if metodo == "spearman" and n < 10:
        avisos.append("Con menos de 10 pares, la aproximación t del coeficiente de Spearman es poco precisa.")
    simbolo = "r" if metodo == "pearson" else "ρₛ"
    return _resultado(
        f"Correlación de {metodo.title()}", r, prueba.pvalue, alfa, gl=n - 2, intervalo=intervalo,
        detalles={"n": n, "t": t}, alternativa=alt,
        nula=_nula("t", t, alt, gl=n - 2, etiqueta="t", aproximada=(metodo == "spearman")),
        simbolo=simbolo, avisos=avisos, intervalo_de="ρ (Fisher z)" if intervalo else "",
        extras={"r": r, "r2": r * r, "n": n})


# ---------------------------------------------------------------------------
# No paramétricas
# ---------------------------------------------------------------------------

def mann_whitney(a: object, b: object, alfa: float = 0.05,
                 alternativa: str = "two-sided") -> ResultadoPrueba:
    """Prueba de Mann–Whitney para dos muestras independientes.

    Exacta si no hay empates y alguna muestra tiene 8 valores o menos; en otro
    caso, aproximación normal con corrección por empates y continuidad.
    """
    x, y, alt, alfa = validar_muestra(a), validar_muestra(b), _alternativa(alternativa), validar_nivel(alfa)
    n1, n2 = len(x), len(y)
    junto = np.concatenate([x, y])
    if _constante(junto):
        raise CalculoNoConvergenteError("Todos los valores son iguales: no hay rangos que comparar.", campo="datos")
    empates = len(np.unique(junto)) < len(junto)
    exacta = (not empates) and min(n1, n2) <= 8
    prueba = stats.mannwhitneyu(x, y, alternative=alt, method="exact" if exacta else "asymptotic")
    u, p = float(prueba.statistic), float(prueba.pvalue)
    z = None if exacta else _z_desde_p(p, alt, u - n1*n2/2)
    avisos = []
    if exacta:
        avisos.append("Muestras pequeñas sin empates: se usa la distribución exacta de U, por lo que no "
                      "hay una curva continua de referencia.")
    elif empates:
        avisos.append("Hay valores empatados: se usa la aproximación normal con corrección por empates.")
    return _resultado(
        "Mann–Whitney U" + (" (exacta)" if exacta else " (aprox. normal)"), u, p, alfa,
        detalles={"n1": n1, "n2": n2, "z": z, "medianas": [float(np.median(x)), float(np.median(y))]},
        alternativa=alt, nula=_nula("normal", z, alt, etiqueta="z", aproximada=True),
        exacta=exacta, simbolo="U", avisos=avisos,
        extras={"r_biserial": 2*u/(n1*n2) - 1, "n1": n1, "n2": n2,
                "medianas": [float(np.median(x)), float(np.median(y))]})


def wilcoxon(a: object, b: object, alfa: float = 0.05,
             alternativa: str = "two-sided") -> ResultadoPrueba:
    """Prueba de rangos con signo para pares de observaciones.

    Exacta si n ≤ 50 y no hay diferencias nulas ni empates; en otro caso,
    aproximación normal (las diferencias nulas se descartan, método de Wilcoxon).
    """
    x, y, alt, alfa = validar_muestra(a), validar_muestra(b), _alternativa(alternativa), validar_nivel(alfa)
    if len(x) != len(y):
        raise ParametroInvalidoError(
            f"Las muestras pareadas deben tener el mismo tamaño ({len(x)} frente a {len(y)}).", campo="datos2")
    d = x - y
    escala = max(1.0, float(np.max(np.abs(np.concatenate([x, y])))))
    d = np.where(np.abs(d) <= 1e-12 * escala, 0.0, d)
    no_nulas = d[d != 0]
    if no_nulas.size == 0:
        raise CalculoNoConvergenteError(
            "Todas las diferencias entre pares son cero: no hay nada que contrastar.", campo="datos2")
    ceros = int(d.size - no_nulas.size)
    empates = len(np.unique(np.abs(no_nulas))) < no_nulas.size
    exacta = no_nulas.size <= 50 and ceros == 0 and not empates
    prueba = stats.wilcoxon(d, alternative=alt, method="exact" if exacta else "approx")
    rangos = stats.rankdata(np.abs(no_nulas))
    w_mas, w_menos = float(rangos[no_nulas > 0].sum()), float(rangos[no_nulas < 0].sum())
    p = float(prueba.pvalue)
    z = None if exacta else _z_desde_p(p, alt, w_mas - w_menos)
    avisos = []
    if exacta:
        avisos.append("Sin empates ni diferencias nulas: se usa la distribución exacta de W, por lo que "
                      "no hay una curva continua de referencia.")
    else:
        if ceros:
            avisos.append(f"Se descartaron {ceros} pares con diferencia cero (método de Wilcoxon).")
        if empates:
            avisos.append("Hay diferencias empatadas en valor absoluto: se usa la aproximación normal.")
        if no_nulas.size < 10:
            avisos.append("Con menos de 10 diferencias no nulas la aproximación normal es poco precisa.")
    return _resultado(
        "Wilcoxon pareado" + (" (exacta)" if exacta else " (aprox. normal)"), prueba.statistic, p, alfa,
        detalles={"n": int(d.size), "n_efectivo": int(no_nulas.size), "w_mas": w_mas, "w_menos": w_menos, "z": z},
        alternativa=alt, nula=_nula("normal", z, alt, etiqueta="z", aproximada=True),
        exacta=exacta, simbolo="W", avisos=avisos,
        extras={"r_biserial": (w_mas - w_menos) / (w_mas + w_menos), "n": int(d.size),
                "mediana_diferencias": float(np.median(d))})


# ---------------------------------------------------------------------------
# Errores numéricos
# ---------------------------------------------------------------------------

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
