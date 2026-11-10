"""Resumen descriptivo y tabla de frecuencias."""

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


def modas(datos: object) -> tuple[float, ...]:
    """Valores más repetidos, ordenados.

    Si ningún valor se repite la muestra **no tiene moda** y se devuelve una
    tupla vacía (antes se devolvían todos los datos como «modas»).
    """
    x = validar_muestra(datos)
    valores, cuenta = np.unique(x, return_counts=True)
    if cuenta.max() == 1:
        return ()
    return tuple(map(float, valores[cuenta == cuenta.max()]))


@dataclass(frozen=True)
class DiagramaCaja:
    """Cinco números y bigotes de Tukey.

    Los bigotes terminan en el **dato** más extremo que queda dentro de las
    vallas Q1 − 1,5·IQR y Q3 + 1,5·IQR, no en la valla misma.
    """

    minimo: float
    q1: float
    mediana: float
    q3: float
    maximo: float
    valla_inferior: float
    valla_superior: float
    bigote_inferior: float
    bigote_superior: float
    atipicos: tuple[float, ...]


def caja(datos: object) -> DiagramaCaja:
    """Calcula el diagrama de caja con la convención de Tukey."""
    x = np.sort(validar_muestra(datos))
    q1, mediana, q3 = (float(v) for v in np.quantile(x, [0.25, 0.5, 0.75]))
    iqr = q3 - q1
    inferior, superior = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    dentro = x[(x >= inferior) & (x <= superior)]
    fuera = x[(x < inferior) | (x > superior)]
    return DiagramaCaja(
        float(x[0]), q1, mediana, q3, float(x[-1]), inferior, superior,
        float(dentro[0]) if dentro.size else q1, float(dentro[-1]) if dentro.size else q3,
        tuple(map(float, fuera)),
    )


def resumir(datos: object) -> ResumenDescriptivo:
    """Obtiene tendencia central, dispersión y cuartiles de una muestra.

    ``coeficiente_variacion`` es None cuando la media es cero. En muestras
    multimodales se devuelven todas las modas ordenadas; si ningún valor se
    repite, ``modas`` queda vacía.
    """
    x = validar_muestra(datos)
    media = float(np.mean(x))
    desviacion = float(np.std(x, ddof=1))
    return ResumenDescriptivo(
        len(x), media, float(np.median(x)), modas(x),
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
