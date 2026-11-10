"""Identidades de probabilidad elemental y momentos de variables discretas.

Todas las funciones aceptan ``float`` o ``fractions.Fraction``.  Con fracciones
el resultado es **exacto** (otra fracción); con decimales, en coma flotante.
Hay una única tolerancia, ``TOLERANCIA``, para decidir si unas probabilidades
«suman uno» o si dos sucesos «son independientes» cuando se trabaja con
decimales; con fracciones la comparación es exacta.
"""

from __future__ import annotations

import math
from fractions import Fraction

import numpy as np

from ampu.core.errores import CalculoNoConvergenteError, ParametroInvalidoError

TOLERANCIA = 1e-9


def _es_exacto(*valores) -> bool:
    return all(isinstance(v, (Fraction, int)) and not isinstance(v, bool) for v in valores)


def _probabilidad(p, nombre: str = "La probabilidad"):
    """Valida probabilidades escalares incluidas en [0,1]; conserva las fracciones."""
    if isinstance(p, Fraction):
        if not 0 <= p <= 1:
            raise ParametroInvalidoError(f"{nombre} debe estar entre 0 y 1.")
        return p
    if isinstance(p, bool) or not isinstance(p, (int, float, np.number)) or not np.isfinite(p) or not 0 <= p <= 1:
        raise ParametroInvalidoError(f"{nombre} debe estar entre 0 y 1.")
    return float(p)


def _tolerancia(*valores) -> float:
    """Cero si todo es exacto; ``TOLERANCIA`` si interviene coma flotante."""
    return 0 if _es_exacto(*valores) else TOLERANCIA


def suma_uno(masas) -> bool:
    """¿Suman uno? Exacto con fracciones; con ``TOLERANCIA`` en decimales."""
    masas = list(masas)
    if _es_exacto(*masas):
        return sum(masas, Fraction(0)) == 1
    return abs(math.fsum(float(m) for m in masas) - 1.0) <= TOLERANCIA


def condicional(interseccion, condicion):
    """P(A|B) = P(A∩B)/P(B), con P(B)>0."""
    conjunta, pb = _probabilidad(interseccion, "P(A ∩ B)"), _probabilidad(condicion, "P(B)")
    if pb == 0:
        raise ParametroInvalidoError("P(B) debe ser mayor que 0 para condicionar.", campo="condicion")
    if conjunta > pb + _tolerancia(conjunta, pb):
        raise ParametroInvalidoError("P(A ∩ B) no puede superar P(B).", campo="interseccion")
    return min(conjunta, pb) / pb


def independientes(pa, pb, interseccion, tolerancia: float | None = None) -> bool:
    """Determina si P(A∩B) = P(A)·P(B) (exacto con fracciones; con tolerancia en decimales)."""
    a, b, ab = (_probabilidad(v) for v in (pa, pb, interseccion))
    tol = _tolerancia(a, b, ab) if tolerancia is None else tolerancia
    if tol < 0:
        raise ParametroInvalidoError("La tolerancia no puede ser negativa.")
    holgura = _tolerancia(a, b, ab)
    if ab > min(a, b) + holgura or ab < max(0, a + b - 1) - holgura:
        raise ParametroInvalidoError(
            "Probabilidades incoherentes: se requiere máx(0, P(A)+P(B)−1) ≤ P(A ∩ B) ≤ mín(P(A), P(B)).")
    return abs(ab - a*b) <= tol


def probabilidad_total(priores: list, condicionales: list):
    """Ley de probabilidad total sobre una partición exhaustiva."""
    if not priores or len(priores) != len(condicionales):
        raise ParametroInvalidoError("Se necesitan listas no vacías del mismo tamaño.")
    p = [_probabilidad(v, "Cada probabilidad previa") for v in priores]
    c = [_probabilidad(v, "Cada verosimilitud") for v in condicionales]
    if not suma_uno(p):
        raise ParametroInvalidoError(
            "Las probabilidades de la partición deben sumar uno.",
            sugerencia="Si son tercios o séptimos, escríbelas como fracción (1/3) para que la suma sea exacta.")
    if _es_exacto(*p, *c):
        return sum((a * b for a, b in zip(p, c)), Fraction(0))
    return math.fsum(float(a) * float(b) for a, b in zip(p, c))


def bayes(indice: int, priores: list, condicionales: list):
    """Probabilidad posterior P(B_i|A) a partir de verosimilitudes."""
    total = probabilidad_total(priores, condicionales)
    if isinstance(indice, bool) or not isinstance(indice, int) or not 0 <= indice < len(priores):
        raise ParametroInvalidoError("Índice de hipótesis inválido.")
    if total == 0:
        raise ParametroInvalidoError("La evidencia tiene probabilidad cero: no se puede condicionar a ella.")
    return _probabilidad(priores[indice]) * _probabilidad(condicionales[indice]) / total


def _variable(valores: object, masas: object) -> tuple[np.ndarray, np.ndarray]:
    """Comprueba el soporte finito y una PMF normalizada."""
    try:
        x = np.asarray([float(v) for v in valores], dtype=float)
        p = np.asarray([float(v) for v in masas], dtype=float)
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("Valores y masas deben ser numéricos.") from exc
    if x.ndim != 1 or x.size == 0 or p.shape != x.shape:
        raise ParametroInvalidoError("Cada valor necesita su probabilidad (listas del mismo tamaño).")
    if not np.all(np.isfinite(x)) or not np.all(np.isfinite(p)) or np.any(p < 0):
        raise ParametroInvalidoError("Las masas deben ser finitas y no negativas.", campo="masas")
    if not suma_uno(list(masas)):
        raise ParametroInvalidoError(
            "Las masas de probabilidad deben sumar uno.", campo="masas",
            sugerencia="Si son tercios o séptimos, escríbelas como fracción (1/3).")
    return x, p


def momentos_exactos(valores: list, masas: list) -> tuple[Fraction, Fraction] | None:
    """Esperanza y varianza como fracciones si todos los datos son exactos; si no, ``None``."""
    valores, masas = list(valores), list(masas)
    if not _es_exacto(*valores, *masas) or len(valores) != len(masas) or not valores:
        return None
    if any(m < 0 for m in masas) or sum(masas, Fraction(0)) != 1:
        return None
    media = sum((Fraction(x) * m for x, m in zip(valores, masas)), Fraction(0))
    var = sum(((Fraction(x) - media) ** 2 * m for x, m in zip(valores, masas)), Fraction(0))
    return media, var


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
        raise ParametroInvalidoError("t debe ser finito.", campo="t")
    x, p = _variable(valores, masas)
    with np.errstate(over="ignore"):
        resultado = np.exp(t*x) @ p
    if not np.isfinite(resultado):
        raise CalculoNoConvergenteError(
            "La función generadora de momentos desborda para este valor de t.", campo="t",
            sugerencia="Prueba con un t más cercano a cero.")
    return float(resultado)
