"""Reglas comunes para parámetros, observaciones, semillas y probabilidades.

El motor no deja pasar NaN, booleanos como números ni parámetros desconocidos.
Los eventos fuera del soporte *escalar* se delegan a SciPy para que PMF/PDF=0.
"""

from dataclasses import dataclass
from numbers import Integral, Real
from typing import Callable, Literal, Mapping, Sequence

import numpy as np

from .errores import ParametroInvalidoError

Tipo = Literal["entero", "real", "vector_entero", "vector_real"]


@dataclass(frozen=True)
class Parametro:
    """Metadatos de un parámetro y fuente única para formulario/validación.

    Attributes:
        nombre: Identificador de la API.
        tipo: Tipo de dato o vector homogéneo.
        minimo: Menor valor permitido por elemento (opcional).
        maximo: Mayor valor permitido por elemento (opcional).
        descripcion: Texto explicativo visible en el formulario.
        default: Valor inicial; puede ser una tupla para vectores.
        incluir_minimo: Si el mínimo es estricto o inclusivo.
        incluir_maximo: Si el máximo es estricto o inclusivo.
    """

    nombre: str
    tipo: Tipo
    minimo: float | None = None
    maximo: float | None = None
    descripcion: str = ""
    default: int | float | tuple[int | float, ...] | None = None
    incluir_minimo: bool = True
    incluir_maximo: bool = True

    def validar(self, valor: object) -> int | float | tuple[int | float, ...]:
        """Normaliza un valor o lanza ``ParametroInvalidoError``."""
        vector = self.tipo.startswith("vector_")
        if vector:
            if isinstance(valor, (str, bytes)) or not isinstance(valor, (list, tuple, np.ndarray)):
                raise ParametroInvalidoError(f"{self.nombre}: introduce valores separados por comas.")
            try:
                elementos = list(valor)
            except (TypeError, ValueError) as exc:
                raise ParametroInvalidoError(f"{self.nombre}: vector inválido.") from exc
            if len(elementos) < 2:
                raise ParametroInvalidoError(f"{self.nombre}: el vector necesita al menos dos elementos.")
            return tuple(self._escalar(v) for v in elementos)
        return self._escalar(valor)

    def _escalar(self, valor: object) -> int | float:
        entero = self.tipo.endswith("entero")
        if isinstance(valor, (bool, np.bool_)) or not isinstance(valor, Real):
            raise ParametroInvalidoError(f"{self.nombre}: se requiere un número {'entero' if entero else 'real'}.")
        if not np.isfinite(float(valor)) or (entero and not float(valor).is_integer()):
            raise ParametroInvalidoError(f"{self.nombre}: valor no finito o no entero.")
        numero = int(valor) if entero else float(valor)
        if self.minimo is not None and (numero < self.minimo if self.incluir_minimo else numero <= self.minimo):
            op = "≥" if self.incluir_minimo else ">"
            raise ParametroInvalidoError(f"{self.nombre} debe ser {op} {self.minimo:g}.")
        if self.maximo is not None and (numero > self.maximo if self.incluir_maximo else numero >= self.maximo):
            op = "≤" if self.incluir_maximo else "<"
            raise ParametroInvalidoError(f"{self.nombre} debe ser {op} {self.maximo:g}.")
        return numero


def validar_parametros(
    esquema: Sequence[Parametro], valores: Mapping[str, object],
    regla: Callable[[dict], None] | None = None,
) -> dict:
    """Valida un diccionario con el esquema, aplica valores por defecto y coherencia.

    Args:
        esquema: Metadatos de todos los parámetros.
        valores: Argumentos introducidos por el consumidor.
        regla: Regla entre parámetros que debe lanzar error de dominio.

    Returns:
        Diccionario de valores normalizados.
    """
    permitidos = {p.nombre for p in esquema}
    desconocidos = set(valores) - permitidos
    if desconocidos:
        raise ParametroInvalidoError(f"Parámetros desconocidos: {', '.join(sorted(desconocidos))}.")
    salida = {}
    for param in esquema:
        valor = valores.get(param.nombre, param.default)
        if valor is None:
            raise ParametroInvalidoError(f"Falta el parámetro {param.nombre}.")
        salida[param.nombre] = param.validar(valor)
    if regla:
        regla(salida)
    return salida


def exigir(condicion: bool, mensaje: str) -> None:
    """Rechaza combinaciones incoherentes de parámetros."""
    if not condicion:
        raise ParametroInvalidoError(mensaje)


def validar_probabilidades(q: object) -> float | np.ndarray:
    """Acepta cuantiles en [0, 1]; preserva escalares y vectores."""
    try:
        a = np.asarray(q)
        if a.dtype.kind not in "iuf" or np.any(~np.isfinite(a)) or np.any((a < 0) | (a > 1)):
            raise ValueError
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("El cuantil q debe estar entre 0 y 1.") from exc
    return float(a) if a.ndim == 0 else a.astype(float)


def validar_semilla(seed: int | None) -> int | None:
    """Comprueba la semilla del generador PCG64 de NumPy."""
    if seed is not None and (isinstance(seed, bool) or not isinstance(seed, Integral) or seed < 0 or seed >= 2**64):
        raise ParametroInvalidoError("La semilla debe ser un entero de 0 a 2⁶⁴−1.")
    return int(seed) if seed is not None else None


def validar_tamano(size: int) -> int:
    """Limita el número de sorteos para evitar asignaciones accidentales masivas."""
    if isinstance(size, bool) or not isinstance(size, Integral) or not 1 <= size <= 1_000_000:
        raise ParametroInvalidoError("El tamaño debe ser un entero de 1 a 1 000 000.")
    return int(size)


def validar_muestra(datos: object, minimo: int = 2) -> np.ndarray:
    """Devuelve una muestra numérica finita de longitud suficiente."""
    try:
        a = np.asarray(datos, dtype=float)
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("La muestra debe contener números.") from exc
    if a.ndim != 1 or a.size < minimo or np.any(~np.isfinite(a)):
        raise ParametroInvalidoError(f"Se necesitan al menos {minimo} observaciones finitas en una columna.")
    return a


def validar_nivel(nivel: float) -> float:
    """Verifica una probabilidad estrictamente comprendida entre cero y uno."""
    if isinstance(nivel, bool) or not isinstance(nivel, Real) or not np.isfinite(nivel) or not 0 < nivel < 1:
        raise ParametroInvalidoError("El nivel debe estar estrictamente entre 0 y 1.")
    return float(nivel)


def validar_evento(x: object) -> float | np.ndarray:
    """Verifica que las observaciones sean numéricas y sin NaN (±∞ sí vale)."""
    try:
        a = np.asarray(x)
        if a.dtype.kind not in "iuf" or np.any(np.isnan(a)):
            raise ValueError
    except (TypeError, ValueError) as exc:
        raise ParametroInvalidoError("x debe contener valores numéricos válidos.") from exc
    return float(a) if a.ndim == 0 else a.astype(float)
