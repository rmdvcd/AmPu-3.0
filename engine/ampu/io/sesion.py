"""Estado reproducible de la aplicación serializado como JSON seguro."""

import json
import math
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

VERSION_SESION = 1


def _serializar(valor: object) -> object:
    """Convierte estructuras NumPy/pandas comunes en JSON sin código ejecutable."""
    if isinstance(valor, np.ndarray):
        return valor.tolist()
    if isinstance(valor, np.generic):
        return valor.item()
    if isinstance(valor, pd.DataFrame):
        return {"columnas": list(map(str, valor.columns)), "filas": valor.replace({np.nan: None}).values.tolist()}
    raise TypeError(f"No se puede serializar un valor {type(valor).__name__}.")


def _limpiar(valor: object) -> object:
    """Transforma números no finitos en None y estructuras en JSON estándar."""
    if isinstance(valor, pd.DataFrame):
        return _limpiar(_serializar(valor))
    if isinstance(valor, np.ndarray):
        return _limpiar(valor.tolist())
    if isinstance(valor, np.generic):
        return _limpiar(valor.item())
    if isinstance(valor, float) and not math.isfinite(valor):
        return None
    if isinstance(valor, dict):
        return {str(k): _limpiar(v) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_limpiar(v) for v in valor]
    return valor


def guardar_sesion(estado: dict, destino: str | Path) -> Path:
    """Escribe un esquema versionado de forma atómica en la carpeta elegida."""
    if not isinstance(estado, dict):
        raise TypeError("El estado debe ser un diccionario.")
    ruta = Path(destino).with_suffix(".json")
    contenido = json.dumps({"version": VERSION_SESION, "fecha_utc": datetime.now(timezone.utc).isoformat(), "estado": _limpiar(estado)},
                           allow_nan=False, ensure_ascii=False, indent=2)
    temporal: str | None = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=ruta.parent, prefix=".ampu-", suffix=".tmp", delete=False) as archivo:
            temporal = archivo.name
            archivo.write(contenido)
        os.replace(temporal, ruta)
    finally:
        if temporal is not None and os.path.exists(temporal):
            os.unlink(temporal)
    return ruta


def cargar_sesion(origen: str | Path) -> dict:
    """Carga un esquema conocido y rechaza sesiones incompatibles o gigantes."""
    ruta = Path(origen)
    if ruta.stat().st_size > 25_000_000:
        raise ValueError("La sesión supera el máximo de 25 MB.")
    with ruta.open(encoding="utf-8") as archivo:
        paquete = json.load(archivo)
    if not isinstance(paquete, dict) or paquete.get("version") != VERSION_SESION or not isinstance(paquete.get("estado"), dict):
        raise ValueError("Formato de sesión desconocido o versión incompatible.")
    return paquete["estado"]
