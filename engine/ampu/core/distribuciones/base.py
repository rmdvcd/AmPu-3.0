"""Interfaz uniforme de distribuciones y adaptador univariante a SciPy."""

from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import Any

import numpy as np

from ampu.core.errores import SoporteError
from ampu.core.validacion import (
    Parametro, validar_evento, validar_parametros, validar_probabilidades,
    validar_semilla, validar_tamano,
)


def _salida(valor: Any) -> float | np.ndarray:
    """Conserva vectores; convierte escalares NumPy en números Python."""
    a = np.asarray(valor)
    return float(a) if a.ndim == 0 else a


class Distribucion(ABC):
    """Contrato público del motor; momentos multivariados son vectores."""

    nombre: str
    clave: str
    parametros: list[Parametro]
    discreta: bool
    dimensionalidad: str = "univariante"

    @abstractmethod
    def pmf(self, x: object, **params: object) -> float | np.ndarray:
        """Calcula la masa (únicamente distribuciones discretas)."""

    @abstractmethod
    def pdf(self, x: object, **params: object) -> float | np.ndarray:
        """Calcula la densidad (únicamente distribuciones continuas)."""

    @abstractmethod
    def cdf(self, x: object, **params: object) -> float | np.ndarray:
        """Calcula la distribución acumulada; ver convención multivariada."""

    @abstractmethod
    def ppf(self, q: object, **params: object) -> float | np.ndarray:
        """Devuelve cuantiles (marginales en modelos multivariados)."""

    @abstractmethod
    def media(self, **params: object) -> float | np.ndarray:
        """Devuelve el primer momento, o su vector marginal."""

    @abstractmethod
    def varianza(self, **params: object) -> float | np.ndarray:
        """Devuelve la varianza, o su vector marginal."""

    def desviacion(self, **params: object) -> float | np.ndarray:
        """Calcula la desviación estándar usando las varianzas del modelo."""
        return _salida(np.sqrt(self.varianza(**params)))

    @abstractmethod
    def rvs(self, size: int, seed: int | None = None, **params: object) -> np.ndarray:
        """Genera muestras reproducibles con ``numpy.random.default_rng``."""

    @abstractmethod
    def soporte(self, **params: object) -> tuple[float, float]:
        """Intervalo de soporte (marginal por componente en multivariadas)."""

    def validar(self, **params: object) -> dict:
        """Valida con los metadatos; subclases pueden agregar reglas cruzadas."""
        return validar_parametros(self.parametros, params)


class ScipyUnivariante(Distribucion):
    """Adapta distribuciones congeladas de SciPy al contrato AmPu."""

    def __init__(
        self, clave: str, nombre: str, discreta: bool,
        parametros: list[Parametro], fabrica: Callable[..., Any],
        regla: Callable[[dict], None] | None = None,
    ) -> None:
        """Guarda fábrica SciPy y metadatos inmutables a nivel de instancia."""
        self.clave, self.nombre = clave, nombre
        self.discreta, self.parametros = discreta, parametros
        self._fabrica, self._regla = fabrica, regla

    def validar(self, **params: object) -> dict:
        """Aplica validación elemental y coherencia entre parámetros."""
        return validar_parametros(self.parametros, params, self._regla)

    def _modelo(self, params: dict) -> Any:
        """Congela el modelo SciPy después de comprobar argumentos."""
        return self._fabrica(**self.validar(**params))

    def pmf(self, x: object, **params: object) -> float | np.ndarray:
        """Evalúa la función de masa en enteros; 0 fuera del soporte."""
        if not self.discreta:
            raise SoporteError(f"{self.nombre} es continua: usa pdf.")
        return _salida(self._modelo(params).pmf(validar_evento(x)))

    def pdf(self, x: object, **params: object) -> float | np.ndarray:
        """Evalúa la función de densidad; 0 fuera del soporte."""
        if self.discreta:
            raise SoporteError(f"{self.nombre} es discreta: usa pmf.")
        return _salida(self._modelo(params).pdf(validar_evento(x)))

    def cdf(self, x: object, **params: object) -> float | np.ndarray:
        """Calcula la probabilidad acumulada en x."""
        return _salida(self._modelo(params).cdf(validar_evento(x)))

    def ppf(self, q: object, **params: object) -> float | np.ndarray:
        """Calcula el cuantil en [0, 1], incluso extremos infinitos."""
        return _salida(self._modelo(params).ppf(validar_probabilidades(q)))

    def media(self, **params: object) -> float:
        """Primer momento teórico de SciPy."""
        return float(self._modelo(params).mean())

    def varianza(self, **params: object) -> float:
        """Varianza teórica de SciPy (inf si no existe)."""
        return float(self._modelo(params).var())

    def rvs(self, size: int, seed: int | None = None, **params: object) -> np.ndarray:
        """Simula observaciones con semilla local sin afectar RNG global."""
        size, seed = validar_tamano(size), validar_semilla(seed)
        return np.asarray(self._modelo(params).rvs(size=size, random_state=np.random.default_rng(seed)))

    def soporte(self, **params: object) -> tuple[float, float]:
        """Límites reales del soporte del modelo congelado."""
        a, b = self._modelo(params).support()
        return float(a), float(b)

    def cola_inclusiva(self, x: object, **params: object) -> float | np.ndarray:
        """P(X≥x); para discretas evita cancelar 1−CDF(x−1)."""
        evento = validar_evento(x)
        limite = np.ceil(evento) - 1 if self.discreta else evento
        return _salida(self._modelo(params).sf(limite))
