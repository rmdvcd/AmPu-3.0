"""Identidades de probabilidad elemental y momentos de variables discretas."""

import numpy as np

from ampu.core.errores import CalculoNoConvergenteError, ParametroInvalidoError


def _probabilidad(p: float) -> float:
    """Valida probabilidades escalares incluidas en [0,1]."""
    if isinstance(p, bool) or not isinstance(p, (int, float, np.number)) or not np.isfinite(p) or not 0 <= p <= 1:
        raise ParametroInvalidoError("La probabilidad debe estar entre 0 y 1.")
    return float(p)


def condicional(interseccion: float, condicion: float) -> float:
    """P(A|B) = P(A∩B)/P(B), con P(B)>0."""
    conjunta, pb = _probabilidad(interseccion), _probabilidad(condicion)
    if pb == 0 or conjunta > pb + 1e-12:
        raise ParametroInvalidoError("Se requiere 0 ≤ P(A∩B) ≤ P(B) y P(B)>0.")
    return conjunta / pb


def independientes(pa: float, pb: float, interseccion: float, tolerancia: float = 1e-10) -> bool:
    """Determina si P(A∩B)≈P(A)P(B) con tolerancia explícita."""
    a, b, ab = map(_probabilidad, (pa, pb, interseccion))
    if ab > min(a, b) + 1e-12 or ab < max(0.0, a + b - 1) - 1e-12 or tolerancia < 0:
        raise ParametroInvalidoError("Probabilidades conjuntas o tolerancia incoherentes.")
    return abs(ab - a*b) <= tolerancia


def probabilidad_total(priores: list[float], condicionales: list[float]) -> float:
    """Ley de probabilidad total sobre una partición exhaustiva."""
    if not priores or len(priores) != len(condicionales):
        raise ParametroInvalidoError("Listas no vacías del mismo tamaño requeridas.")
    p = np.asarray([_probabilidad(v) for v in priores])
    c = np.asarray([_probabilidad(v) for v in condicionales])
    if not np.isclose(p.sum(), 1, atol=1e-12, rtol=0):
        raise ParametroInvalidoError("Las probabilidades de la partición deben sumar uno.")
    return float(p @ c)


def bayes(indice: int, priores: list[float], condicionales: list[float]) -> float:
    """Probabilidad posterior P(B_i|A) a partir de verosimilitudes."""
    total = probabilidad_total(priores, condicionales)
    if isinstance(indice, bool) or not isinstance(indice, int) or not 0 <= indice < len(priores) or total == 0:
        raise ParametroInvalidoError("Índice inválido o evidencia de probabilidad cero.")
    return _probabilidad(priores[indice]) * _probabilidad(condicionales[indice]) / total


def _variable(valores: object, masas: object) -> tuple[np.ndarray, np.ndarray]:
    """Comprueba el soporte finito y una PMF normalizada."""
    try:
        x, p = np.asarray(valores, dtype=float), np.asarray(masas, dtype=float)
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("Valores y masas deben ser numéricos.") from exc
    if x.ndim != 1 or x.size == 0 or p.shape != x.shape or not np.all(np.isfinite(x)) or not np.all(np.isfinite(p)) or np.any(p < 0) or not np.isclose(p.sum(), 1, rtol=0, atol=1e-12):
        raise ParametroInvalidoError("Las masas deben ser no negativas, finitas y sumar uno.")
    return x, p


def esperanza(valores: object, masas: object) -> float:
    """Esperanza de variable discreta finita."""
    x, p = _variable(valores, masas)
    return float(x @ p)


def varianza(valores: object, masas: object) -> float:
    """Segundo momento central de una variable discreta finita."""
    x, p = _variable(valores, masas)
    return float((x - (x @ p))**2 @ p)


def generadora_momentos(t: float, valores: object, masas: object) -> float:
    """MGF M_X(t)=E[exp(tX)], con detección de desbordamiento."""
    if not np.isfinite(t):
        raise ParametroInvalidoError("t debe ser finito.")
    x, p = _variable(valores, masas)
    with np.errstate(over="ignore"):
        resultado = np.exp(t*x) @ p
    if not np.isfinite(resultado):
        raise CalculoNoConvergenteError("La función generadora desborda para este t.")
    return float(resultado)
