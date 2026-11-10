"""Resumen descriptivo y tabla de frecuencias sin dependencia de Qt."""

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ampu.core.validacion import validar_muestra, validar_probabilidades


@dataclass(frozen=True)
class ResumenDescriptivo:
    """Estadísticos calculados con convención muestral ddof=1."""

    n: int
    media: float
    mediana: float
    modas: tuple[float, ...]
    q1: float
    q3: float
    minimo: float
    maximo: float
    varianza: float
    desviacion: float
    coeficiente_variacion: float | None


def resumir(datos: object) -> ResumenDescriptivo:
    """Obtiene tendencia central, dispersión y cuartiles de una muestra.

    ``coeficiente_variacion`` es None cuando la media es cero. En muestras
    multimodales se devuelven todas las modas ordenadas.
    """
    x = validar_muestra(datos)
    valores, cuenta = np.unique(x, return_counts=True)
    media = float(np.mean(x))
    desviacion = float(np.std(x, ddof=1))
    return ResumenDescriptivo(
        len(x), media, float(np.median(x)), tuple(map(float, valores[cuenta == cuenta.max()])),
        float(np.quantile(x, 0.25)), float(np.quantile(x, 0.75)),
        float(x.min()), float(x.max()), float(np.var(x, ddof=1)), desviacion,
        desviacion / abs(media) if media != 0 else None,
    )


def percentil(datos: object, q: float) -> float:
    """Cuantil empírico en [0,1] con interpolación lineal de NumPy."""
    q = validar_probabilidades(q)
    if isinstance(q, np.ndarray):
        raise ValueError("q debe ser escalar.")
    return float(np.quantile(validar_muestra(datos), q))


def frecuencias(datos: object) -> pd.DataFrame:
    """Tabla ordenada con recuento y frecuencias relativas y acumuladas."""
    x = validar_muestra(datos)
    valores, cuentas = np.unique(x, return_counts=True)
    return pd.DataFrame({
        "Valor": valores,
        "Frecuencia": cuentas,
        "Frecuencia relativa": cuentas / len(x),
        "Acumulada": np.cumsum(cuentas),
        "Relativa acumulada": np.cumsum(cuentas) / len(x),
    })
