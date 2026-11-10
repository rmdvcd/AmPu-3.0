"""Operaciones combinatorias exactas con enteros arbitrarios de Python.

Los resultados se calculan exactos mientras quepan en ``MAX_DIGITOS`` cifras.
Por encima de ese tamaño se devuelve una ``Magnitud`` (mantisa × 10^exponente)
obtenida con log-gamma de precisión arbitraria: el motor nunca se queda
calculando un entero de millones de cifras ni falla con un error interno.
"""

from __future__ import annotations

import math
import sys
from dataclasses import dataclass

from ampu.core.errores import FueraDeAlcanceError, ParametroInvalidoError

MAX_DIGITOS = 10_000          # cifras máximas de un resultado exacto
MAX_ARGUMENTO = 10**15        # mayor n admitido (enteros exactos en coma flotante)
MAX_PASOS = 2_000_000         # cota de trabajo para productos exactos

# Python limita por defecto la conversión int→str a 4300 cifras; AmPu fija su
# propio tope, declarado, en lugar de dejar pasar un error interno en inglés.
if hasattr(sys, "set_int_max_str_digits"):
    sys.set_int_max_str_digits(max(sys.get_int_max_str_digits(), MAX_DIGITOS + 100))


@dataclass(frozen=True)
class Magnitud:
    """Aproximación mantisa × 10^exponente de un entero demasiado grande."""

    mantisa: float
    exponente: int

    @property
    def digitos(self) -> int:
        return self.exponente + 1

    def __str__(self) -> str:
        return f"{self.mantisa:.10f}".replace(".", ",") + f" × 10^{self.exponente}"


def _entero(n: int, nombre: str = "n") -> int:
    """Acepta enteros no negativos, pero nunca booleanos ni flotantes."""
    if isinstance(n, bool) or not isinstance(n, int) or n < 0:
        raise ParametroInvalidoError(f"«{nombre}» debe ser un entero no negativo.", campo=nombre)
    if n > MAX_ARGUMENTO:
        raise FueraDeAlcanceError(
            f"«{nombre}» supera el máximo admitido (10^15).", campo=nombre,
            sugerencia="Usa un valor menor; por encima de 10^15 los enteros dejan de representarse con exactitud.")
    return n


try:
    import mpmath as _mp
except ImportError:  # pragma: no cover - mpmath forma parte de las dependencias
    _mp = None

_PRECISION_BITS = 220  # ≈ 66 cifras: suficiente para log10(n!) con n ≤ 10^15


def _log10_factorial(n: int):
    """log10(n!) con precisión arbitraria (mpmath) o con lgamma como respaldo."""
    if _mp is None:  # pragma: no cover
        return math.lgamma(n + 1) / math.log(10)
    return _mp.loggamma(n + 1) / _mp.log(10)


def _magnitud(log10) -> Magnitud:
    if _mp is None:  # pragma: no cover
        exponente = math.floor(log10)
        mantisa = 10 ** (log10 - exponente)
    else:
        exponente = int(_mp.floor(log10))
        mantisa = float(_mp.power(10, log10 - exponente))
    if mantisa >= 10:  # redondeo en el borde
        mantisa, exponente = mantisa / 10, exponente + 1
    return Magnitud(mantisa, exponente)


def _con_precision(funcion):
    """Ejecuta toda la aritmética de logaritmos con ``_PRECISION_BITS`` bits."""
    import functools

    @functools.wraps(funcion)
    def envoltura(*args, **kwargs):
        if _mp is None:  # pragma: no cover
            return funcion(*args, **kwargs)
        with _mp.workprec(_PRECISION_BITS):
            return funcion(*args, **kwargs)
    return envoltura


def _exacto_o_magnitud(log10, calcular, pasos: int):
    """Devuelve el entero exacto si es razonable; si no, su orden de magnitud."""
    if float(log10) < MAX_DIGITOS - 1 and pasos <= MAX_PASOS:
        return calcular()
    return _magnitud(log10)


@_con_precision
def factorial(n: int) -> int | Magnitud:
    """Calcula n! exacto, o su magnitud si supera ``MAX_DIGITOS`` cifras."""
    n = _entero(n)
    return _exacto_o_magnitud(_log10_factorial(n), lambda: math.factorial(n), n)


@_con_precision
def permutaciones(n: int, k: int | None = None) -> int | Magnitud:
    """Permutaciones ordenadas sin repetición de k entre n."""
    n = _entero(n)
    k = n if k is None else _entero(k, "k")
    if k > n:
        raise ParametroInvalidoError(f"k = {k} no puede superar n = {n}.", campo="k")
    return _exacto_o_magnitud(_log10_factorial(n) - _log10_factorial(n - k), lambda: math.perm(n, k), k)


@_con_precision
def combinaciones(n: int, k: int) -> int | Magnitud:
    """Combinaciones sin repetición de k entre n."""
    n, k = _entero(n), _entero(k, "k")
    if k > n:
        raise ParametroInvalidoError(f"k = {k} no puede superar n = {n}.", campo="k")
    log10 = _log10_factorial(n) - _log10_factorial(k) - _log10_factorial(n - k)
    return _exacto_o_magnitud(log10, lambda: math.comb(n, k), min(k, n - k))


@_con_precision
def permutaciones_repetidas(conteos: list[int]) -> int | Magnitud:
    """Permutaciones distinguibles de un multiconjunto de frecuencias."""
    if not conteos:
        raise ParametroInvalidoError("Indica al menos un conteo.", campo="conteos")
    c = [_entero(i, "conteos") for i in conteos]
    total = sum(c)
    _entero(total, "conteos")
    log10 = _log10_factorial(total) - sum(_log10_factorial(i) for i in c)

    def calcular() -> int:
        return math.factorial(total) // math.prod(math.factorial(i) for i in c)

    # El paso intermedio (total!) puede ser enorme aunque el cociente sea pequeño.
    if float(_log10_factorial(total)) >= 5 * MAX_DIGITOS:
        return _magnitud(log10)
    return _exacto_o_magnitud(log10, calcular, total)
