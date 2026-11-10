"""Operaciones combinatorias exactas con enteros arbitrarios de Python."""

import math

from ampu.core.errores import ParametroInvalidoError


def _entero(n: int) -> int:
    """Acepta enteros no negativos, pero nunca booleanos ni flotantes."""
    if isinstance(n, bool) or not isinstance(n, int) or n < 0:
        raise ParametroInvalidoError("Se requiere un entero no negativo.")
    return n


def factorial(n: int) -> int:
    """Calcula n! sin desbordamiento de coma flotante."""
    return math.factorial(_entero(n))


def permutaciones(n: int, k: int | None = None) -> int:
    """Permutaciones ordenadas sin repetición de k entre n."""
    n = _entero(n)
    k = n if k is None else _entero(k)
    if k > n:
        raise ParametroInvalidoError("k no puede superar n.")
    return math.perm(n, k)


def combinaciones(n: int, k: int) -> int:
    """Combinaciones sin repetición de k entre n."""
    n, k = _entero(n), _entero(k)
    if k > n:
        raise ParametroInvalidoError("k no puede superar n.")
    return math.comb(n, k)


def permutaciones_repetidas(conteos: list[int]) -> int:
    """Permutaciones distinguibles de un multiconjunto de frecuencias."""
    if not conteos:
        raise ParametroInvalidoError("Indica al menos un conteo.")
    c = [_entero(i) for i in conteos]
    return math.factorial(sum(c)) // math.prod(math.factorial(i) for i in c)
