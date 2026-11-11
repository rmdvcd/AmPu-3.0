"""Servidor local de AmPu 3.1 · laboratorio de probabilidad y estadística.

El módulo expone una API JSON pequeña y explícita sobre el motor estadístico
``ampu`` (NumPy/SciPy/Pandas).  El frontend es una aplicación web estática que
se sirve desde ``frontend/`` y funciona sin conexión a Internet.

Decisiones de diseño relevantes:

* Toda la validación de dominio y todo el cálculo viven en ``ampu.core``.
  Aquí solo se leen las entradas (con el analizador único ``ampu.core.entrada``),
  se serializa de forma segura (±∞, NaN) y se preparan las visualizaciones.
* Los números viajan **sin redondear**: el formato es asunto de la interfaz.
* Cada error lleva ``tipo`` (sintaxis, dominio, ambiguedad, timeout,
  fuera_de_alcance), ``campo`` culpable y ``sugerencia`` de recuperación.
* Ninguna ruta evalúa código enviado por el cliente (sin ``eval``/``exec``).
* Los recursos de KaTeX y la teoría viajan con el paquete, de modo que la app
  es realmente portable y funciona sin CDN.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import shutil
import sys
import tempfile
import threading
import time
import unicodedata
from datetime import datetime, timezone
from fractions import Fraction
from functools import lru_cache
from pathlib import Path

# ---------------------------------------------------------------------------
# Rutas del paquete y del motor
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
STATIC_DIR = FRONTEND_DIR / "static"


def _primera_existente(*rutas: Path) -> Path | None:
    """Devuelve la primera carpeta existente (compatible con PyInstaller)."""
    for ruta in rutas:
        if ruta and ruta.exists():
            return ruta
    return None


_MEIPASS = Path(getattr(sys, "_MEIPASS", BASE_DIR))
ENGINE_DIR = _primera_existente(
    _MEIPASS / "engine",
    BASE_DIR / "engine",
    BASE_DIR / "build_temp" / "engine",
    BASE_DIR.parent / "AmPu 3.1" / "src",
)
VENDOR_DIR = _primera_existente(_MEIPASS / "vendor", BASE_DIR / "vendor")

if ENGINE_DIR is None:
    raise SystemExit(
        "No se encontró el motor AmPu. Esperaba las carpetas 'engine/' o "
        "'build_temp/engine/' junto a app.py."
    )
for _ruta in (str(ENGINE_DIR), *([str(VENDOR_DIR)] if VENDOR_DIR else [])):
    if _ruta not in sys.path:
        sys.path.insert(0, _ruta)

from flask import Flask, after_this_request, g, jsonify, request, send_file, send_from_directory  # noqa: E402
from werkzeug.exceptions import HTTPException  # noqa: E402

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from scipy import stats  # noqa: E402

from ampu import __version__ as MOTOR_VERSION  # noqa: E402
from ampu.core.distribuciones import catalogo, obtener  # noqa: E402
from ampu.core.distribuciones.tabla import analizar  # noqa: E402
from ampu.core import entrada  # noqa: E402
from ampu.core.errores import (  # noqa: E402
    EntradaInvalidaError, ErrorAmPu, FueraDeAlcanceError, ParametroInvalidoError, TiempoExcedidoError,
)
from ampu.core.estadistica import combinatoria, descriptiva  # noqa: E402
from ampu.core.estadistica import inferencia as inf  # noqa: E402
from ampu.core.estadistica import probabilidad as prob  # noqa: E402
from ampu.core.estadistica import regresion as reg  # noqa: E402
from ampu.core.muestreo import aleatorio as muestreo_aleatorio  # noqa: E402
from ampu.core.muestreo.diseno import ejecutar_diseno  # noqa: E402
from ampu.core.simulacion import montecarlo  # noqa: E402
from ampu.core.validacion import validar_nivel  # noqa: E402
from ampu.docs.teoria import leer_teoria, listar_teoria  # noqa: E402
from ampu.io.servicio import ServicioExportacion  # noqa: E402

import markdown  # noqa: E402

VERSION_APP = "3.2.0"
DOCS_DIR = ENGINE_DIR / "ampu" / "docs"
TEORIA_DIR = DOCS_DIR / "teoria"
RENDER_DIR = DOCS_DIR / "render"
IMAGENES_DIR = DOCS_DIR / "imagenes"

# ---------------------------------------------------------------------------
# Aplicación
# ---------------------------------------------------------------------------

app = Flask(
    __name__,
    static_folder=str(STATIC_DIR),
    static_url_path="/static",
    template_folder=str(FRONTEND_DIR),
)
app.config.update(
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,
    JSON_SORT_KEYS=False,
    SEND_FILE_MAX_AGE_DEFAULT=0,
)
app.json.ensure_ascii = False
app.json.sort_keys = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ampu.web")


# ---------------------------------------------------------------------------
# Seguridad de un servidor local y plazo de cálculo
# ---------------------------------------------------------------------------

LIMITE_SEGUNDOS = float(os.environ.get("AMPU_LIMITE_SEGUNDOS", "20"))
_HOSTS_LOCALES = {"localhost", "127.0.0.1", "::1", "[::1]"}


def _hosts_permitidos() -> set[str] | None:
    """Nombres de host aceptados; ``None`` desactiva la comprobación (AMPU_HOSTS_PERMITIDOS=*)."""
    extra = os.environ.get("AMPU_HOSTS_PERMITIDOS", "").strip()
    if extra == "*":
        return None
    permitidos = set(_HOSTS_LOCALES)
    permitidos.update(h.strip().lower() for h in extra.split(",") if h.strip())
    anfitrion = os.environ.get("AMPU_HOST", "").strip().lower()
    if anfitrion and anfitrion not in {"0.0.0.0", "::"}:
        permitidos.add(anfitrion)
    return permitidos


def _nombre_host(valor: str) -> str:
    valor = (valor or "").strip().lower()
    if valor.startswith("["):  # IPv6 con corchetes
        return valor.split("]")[0] + "]"
    return valor.rsplit(":", 1)[0] if ":" in valor else valor


@app.before_request
def _proteger_y_cronometrar():
    """Rechaza peticiones dirigidas a otro host (DNS rebinding) u originadas en otro sitio."""
    g.inicio = time.monotonic()
    g.plazo = g.inicio + LIMITE_SEGUNDOS
    permitidos = _hosts_permitidos()
    if permitidos is None:
        return None
    if _nombre_host(request.host) not in permitidos:
        return _error("Host no permitido. AmPu solo atiende peticiones a esta máquina.", 403, tipo="seguridad",
                      sugerencia="Abre AmPu en http://127.0.0.1 o añade el nombre a AMPU_HOSTS_PERMITIDOS.")
    origen = request.headers.get("Origin")
    if origen and request.method not in {"GET", "HEAD", "OPTIONS"}:
        destino = re.sub(r"^https?://", "", origen.strip().lower())
        if destino != request.host.lower():
            return _error("Origen no permitido: la petición procede de otro sitio web.", 403, tipo="seguridad")
    return None


_CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; "
    "object-src 'none'; base-uri 'self'; form-action 'self'"
)


@app.after_request
def _cabeceras_seguridad(respuesta):
    respuesta.headers.setdefault("X-Content-Type-Options", "nosniff")
    respuesta.headers.setdefault("Referrer-Policy", "no-referrer")
    respuesta.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
    respuesta.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
    csp = _CSP
    if os.environ.get("AMPU_PERMITIR_IFRAME") != "1":
        # Por defecto nadie puede incrustar AmPu en un marco (clickjacking).
        respuesta.headers.setdefault("X-Frame-Options", "DENY")
        csp += "; frame-ancestors 'none'"
    respuesta.headers.setdefault("Content-Security-Policy", csp)
    if request.path.startswith("/api/"):
        respuesta.headers.setdefault("Cache-Control", "no-store")
        inicio = g.get("inicio")
        if inicio is not None:
            duracion = time.monotonic() - inicio
            respuesta.headers["X-AmPu-Duracion-ms"] = str(int(duracion * 1000))
            if duracion > LIMITE_SEGUNDOS:
                log.warning("%s tardó %.1f s (límite %.0f s)", request.path, duracion, LIMITE_SEGUNDOS)
    return respuesta


def _comprobar_plazo(etapa: str = "") -> None:
    """Punto de control cooperativo: corta entre etapas si ya se agotó el plazo.

    No interrumpe una llamada a NumPy/SciPy en curso (Python no puede abortar un
    hilo); por eso la defensa principal son las cotas de tamaño de las entradas.
    """
    if time.monotonic() > g.get("plazo", float("inf")):
        raise TiempoExcedidoError(
            f"El cálculo superó el límite de {LIMITE_SEGUNDOS:.0f} s" + (f" ({etapa})." if etapa else "."),
            sugerencia="Reduce el tamaño de los datos o el número de simulaciones.")


# ---------------------------------------------------------------------------
# Utilidades de serialización y validación
# ---------------------------------------------------------------------------

def _valor(v):
    """Convierte valores NumPy/pandas a JSON, representando infinitos como texto.

    No redondea: un p-valor de 4,8e-32 debe llegar a la interfaz como 4,8e-32,
    no como 0.  El número de cifras visibles lo decide la capa de presentación.
    """
    if v is None:
        return None
    if isinstance(v, (np.bool_, bool)):
        return bool(v)
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        f = float(v)
        if math.isnan(f):
            return None
        if math.isinf(f):
            return "∞" if f > 0 else "−∞"
        return f
    if isinstance(v, Fraction):
        return float(v)
    if isinstance(v, np.ndarray):
        return [_valor(x) for x in v.tolist()]
    if isinstance(v, pd.DataFrame):
        return _tabla(v)
    if isinstance(v, (list, tuple)):
        return [_valor(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _valor(x) for k, x in v.items()}
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    return v


def _tabla(df: pd.DataFrame, limite: int = 500) -> dict:
    """Serializa un DataFrame como columnas/filas acotadas."""
    total = int(len(df))
    vista = df.head(limite)
    return {
        "columnas": [str(c) for c in vista.columns],
        "filas": [[_valor(v) for v in fila] for fila in vista.itertuples(index=False, name=None)],
        "total": total,
        "truncada": total > limite,
    }


class ErrorPeticion(EntradaInvalidaError):
    """Petición mal formada: falta un campo, opción desconocida, etc."""

    tipo = "sintaxis"


def _error(mensaje: str, estado: int = 400, campo: str | None = None, tipo: str = "sintaxis",
           sugerencia: str | None = None, posicion: int | None = None, detalle: dict | None = None):
    cuerpo = {"error": mensaje, "campo": campo, "tipo": tipo}
    if sugerencia:
        cuerpo["sugerencia"] = sugerencia
    if posicion is not None:
        cuerpo["posicion"] = posicion
    if detalle:
        cuerpo["detalle"] = _valor(detalle)
    return jsonify(cuerpo), estado


def _cuerpo() -> dict:
    datos = request.get_json(silent=True)
    if datos is None:
        raise ErrorPeticion("El cuerpo de la petición debe ser JSON válido.")
    if not isinstance(datos, dict):
        raise ErrorPeticion("El cuerpo JSON debe ser un objeto.")
    return datos


def _texto(valor, campo: str, obligatorio: bool = True) -> str | None:
    if valor is None:
        if obligatorio:
            raise ErrorPeticion(f"Falta el campo «{campo}».", campo=campo)
        return None
    texto = str(valor).strip()
    if obligatorio and not texto:
        raise ErrorPeticion(f"El campo «{campo}» no puede estar vacío.", campo=campo)
    return texto


def _vacio(valor) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip())


def _numero(valor, campo: str, defecto: float | None = None, id_campo: str | None = None) -> float:
    """Lee un número con el analizador único (coma o punto decimal)."""
    if _vacio(valor):
        if defecto is not None:
            return float(defecto)
        raise ErrorPeticion(f"Falta el valor numérico «{campo}».", campo=id_campo or campo,
                            sugerencia="Rellena el campo con un número.")
    try:
        return entrada.leer_numero(valor, campo)
    except ErrorAmPu as exc:
        exc.campo = id_campo or campo
        raise


def _entero(valor, campo: str, defecto: int | None = None, id_campo: str | None = None) -> int:
    numero = _numero(valor, campo, defecto, id_campo)
    if not float(numero).is_integer():
        raise ErrorPeticion(f"«{campo}» debe ser un número entero.", campo=id_campo or campo)
    if abs(numero) > 2**53:
        raise FueraDeAlcanceError(f"«{campo}» es demasiado grande para tratarse como entero exacto.",
                                  campo=id_campo or campo)
    return int(numero)


def _racional(valor, campo: str, id_campo: str | None = None):
    """Lee una probabilidad como fracción exacta si se escribió como a/b; si no, como decimal."""
    if _vacio(valor):
        raise ErrorPeticion(f"Falta el valor «{campo}».", campo=id_campo or campo)
    try:
        return entrada.leer_numero(valor, campo, fraccion=True)
    except ErrorAmPu as exc:
        exc.campo = id_campo or campo
        raise


def _booleano(valor, defecto: bool = False) -> bool:
    if valor is None:
        return defecto
    if isinstance(valor, bool):
        return valor
    return str(valor).strip().lower() in {"1", "true", "si", "sí", "on", "yes"}


def _json_si_procede(valor, campo: str):
    """Admite listas escritas como texto JSON («[1, 2, 3]»)."""
    if isinstance(valor, str) and valor.strip().startswith("["):
        try:
            return json.loads(valor)
        except json.JSONDecodeError as exc:
            raise ErrorPeticion(f"«{campo}» no es una lista JSON válida.", campo=campo,
                                sugerencia="Escribe los valores separados por espacios.") from exc
    return valor


def _lectura(valor, campo: str = "datos", minimo: int = 2, maximo: int = 100_000,
             fraccion: bool = False) -> entrada.Lectura:
    """Lee una serie y conserva los avisos de interpretación."""
    if _vacio(valor):
        raise ErrorPeticion(f"La serie «{campo}» está vacía.", campo=campo,
                            sugerencia="Escribe los valores separados por espacios, punto y coma o líneas.")
    lectura = entrada.leer_serie(_json_si_procede(valor, campo), campo, minimo=minimo, maximo=maximo,
                                 fraccion=fraccion)
    if lectura.avisos:
        g.setdefault("avisos_entrada", []).extend(lectura.avisos)
    return lectura


# Por encima de 10^150 los cuadrados (varianzas, sumas de cuadrados) desbordan la doble
# precisión y darían «∞» o NaN silenciosos: es preferible rechazar con una explicación.
MAGNITUD_MAXIMA = 1e150


def _comprobar_magnitud(valores: np.ndarray, campo: str) -> np.ndarray:
    if valores.size and float(np.max(np.abs(valores))) > MAGNITUD_MAXIMA:
        posicion = int(np.argmax(np.abs(valores))) + 1
        raise FueraDeAlcanceError(
            f"«{campo}» contiene valores de magnitud superior a 10^150 (posición {posicion}): "
            "las sumas de cuadrados desbordarían la doble precisión y el resultado no sería fiable.",
            campo=campo, sugerencia="Cambia de unidades: divide todos los valores por una constante.",
        )
    return valores


def _serie(valor, campo: str = "datos", minimo: int = 2, maximo: int = 100_000) -> np.ndarray:
    """Convierte una lista o un texto libre en una serie numérica finita."""
    return _comprobar_magnitud(np.asarray(_lectura(valor, campo, minimo, maximo).valores, dtype=float), campo)


def _matriz(valor, campo: str = "tabla", minimo_filas: int = 2, minimo_columnas: int = 2) -> np.ndarray:
    """Convierte texto (una fila por línea) o listas anidadas en una matriz rectangular."""
    if _vacio(valor):
        raise ErrorPeticion(f"Falta «{campo}».", campo=campo)
    filas = entrada.leer_matriz(_json_si_procede(valor, campo), campo, minimo_filas=minimo_filas,
                                minimo_columnas=minimo_columnas)
    return _comprobar_magnitud(np.asarray(filas, dtype=float), campo)


def _grupos(valor, campo: str = "grupos") -> list[np.ndarray]:
    """Interpreta un texto donde cada línea es un grupo de observaciones."""
    if isinstance(valor, (list, tuple)):
        lineas = list(valor)
    else:
        lineas = [linea for linea in str(valor or "").splitlines() if linea.strip()]
    if len(lineas) < 2:
        raise ErrorPeticion(f"«{campo}» necesita al menos dos líneas (un grupo por línea).", campo=campo)
    grupos = []
    for i, linea in enumerate(lineas, start=1):
        try:
            grupos.append(_serie(list(linea) if isinstance(linea, (list, tuple)) else str(linea),
                                 f"{campo} · grupo {i}", minimo=2))
        except ErrorAmPu as exc:
            exc.campo = campo
            raise
    return grupos


def _avisos_entrada() -> list[str]:
    """Avisos de interpretación acumulados durante la petición (sin duplicados)."""
    return list(dict.fromkeys(g.get("avisos_entrada", [])))


def _parametros_modelo(modelo, crudos, campo: str = "parametros") -> dict:
    """Lee los parámetros de una distribución sin descartar ni inventar ninguno.

    Un nombre desconocido o un parámetro ausente es un error declarado: antes
    se ignoraba el primero y se rellenaba el segundo con el valor por defecto.
    """
    if crudos is None:
        crudos = {}
    if not isinstance(crudos, dict):
        raise ErrorPeticion("«parametros» debe ser un objeto con los valores del modelo.", campo=campo)
    tipos = {p.nombre: p.tipo for p in modelo.parametros}
    desconocidos = sorted(set(crudos) - set(tipos))
    if desconocidos:
        raise ParametroInvalidoError(
            f"{modelo.nombre} no tiene el parámetro «{', '.join(desconocidos)}».", campo=desconocidos[0],
            sugerencia="Parámetros admitidos: " + ", ".join(tipos) + ".")
    ausentes = [n for n in tipos if _vacio(crudos.get(n)) and not isinstance(crudos.get(n), (list, tuple))]
    if ausentes:
        raise ErrorPeticion(
            f"Falta el parámetro «{ausentes[0]}» de {modelo.nombre}.", campo=ausentes[0],
            sugerencia="Rellena todos los parámetros del modelo; AmPu no asume valores por defecto.")
    parametros: dict = {}
    for nombre, valor in crudos.items():
        tipo = tipos[nombre]
        if tipo.startswith("vector"):
            valores = entrada.leer_serie(_json_si_procede(valor, nombre), nombre, minimo=2, maximo=64,
                                         fraccion=True).valores
            valores = [float(v) for v in valores]
            if tipo == "vector_entero":
                if any(not v.is_integer() for v in valores):
                    raise ParametroInvalidoError(f"«{nombre}» debe contener solo enteros.", campo=nombre)
                valores = [int(v) for v in valores]
            parametros[nombre] = valores
        elif tipo == "entero":
            parametros[nombre] = _entero(valor, nombre)
        else:
            parametros[nombre] = _numero(valor, nombre)
    return parametros


def _latex_escapar(texto: str) -> str:
    return texto.replace("\\", "\\\\").replace("_", "\\_")


# ---------------------------------------------------------------------------
# Teoría y metadatos enriquecidos
# ---------------------------------------------------------------------------

def _slug(texto: str) -> str:
    normal = unicodedata.normalize("NFKD", texto)
    normal = "".join(c for c in normal if not unicodedata.combining(c))
    normal = re.sub(r"[^a-zA-Z0-9]+", "-", normal).strip("-").lower()
    return normal or "seccion"


def _preservar_matematicas(texto: str) -> tuple[str, dict[str, str]]:
    """Aparta fórmulas antes de interpretar Markdown, conservando delimitadores."""
    tokens: dict[str, str] = {}

    def bloque(m):
        clave = f"AMPUBLOCKTOKEN{len(tokens)}END"
        tokens[clave] = '<div class="formula-bloque">$$' + m.group(1).replace("<", "&lt;").replace(">", "&gt;") + "$$</div>"
        return f"\n\n{clave}\n\n"

    texto = re.sub(r"^\$\$\s*\n(.*?)\n\$\$\s*$", bloque, texto, flags=re.M | re.S)

    def linea(m):
        clave = f"AMPUINLINETOKEN{len(tokens)}END"
        tokens[clave] = '<span class="formula-linea">$' + m.group(1).replace("<", "&lt;").replace(">", "&gt;") + "$</span>"
        return clave

    texto = re.sub(r"(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)", linea, texto)
    return texto, tokens


@lru_cache(maxsize=128)
def _texto_leccion(clave: str) -> str | None:
    ruta = TEORIA_DIR / f"{clave}.md"
    if not ruta.is_file():
        return None
    return ruta.read_text(encoding="utf-8")


def _seccion(texto: str, titulo: str) -> str:
    patron = re.compile(rf"^##\s+{re.escape(titulo)}\s*$(.*?)(?=^##\s|\Z)", re.M | re.S)
    encontrado = patron.search(texto)
    return encontrado.group(1).strip() if encontrado else ""


def _limpiar_markdown(texto: str) -> str:
    texto = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", texto)
    texto = re.sub(r"\*\*(.+?)\*\*", r"\1", texto)
    texto = re.sub(r"[`*_]", "", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


@lru_cache(maxsize=128)
def _info_leccion(clave: str) -> dict:
    """Extrae resumen, primera fórmula y ejemplo resuelto de una lección."""
    texto = _texto_leccion(clave)
    if texto is None:
        return {}
    lineas = texto.splitlines()
    titulo = lineas[0].lstrip("# ").strip() if lineas else clave
    definicion = _seccion(texto, "Definición formal")
    formula_m = re.search(r"\$\$(.+?)\$\$", texto, re.S)
    formula = formula_m.group(1).strip() if formula_m else None
    ejemplo = _seccion(texto, "Ejemplo resuelto, paso a paso")
    propiedades = _seccion(texto, "Propiedades y casos especiales")
    palabras = len(re.findall(r"\w+", _limpiar_markdown(texto)))
    return {
        "clave": clave,
        "titulo": titulo,
        "resumen": _limpiar_markdown(definicion)[:420],
        "formula": formula,
        "ejemplo": _limpiar_markdown(ejemplo)[:700],
        "propiedades": _limpiar_markdown(propiedades)[:420],
        "minutos": max(1, round(palabras / 190)),
    }


def _sugerir_evento(modelo) -> float | list[float] | None:
    """Propone un evento interesante (media redondeada) para el formulario."""
    params = {p.nombre: p.default for p in modelo.parametros if p.default is not None}
    try:
        media = np.asarray(modelo.media(**params), dtype=float)
    except Exception:  # noqa: BLE001 - sólo es una sugerencia de UI
        return [0.0, 0.0] if modelo.dimensionalidad == "bivariante" else None
    if modelo.dimensionalidad == "univariante":
        valor = float(media.ravel()[0])
        if not math.isfinite(valor):
            return 0.0
        return int(round(valor)) if modelo.discreta else round(valor, 4)
    if modelo.clave == "multinomial":
        n = int(params.get("n", 8))
        p = list(params.get("p", ()))
        cuotas = [int(round(pi * n)) for pi in p]
        while sum(cuotas) > n and cuotas:
            cuotas[cuotas.index(max(cuotas))] -= 1
        while sum(cuotas) < n:
            cuotas[cuotas.index(min(cuotas))] += 1
        return cuotas
    if modelo.clave == "dirichlet":
        alpha = np.asarray(params.get("alpha", (2.0, 3.0, 4.0)), dtype=float)
        return [round(float(v / alpha.sum()), 4) for v in alpha]
    return [round(float(v), 4) for v in media.ravel()]


@lru_cache(maxsize=64)
def _meta_distribucion(clave: str) -> dict:
    modelo = obtener(clave)
    info = _info_leccion(clave)
    params = {
        p.nombre: p.default for p in modelo.parametros if p.default is not None
    }
    soporte = None
    try:
        limite = modelo.soporte(**params)
        soporte = [_valor(limite[0]), _valor(limite[1])]
    except Exception:  # noqa: BLE001
        soporte = None
    return {
        "clave": clave,
        "nombre": modelo.nombre,
        "discreta": bool(modelo.discreta),
        "dimensionalidad": modelo.dimensionalidad,
        "categoria": "discreta" if modelo.discreta else ("multivariante" if modelo.dimensionalidad != "univariante" else "continua"),
        "parametros": [
            {
                "nombre": p.nombre,
                "tipo": p.tipo,
                "minimo": _valor(p.minimo),
                "maximo": _valor(p.maximo),
                "descripcion": p.descripcion,
                "default": _valor(p.default),
                "incluir_minimo": p.incluir_minimo,
                "incluir_maximo": p.incluir_maximo,
            }
            for p in modelo.parametros
        ],
        "teoria": clave if _texto_leccion(clave) else None,
        "formula": info.get("formula"),
        "resumen": info.get("resumen", ""),
        "propiedades": info.get("propiedades", ""),
        "ejemplo": info.get("ejemplo", ""),
        "imagen": f"/media/teoria/{clave}.png" if (IMAGENES_DIR / f"{clave}.png").is_file() else None,
        "x_sugerido": _sugerir_evento(modelo),
        "soporte_sugerido": soporte,
    }


@app.route("/api/meta")
def api_meta():
    distribuciones = [_meta_distribucion(m.clave) for m in catalogo()]
    lecciones = listar_teoria()
    return jsonify(
        {
            "app": "AmPu",
            "version": VERSION_APP,
            "motor": MOTOR_VERSION,
            "offline": True,
            "distribuciones": distribuciones,
            "teoria": _catalogo_teoria(lecciones),
            "pruebas": CATALOGO_PRUEBAS,
            "muestreo": CATALOGO_MUESTREO,
            "simulacion": CATALOGO_SIMULACION,
            "probabilidad": CATALOGO_PROBABILIDAD,
            "atajos": [
                {"teclas": ["Ctrl", "K"], "accion": "Buscar cualquier herramienta o lección"},
                {"teclas": ["Ctrl", "Enter"], "accion": "Calcular en el formulario activo"},
                {"teclas": ["Ctrl", "Shift", "L"], "accion": "Cambiar entre tema claro y oscuro"},
                {"teclas": ["?"], "accion": "Abrir esta ayuda"},
            ],
        }
    )


def _catalogo_teoria(lecciones: list[tuple[str, str]]) -> list[dict]:
    grupos = {
        "distribuciones": set(m.clave for m in catalogo()),
        "muestreo": {c for c, _ in lecciones if c.startswith("muestreo") or c.startswith("tamano")},
        "inferencia": {
            c for c, _ in lecciones
            if c.startswith(("prueba_", "chi_", "anova", "correlacion", "kruskal", "mann_", "wilcoxon", "intervalos"))
        },
        "analisis": {"descriptiva", "combinatoria", "bayes", "montecarlo", "regresion", "qq_plot", "ajuste_distribuciones"},
    }
    salida = []
    for clave, titulo in lecciones:
        if clave in grupos["distribuciones"]:
            categoria = "distribuciones"
        elif clave in grupos["muestreo"]:
            categoria = "muestreo"
        elif clave in grupos["inferencia"]:
            categoria = "inferencia"
        elif clave in grupos["analisis"]:
            categoria = "analisis"
        else:
            categoria = "otros"
        info = _info_leccion(clave)
        salida.append(
            {
                "clave": clave,
                "titulo": titulo,
                "categoria": categoria,
                "resumen": info.get("resumen", "")[:160],
                "minutos": info.get("minutos", 1),
                "formula": info.get("formula"),
            }
        )
    return salida


# ---------------------------------------------------------------------------
# Catálogos declarativos (el frontend genera formularios a partir de ellos)
# ---------------------------------------------------------------------------

def _campo(id_, etiqueta, tipo="numero", **extra):
    return {"id": id_, "etiqueta": etiqueta, "tipo": tipo, **extra}


CATALOGO_PRUEBAS = [
    {
        "clave": "t_una", "nombre": "t de Student · una media", "grupo": "Medias",
        "descripcion": "Contrasta la media de una muestra cuando se desconoce la desviación poblacional.",
        "h0": "μ = μ₀", "h1": "μ ≠ μ₀",
        "admite_alternativa": True,
        "h1_alternativas": {"two-sided": "μ ≠ μ₀", "less": "μ < μ₀", "greater": "μ > μ₀"},
        "supuestos": "Observaciones independientes; aproximadamente normales o n grande.",
        "campos": [
            _campo("datos", "Muestra", "serie", ejemplo="12,4 11,8 13,1 12,9 12,2 12,7"),
            _campo("mu0", "Media nula μ₀", "numero", default=12),
        ],
        "teoria": "prueba_t_una",
    },
    {
        "clave": "z_una", "nombre": "z · una media (σ conocida)", "grupo": "Medias",
        "descripcion": "Contrasta una media cuando la desviación estándar poblacional es conocida.",
        "h0": "μ = μ₀", "h1": "μ ≠ μ₀",
        "admite_alternativa": True,
        "h1_alternativas": {"two-sided": "μ ≠ μ₀", "less": "μ < μ₀", "greater": "μ > μ₀"},
        "supuestos": "σ poblacional conocida; muestra grande o población normal.",
        "campos": [
            _campo("datos", "Muestra", "serie", ejemplo="10,1 9,8 10,4 9,9 10,2"),
            _campo("mu0", "Media nula μ₀", "numero", default=10),
            _campo("sigma", "Desviación poblacional σ", "numero", default=0.5, min=0.0001),
        ],
        "teoria": "prueba_z_una",
    },
    {
        "clave": "t_dos", "nombre": "t de Welch · dos medias", "grupo": "Medias",
        "descripcion": "Compara dos medias independientes sin asumir varianzas iguales.",
        "h0": "μ₁ = μ₂", "h1": "μ₁ ≠ μ₂",
        "admite_alternativa": True,
        "h1_alternativas": {"two-sided": "μ₁ ≠ μ₂", "less": "μ₁ < μ₂", "greater": "μ₁ > μ₂"},
        "supuestos": "Grupos independientes; normalidad aproximada; no exige igualdad de varianzas.",
        "campos": [
            _campo("datos", "Grupo A", "serie", ejemplo="12 13 11 14 12 13"),
            _campo("datos2", "Grupo B", "serie", ejemplo="15 16 14 15 17 16"),
        ],
        "teoria": "prueba_t_dos",
    },
    {
        "clave": "z_dos", "nombre": "z · dos medias (σ conocidas)", "grupo": "Medias",
        "descripcion": "Compara dos medias independientes con desviaciones poblacionales conocidas.",
        "h0": "μ₁ = μ₂", "h1": "μ₁ ≠ μ₂",
        "admite_alternativa": True,
        "h1_alternativas": {"two-sided": "μ₁ ≠ μ₂", "less": "μ₁ < μ₂", "greater": "μ₁ > μ₂"},
        "supuestos": "σ₁ y σ₂ conocidas; grupos independientes.",
        "campos": [
            _campo("datos", "Grupo A", "serie", ejemplo="12 13 11 14 12 13"),
            _campo("datos2", "Grupo B", "serie", ejemplo="15 16 14 15 17 16"),
            _campo("sigma_a", "σ del grupo A", "numero", default=1.2, min=0.0001),
            _campo("sigma_b", "σ del grupo B", "numero", default=1.4, min=0.0001),
        ],
        "teoria": "prueba_z_dos",
    },
    {
        "clave": "prop_una", "nombre": "Una proporción (z o binomial exacta)", "grupo": "Proporciones",
        "descripcion": "Contrasta una proporción observada frente a un valor de referencia.",
        "h0": "p = p₀", "h1": "p ≠ p₀",
        "admite_alternativa": True,
        "h1_alternativas": {"two-sided": "p ≠ p₀", "less": "p < p₀", "greater": "p > p₀"},
        "supuestos": "Aproximación normal: n·p₀ ≥ 5 y n·(1−p₀) ≥ 5.",
        "campos": [
            _campo("exitos", "Éxitos observados", "entero", default=48, min=0),
            _campo("n", "Tamaño de muestra n", "entero", default=100, min=1),
            _campo("p0", "Proporción nula p₀", "numero", default=0.4, min=0, max=1, step=0.01),
        ],
        "teoria": "prueba_proporcion_una",
    },
    {
        "clave": "prop_dos", "nombre": "Dos proporciones (z o Fisher exacta)", "grupo": "Proporciones",
        "descripcion": "Compara las proporciones de éxito de dos grupos independientes.",
        "h0": "p₁ = p₂", "h1": "p₁ ≠ p₂",
        "admite_alternativa": True,
        "h1_alternativas": {"two-sided": "p₁ ≠ p₂", "less": "p₁ < p₂", "greater": "p₁ > p₂"},
        "supuestos": "Muestras independientes; frecuencias esperadas suficientes.",
        "campos": [
            _campo("x1", "Éxitos del grupo 1", "entero", default=45, min=0),
            _campo("n1", "Tamaño del grupo 1", "entero", default=100, min=1),
            _campo("x2", "Éxitos del grupo 2", "entero", default=34, min=0),
            _campo("n2", "Tamaño del grupo 2", "entero", default=100, min=1),
        ],
        "teoria": "prueba_proporcion_dos",
    },
    {
        "clave": "chi_indep", "nombre": "χ² · independencia", "grupo": "Asociación",
        "descripcion": "Comprueba si dos variables categóricas son independientes a partir de una tabla de contingencia.",
        "h0": "Las variables son independientes", "h1": "Existe asociación",
        "admite_alternativa": False,
        "supuestos": "Frecuencias esperadas ≥ 5 en la mayoría de celdas; observaciones independientes.",
        "campos": [
            _campo("tabla", "Tabla de contingencia", "matriz", ejemplo="30 20\n15 35", ayuda="Una fila por línea; separa columnas con espacios, comas o tabuladores."),
        ],
        "teoria": "chi_independencia",
    },
    {
        "clave": "chi_bondad", "nombre": "χ² · bondad de ajuste", "grupo": "Asociación",
        "descripcion": "Compara frecuencias observadas y esperadas bajo un modelo teórico.",
        "h0": "Los datos siguen la distribución propuesta", "h1": "Los datos no siguen la distribución propuesta",
        "admite_alternativa": False,
        "supuestos": "Frecuencias esperadas ≥ 5; categorías mutuamente excluyentes.",
        "campos": [
            _campo("observadas", "Frecuencias observadas", "serie", ejemplo="18 22 29 31"),
            _campo("esperadas", "Frecuencias esperadas", "serie", ejemplo="25 25 25 25"),
            _campo("parametros_estimados", "Parámetros estimados (corrección de gl)", "entero", default=0, min=0),
        ],
        "teoria": "chi_bondad",
    },
    {
        "clave": "anova", "nombre": "ANOVA · una vía", "grupo": "Medias",
        "descripcion": "Compara las medias de dos o más grupos independientes mediante la razón F.",
        "h0": "Todas las medias son iguales", "h1": "Al menos una media difiere",
        "admite_alternativa": False,
        "supuestos": "Independencia, normalidad aproximada y homogeneidad de varianzas.",
        "campos": [
            _campo("grupos", "Grupos", "grupos", ejemplo="10 12 11 13\n14 15 13 16\n9 11 10 12", ayuda="Una línea por grupo; separa observaciones con comas o espacios."),
        ],
        "teoria": "anova",
    },
    {
        "clave": "correlacion", "nombre": "Correlación (Pearson o Spearman)", "grupo": "Asociación",
        "descripcion": "Cuantifica la fuerza y dirección de la relación lineal entre dos variables pareadas.",
        "h0": "ρ = 0", "h1": "ρ ≠ 0",
        "admite_alternativa": True,
        "h1_alternativas": {"two-sided": "ρ ≠ 0", "less": "ρ < 0", "greater": "ρ > 0"},
        "supuestos": "Pares completos; relación aproximadamente lineal (Pearson).",
        "campos": [
            _campo("x", "Variable X", "serie", ejemplo="1 2 3 4 5 6 7 8"),
            _campo("y", "Variable Y", "serie", ejemplo="2,1 2,9 4,2 4,8 6,1 6,9 8,2 8,8"),
            _campo("metodo", "Coeficiente", "opcion", opciones=[["pearson", "Pearson (lineal)"], ["spearman", "Spearman (rangos)"]], default="pearson"),
        ],
        "teoria": "correlacion",
    },
    {
        "clave": "mann_whitney", "nombre": "Mann–Whitney U", "grupo": "No paramétricas",
        "descripcion": "Alternativa no paramétrica para comparar dos muestras independientes.",
        "h0": "Las dos distribuciones son iguales", "h1": "Un grupo tiende a dar valores distintos del otro",
        "admite_alternativa": True,
        "h1_alternativas": {"two-sided": "Un grupo tiende a dar valores distintos del otro", "less": "El grupo A tiende a dar valores menores que el grupo B", "greater": "El grupo A tiende a dar valores mayores que el grupo B"},
        "supuestos": "Grupos independientes; variable al menos ordinal.",
        "campos": [
            _campo("datos", "Grupo A", "serie", ejemplo="12 13 11 14 12 13"),
            _campo("datos2", "Grupo B", "serie", ejemplo="15 16 14 15 17 16"),
        ],
        "teoria": "mann_whitney",
    },
    {
        "clave": "wilcoxon", "nombre": "Wilcoxon · pareado", "grupo": "No paramétricas",
        "descripcion": "Compara dos mediciones pareadas sin asumir normalidad de las diferencias.",
        "h0": "Las diferencias (A − B) son simétricas en torno a 0", "h1": "Las diferencias (A − B) no están centradas en 0",
        "admite_alternativa": True,
        "h1_alternativas": {"two-sided": "Las diferencias (A − B) no están centradas en 0", "less": "Las diferencias (A − B) tienden a ser negativas", "greater": "Las diferencias (A − B) tienden a ser positivas"},
        "supuestos": "Pares completos; diferencias simétricas (aprox.).",
        "campos": [
            _campo("datos", "Medición A", "serie", ejemplo="120 118 131 129 122 127"),
            _campo("datos2", "Medición B", "serie", ejemplo="115 116 128 125 120 122"),
        ],
        "teoria": "wilcoxon",
    },
    {
        "clave": "kruskal", "nombre": "Kruskal–Wallis", "grupo": "No paramétricas",
        "descripcion": "Compara dos o más grupos independientes usando rangos (ANOVA no paramétrica).",
        "h0": "Todos los grupos tienen la misma distribución", "h1": "Al menos un grupo difiere",
        "admite_alternativa": False,
        "supuestos": "Grupos independientes; variable al menos ordinal.",
        "campos": [
            _campo("grupos", "Grupos", "grupos", ejemplo="10 12 11 13\n14 15 13 16\n9 11 10 12", ayuda="Una línea por grupo."),
        ],
        "teoria": "kruskal",
    },
]

CATALOGO_MUESTREO = [
    {
        "clave": "finito", "nombre": "Aleatorio simple · población finita",
        "descripcion": "Todas las unidades tienen la misma probabilidad; muestreo sin reemplazo.",
        "estratos": False, "campo_n": "Unidades a extraer", "formula": r"P(s)=\frac{1}{\binom{N}{n}}",
    },
    {
        "clave": "infinito", "nombre": "Aleatorio simple · población grande",
        "descripcion": "Modelo con reemplazo para poblaciones muy grandes o procesos estacionarios.",
        "estratos": False, "campo_n": "Unidades a extraer", "formula": r"n=\frac{z^2p(1-p)}{e^2}",
    },
    {
        "clave": "sistematico", "nombre": "Sistemático",
        "descripcion": "Inicio aleatorio y salto constante N/n sobre la lista ordenada.",
        "estratos": False, "campo_n": "Unidades a extraer", "formula": r"k=\frac{N}{n},\quad i_0\sim U(0,k)",
    },
    {
        "clave": "proporcional", "nombre": "Estratificado proporcional",
        "descripcion": "Reparte n entre estratos en proporción a su tamaño.",
        "estratos": True, "campo_n": "Muestra total n", "formula": r"n_h=n\frac{N_h}{N}",
    },
    {
        "clave": "neyman", "nombre": "Asignación de Neyman",
        "descripcion": "Optimiza la precisión asignando más muestra a estratos más variables.",
        "estratos": True, "campo_n": "Muestra total n", "formula": r"n_h=n\frac{N_hS_h}{\sum N_hS_h}",
    },
    {
        "clave": "optimo", "nombre": "Asignación óptima con costes",
        "descripcion": "Minimiza la varianza para un coste dado usando desviación y coste por estrato.",
        "estratos": True, "campo_n": "Muestra total n", "formula": r"n_h=n\frac{N_hS_h/\sqrt{c_h}}{\sum N_hS_h/\sqrt{c_h}}",
    },
    {
        "clave": "conglomerados", "nombre": "Por conglomerados",
        "descripcion": "Selecciona grupos completos (o en dos etapas) y encuesta todas sus unidades.",
        "estratos": True, "campo_n": "Conglomerados a elegir", "formula": r"P(\text{conglomerado }j)=\frac{m}{M}",
    },
]

CATALOGO_SIMULACION = [
    {"clave": "pi", "nombre": "Estimar π por Monte Carlo", "descripcion": "Puntos aleatorios en el cuadrado unitario; la fracción dentro del cuarto de círculo estima π.", "formula": r"\hat\pi=4\frac{n_{\text{dentro}}}{n}"},
    {"clave": "integral", "nombre": "Integrar una función", "descripcion": "Promedio de la función sobre puntos uniformes, con intervalo de confianza.", "formula": r"\int_a^b f(x)\,dx\approx(b-a)\bar f"},
    {"clave": "muestra", "nombre": "Generar una muestra", "descripcion": "Simula observaciones de cualquiera de las 26 distribuciones y compáralas con la teoría.", "formula": r"x_1,\ldots,x_n\sim F_\theta"},
    {"clave": "ajuste", "nombre": "Ajustar una distribución", "descripcion": "Estima parámetros por máxima verosimilitud, con AIC y contraste KS exploratorio.", "formula": r"\hat\theta=\arg\max_\theta\ell(\theta;x)"},
    {"clave": "qq", "nombre": "QQ-plot", "descripcion": "Compara cuantiles empíricos y teóricos para evaluar el ajuste.", "formula": r"Q_{\text{emp}}(p)\ \text{frente a}\ Q_{\theta}(p)"},
]

CATALOGO_PROBABILIDAD = [
    {"clave": "combinatoria", "nombre": "Combinatoria", "descripcion": "Factoriales, permutaciones y combinaciones con enteros exactos.", "formula": r"\binom{n}{k}=\frac{n!}{k!(n-k)!}"},
    {"clave": "condicional", "nombre": "Probabilidad condicional", "descripcion": "P(A|B) y comprobación de independencia.", "formula": r"P(A\mid B)=\frac{P(A\cap B)}{P(B)}"},
    {"clave": "bayes", "nombre": "Teorema de Bayes", "descripcion": "Actualiza probabilidades previas con evidencia nueva.", "formula": r"P(B_i\mid A)=\frac{P(B_i)P(A\mid B_i)}{\sum_j P(B_j)P(A\mid B_j)}"},
    {"clave": "variable", "nombre": "Variable discreta", "descripcion": "Esperanza, varianza y función generadora de momentos.", "formula": r"E[X]=\sum_i x_ip_i"},
]


# ---------------------------------------------------------------------------
# Preferencias (persistencia ligera y tolerante a fallos)
# ---------------------------------------------------------------------------

_PREF_LOCK = threading.Lock()
_PREF_DEFECTO = {
    "tema": "sistema",
    "decimales": 4,
    "notacion": "auto",
    "densidad": "comoda",
    "calculo_automatico": True,
    "sidebar": True,
    "reducir_movimiento": False,
}


def _ruta_preferencias() -> Path:
    entorno = os.environ.get("AMPU_DATA_DIR")
    base = Path(entorno) if entorno else Path.home() / ".ampu"
    return base / "preferences.json"


def _prefs_leer() -> dict:
    ruta = _ruta_preferencias()
    datos = dict(_PREF_DEFECTO)
    try:
        if ruta.is_file():
            guardado = json.loads(ruta.read_text(encoding="utf-8"))
            if isinstance(guardado, dict):
                datos.update({k: v for k, v in guardado.items() if k in _PREF_DEFECTO})
    except (OSError, json.JSONDecodeError):
        log.warning("No se pudieron leer las preferencias; se usan los valores por defecto.")
    return datos


def _prefs_guardar(datos: dict) -> dict:
    ruta = _ruta_preferencias()
    limpio = dict(_PREF_DEFECTO)
    limpio.update({k: v for k, v in datos.items() if k in _PREF_DEFECTO})
    limpio["tema"] = limpio["tema"] if limpio["tema"] in {"claro", "oscuro", "sistema"} else "sistema"
    limpio["decimales"] = max(0, min(10, int(limpio["decimales"]))) if isinstance(limpio["decimales"], (int, float)) else 4
    limpio["notacion"] = limpio["notacion"] if limpio["notacion"] in {"auto", "fija", "cientifica"} else "auto"
    limpio["densidad"] = limpio["densidad"] if limpio["densidad"] in {"comoda", "compacta"} else "comoda"
    limpio["calculo_automatico"] = bool(limpio["calculo_automatico"])
    limpio["sidebar"] = bool(limpio["sidebar"])
    limpio["reducir_movimiento"] = bool(limpio["reducir_movimiento"])
    try:
        with _PREF_LOCK:
            ruta.parent.mkdir(parents=True, exist_ok=True)
            temporal = ruta.with_suffix(".tmp")
            temporal.write_text(json.dumps(limpio, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(temporal, ruta)
    except OSError:
        log.warning("No se pudieron guardar las preferencias (entorno de sólo lectura).")
    return limpio


@app.get("/api/preferences")
def api_prefs_get():
    return jsonify(_prefs_leer())


@app.post("/api/preferences")
def api_prefs_set():
    return jsonify(_prefs_guardar({**_prefs_leer(), **_cuerpo()}))


# ---------------------------------------------------------------------------
# Rutas estáticas
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/favicon.svg")
def favicon():
    return send_from_directory(STATIC_DIR, "favicon.svg")


@app.get("/favicon.ico")
def favicon_ico():
    return send_from_directory(STATIC_DIR, "favicon.ico")


@app.get("/vendor/katex/<path:archivo>")
def katex(archivo: str):
    return send_from_directory(RENDER_DIR, archivo, max_age=60 * 60 * 24 * 30)


@app.get("/media/teoria/<path:archivo>")
def media_teoria(archivo: str):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", archivo):
        return _error("Recurso no válido.", 404)
    return send_from_directory(IMAGENES_DIR, archivo, max_age=60 * 60 * 24 * 30)


# ---------------------------------------------------------------------------
# Distribuciones
# ---------------------------------------------------------------------------

@app.post("/api/distribucion/calcular")
def api_distribucion_calcular():
    datos = _cuerpo()
    clave = _texto(datos.get("clave"), "clave")
    modelo = obtener(clave)  # KeyError controlado por el manejador global
    parametros = _parametros_modelo(modelo, datos.get("parametros"))

    evento_crudo = datos.get("x", datos.get("evento"))
    if modelo.dimensionalidad == "univariante":
        evento: float | list[float] = _numero(evento_crudo, "x")
    else:
        evento = [float(v) for v in _lectura(evento_crudo, "x", minimo=1, maximo=64).valores]

    q = _numero(datos.get("q"), "q", 0.5)
    if not 0 <= q <= 1:
        raise ParametroInvalidoError("El cuantil q debe estar entre 0 y 1.", campo="q")
    puntos = _entero(datos.get("puntos"), "puntos", 161)
    if not 41 <= puntos <= 401:
        raise ParametroInvalidoError("La resolución debe estar entre 41 y 401 puntos.", campo="puntos")
    semilla = _entero(datos.get("semilla"), "semilla", 42)
    if semilla < 0:
        raise ParametroInvalidoError("La semilla debe ser un entero no negativo.", campo="semilla")

    resultado = analizar(clave, parametros, evento, q, semilla, puntos)
    respuesta = resultado.respuesta
    densidad = _valor(respuesta["probabilidad_o_densidad"])

    # Cola superior segura para modelos univariantes y multivariantes.
    try:
        if hasattr(modelo, "cola_inclusiva"):
            cola = _valor(modelo.cola_inclusiva(evento, **parametros))
        else:
            cola = None
    except Exception:  # noqa: BLE001
        cola = None

    # Probabilidad de un intervalo [a, b] opcional.
    intervalo = None
    rango = datos.get("intervalo")
    if rango:
        if not isinstance(rango, dict):
            raise ErrorPeticion("«intervalo» debe ser un objeto con los extremos a y b.", campo="intervalo")
        a = _numero(rango.get("a"), "a", id_campo="intervalo.a")
        b = _numero(rango.get("b"), "b", id_campo="intervalo.b")
        if a > b:
            raise ParametroInvalidoError("El extremo inferior a no puede superar b.", campo="intervalo.a")
        if modelo.dimensionalidad != "univariante":
            raise FueraDeAlcanceError(
                "La probabilidad de intervalo solo está disponible para modelos univariantes.", campo="intervalo")
        intervalo = {
            "a": a, "b": b,
            "probabilidad": _valor(_probabilidad_intervalo(modelo, parametros, a, b)),
            "etiqueta": f"P({_fmt_compacto(a)} ≤ X ≤ {_fmt_compacto(b)})",
        }

    try:
        if hasattr(modelo, "cola_inclusiva"):
            cola_curva = np.asarray(modelo.cola_inclusiva(resultado.x, **parametros), dtype=float)
        else:
            cola_curva = np.clip(1 - np.asarray(resultado.acumulada, dtype=float), 0, 1)
    except Exception:  # noqa: BLE001
        cola_curva = np.clip(1 - np.asarray(resultado.acumulada, dtype=float), 0, 1)
    curva = {
        "x": [_valor(v) for v in resultado.x],
        "y": [_valor(v) for v in resultado.y],
        "acumulada": [_valor(v) for v in resultado.acumulada],
        "cola": [_valor(v) for v in cola_curva],
    }

    etiqueta_densidad = "P(X = x)" if modelo.discreta else "f(x)"
    if modelo.dimensionalidad != "univariante":
        etiqueta_densidad = "densidad conjunta" if not modelo.discreta else "masa conjunta"

    return jsonify(
        {
            "clave": clave,
            "nombre": modelo.nombre,
            "discreta": bool(modelo.discreta),
            "marginal": resultado.marginal,
            "parametros": _valor(parametros),
            "x": _valor(evento),
            "q": q,
            "resumen": {
                "densidad": {"valor": densidad, "etiqueta": etiqueta_densidad},
                "acumulada": {"valor": _valor(respuesta["acumulada"]), "etiqueta": "P(X ≤ x)"},
                "cola": {"valor": cola, "etiqueta": "P(X ≥ x)"} if cola is not None else None,
                "cuantil": {"valor": _valor(respuesta["cuantil"]), "etiqueta": f"q = {_fmt_compacto(q)}"},
                "media": _valor(respuesta["media"]),
                "varianza": _valor(respuesta["varianza"]),
                "desviacion": _valor(respuesta["desviacion"]),
                "percentil": _valor(respuesta["acumulada"]),
            },
            "intervalo": intervalo,
            "curva": curva,
            "tabla": _tabla(resultado.tabla, limite=420),
            "nota": (
                "La curva y la tabla muestran la primera marginal simulada; los momentos son por componente y "
                "no describen la dependencia conjunta."
                if resultado.marginal else
                "Los valores se calculan con precisión completa; la interfaz redondea sólo al mostrar."
            ),
            "avisos": _avisos_entrada(),
        }
    )


def _fmt_compacto(v: float) -> str:
    if isinstance(v, str):
        return v
    return f"{v:.6g}".replace(".", ",")


def _fmt_suma(suma) -> str:
    """Suma de probabilidades con las cifras necesarias para que no se lea «1» si no lo es."""
    valor = float(suma)
    for cifras in (6, 9, 12, 15, 17):
        texto = f"{valor:.{cifras}g}"
        if float(texto) != 1.0 or valor == 1.0:
            return texto.replace(".", ",")
    return repr(valor).replace(".", ",")


def _probabilidad_intervalo(modelo, parametros: dict, a: float, b: float) -> float:
    """P(a ≤ X ≤ b) sin cancelación catastrófica en la cola derecha.

    En la cola superior ``cdf(b) − cdf(a)`` resta dos números casi iguales a 1 y
    pierde todas las cifras; allí se restan las funciones de supervivencia.
    """
    inferior = math.ceil(a) - 1 if modelo.discreta else a
    cdf_a, cdf_b = float(modelo.cdf(inferior, **parametros)), float(modelo.cdf(b, **parametros))
    p = cdf_b - cdf_a
    if cdf_a > 0.5 and hasattr(modelo, "cola_inclusiva"):
        try:
            if modelo.discreta:
                cola_a = float(modelo.cola_inclusiva(math.ceil(a), **parametros))
                cola_b = float(modelo.cola_inclusiva(math.floor(b) + 1, **parametros))
            else:
                cola_a = float(modelo.cola_inclusiva(a, **parametros))
                cola_b = float(modelo.cola_inclusiva(b, **parametros))
            if math.isfinite(cola_a) and math.isfinite(cola_b):
                p = cola_a - cola_b
        except Exception:  # noqa: BLE001 - se conserva la diferencia de CDF
            pass
    return max(0.0, min(1.0, p))


@app.post("/api/distribucion/muestra")
def api_distribucion_muestra():
    datos = _cuerpo()
    clave = _texto(datos.get("clave"), "clave")
    modelo = obtener(clave)
    parametros = _parametros_modelo(modelo, datos.get("parametros"))
    n = _entero(datos.get("n"), "n", 1000)
    semilla = _entero(datos.get("semilla"), "semilla", 42)
    muestra = montecarlo.generar_muestra(clave, parametros, n, semilla)
    if getattr(muestra, "ndim", 1) > 1:
        muestra = np.asarray(muestra)[:, 0]
        nota = "Se muestra la primera componente marginal de la simulación multivariante."
    else:
        nota = "Muestra generada con semilla reproducible; no altera el generador global."
    return jsonify({"muestra": _valor(np.asarray(muestra)[:400]), "n": n, "nota": nota})


# ---------------------------------------------------------------------------
# Estadística descriptiva
# ---------------------------------------------------------------------------

@app.post("/api/descriptiva")
def api_descriptiva():
    datos = _cuerpo()
    x = _serie(datos.get("datos"), "datos", minimo=2)
    if len(x) > 50_000:
        raise FueraDeAlcanceError("La muestra supera 50 000 observaciones.", campo="datos",
                                  sugerencia="Trabaja con una submuestra o divide los datos.")
    resumen = descriptiva.resumir(x)
    caja = descriptiva.caja(x)
    q1, q3 = resumen.q1, resumen.q3
    iqr = q3 - q1
    # Con muy pocos datos (o sin variación) el sesgo y la curtosis no están
    # definidos: se devuelve «sin dato» en lugar de un 0 que parecería simetría.
    con_variacion = resumen.desviacion > 0
    sesgo = float(stats.skew(x, bias=False)) if len(x) > 2 and con_variacion else None
    curtosis = float(stats.kurtosis(x, fisher=True, bias=False)) if len(x) > 3 and con_variacion else None
    error_estandar = resumen.desviacion / math.sqrt(len(x))
    tcrit = float(stats.t.ppf(0.975, len(x) - 1)) if len(x) > 1 else 0.0
    ic = (resumen.media - tcrit * error_estandar, resumen.media + tcrit * error_estandar)
    limite_inf, limite_sup = caja.valla_inferior, caja.valla_superior
    atipicos = np.asarray(caja.atipicos, dtype=float)
    avisos = _avisos_entrada()
    if len(atipicos) > 80:
        avisos.append(f"Hay {len(atipicos)} valores atípicos; se listan los 80 primeros.")
    if len(resumen.modas) > 8:
        avisos.append(f"Hay {len(resumen.modas)} valores empatados como moda; se muestran los 8 primeros.")

    if sesgo is None:
        forma = ("La muestra es demasiado pequeña (o no varía) para valorar su forma."
                 if con_variacion else "Todos los valores son iguales: no hay dispersión que describir.")
    elif sesgo > 0.5:
        forma = "Su distribución es asimétrica a la derecha: la media supera a la mediana y la cola derecha es más larga."
    elif sesgo < -0.5:
        forma = "Su distribución es asimétrica a la izquierda: la media es menor que la mediana y la cola izquierda es más larga."
    else:
        forma = "Su distribución es aproximadamente simétrica: media y mediana son cercanas."
    if curtosis is not None and abs(curtosis) > 1:
        forma += (" El exceso de curtosis es positivo: colas más pesadas que las de una normal."
                  if curtosis > 0 else
                  " El exceso de curtosis es negativo: colas más ligeras que las de una normal.")
    if len(x) < 20 and sesgo is not None:
        forma += " Con menos de 20 datos, sesgo y curtosis son estimaciones muy inestables."

    # Histograma con regla de Freedman–Diaconis, acotada a un rango legible.
    if iqr > 0:
        ancho = 2 * iqr / len(x) ** (1 / 3)
        bins = int(np.clip(math.ceil((x.max() - x.min()) / ancho), 5, 24)) if ancho > 0 else 8
    else:
        bins = int(np.clip(round(math.sqrt(len(x))), 5, 20))
    conteos, bordes = np.histogram(x, bins=bins)
    centros = (bordes[1:] + bordes[:-1]) / 2

    frec = descriptiva.frecuencias(x)
    frec_vista = frec.head(60)

    ordenados = np.sort(x)
    if len(ordenados) > 4000:
        paso = int(math.ceil(len(ordenados) / 4000))
        ordenados = ordenados[::paso]

    return jsonify(
        {
            "n": resumen.n,
            "faltantes": 0,
            "resumen": {
                "media": _valor(resumen.media),
                "mediana": _valor(resumen.mediana),
                "modas": _valor(list(resumen.modas)[:8]),
                "n_modas": len(resumen.modas),
                "q1": _valor(q1),
                "q3": _valor(q3),
                "minimo": _valor(resumen.minimo),
                "maximo": _valor(resumen.maximo),
                "rango": _valor(resumen.maximo - resumen.minimo),
                "iqr": _valor(iqr),
                "varianza": _valor(resumen.varianza),
                "desviacion": _valor(resumen.desviacion),
                "cv": _valor(resumen.coeficiente_variacion),
                "sesgo": _valor(sesgo),
                "curtosis": _valor(curtosis),
                "suma": _valor(float(x.sum())),
                "error_estandar": _valor(error_estandar),
                "ic_media": [_valor(ic[0]), _valor(ic[1])],
                "ic_nivel": 0.95,
            },
            "histograma": {
                "bordes": [_valor(b) for b in bordes],
                "centros": [_valor(c) for c in centros],
                "conteos": [_valor(c) for c in conteos],
            },
            "caja": {
                "min": _valor(resumen.minimo), "q1": _valor(q1), "mediana": _valor(resumen.mediana),
                "q3": _valor(q3), "max": _valor(resumen.maximo),
                "bigote_inf": _valor(caja.bigote_inferior),
                "bigote_sup": _valor(caja.bigote_superior),
                "valla_inf": _valor(caja.valla_inferior),
                "valla_sup": _valor(caja.valla_superior),
            },
            "n_atipicos": int(len(atipicos)),
            "atipicos": _valor(np.sort(atipicos))[:80],
            "limites_atipicos": [_valor(limite_inf), _valor(limite_sup)],
            "frecuencias": _tabla(frec_vista, limite=60),
            "ordenados": [_valor(v) for v in ordenados],
            "interpretacion": f"La muestra tiene {resumen.n} observaciones. {forma}",
            "nota": ("La desviación y la varianza usan la corrección muestral (n−1). Los cuartiles usan "
                     "interpolación lineal y los bigotes llegan al dato más extremo dentro de 1,5·IQR."),
            "avisos": avisos,
        }
    )


# ---------------------------------------------------------------------------
# Probabilidad
# ---------------------------------------------------------------------------

@app.post("/api/probabilidad/combinatoria")
def api_combinatoria():
    datos = _cuerpo()
    tipo = _texto(datos.get("tipo"), "tipo")
    if tipo == "factorial":
        n = _entero(datos.get("n"), "n")
        valor = combinatoria.factorial(n)
        formula = rf"{n}!"
        pasos = [f"{n}! = {' × '.join(str(i) for i in range(n, 0, -1)) if 0 < n <= 12 else 'producto de 1 a ' + str(n)}"]
        etiqueta = f"{n}!"
    elif tipo in {"permutaciones", "combinaciones"}:
        n = _entero(datos.get("n"), "n")
        k = _entero(datos.get("k"), "k")
        if tipo == "permutaciones":
            valor = combinatoria.permutaciones(n, k)
            formula = rf"P({n},{k})=\frac{{{n}!}}{{({n}-{k})!}}"
            etiqueta = f"P({n}, {k})"
            pasos = [f"Ordenan {k} elementos de un total de {n}; importa el orden y no hay repetición."]
        else:
            valor = combinatoria.combinaciones(n, k)
            formula = rf"\binom{{{n}}}{{{k}}}=\frac{{{n}!}}{{{k}!({n}-{k})!}}"
            etiqueta = f"C({n}, {k})"
            pasos = [f"Eligen {k} elementos de {n}; el orden no importa y no hay repetición."]
    elif tipo == "permutaciones_repetidas":
        crudos = datos.get("conteos")
        if _vacio(crudos) and not isinstance(crudos, (list, tuple)):
            raise ErrorPeticion("Indica los tamaños de cada grupo.", campo="conteos")
        conteos = [_entero(v, "conteos") for v in _lectura(crudos, "conteos", minimo=1, maximo=1000).valores]
        valor = combinatoria.permutaciones_repetidas(conteos)
        total = sum(conteos)
        denominador = r" \cdot ".join(str(c) + "!" for c in conteos)
        formula = rf"\frac{{{total}!}}{{{denominador}}}"
        etiqueta = f"Permutaciones de {total} elementos"
        pasos = [f"Total de elementos: {total}; grupos indistinguibles: {', '.join(map(str, conteos))}."]
    else:
        raise ErrorPeticion("Tipo de cálculo combinatorio desconocido.", campo="tipo")
    aproximado = isinstance(valor, combinatoria.Magnitud)
    respuesta = {
        "tipo": tipo,
        "resultado": str(valor),
        "etiqueta": etiqueta,
        "formula": formula,
        "pasos": pasos,
        "digitos": valor.digitos if aproximado else len(str(valor)),
        "exacto": not aproximado,
    }
    if aproximado:
        respuesta["mantisa"] = valor.mantisa
        respuesta["exponente"] = valor.exponente
        respuesta["nota"] = (
            f"El resultado tiene {valor.digitos:,} cifras".replace(",", "\u202f") +
            f" (más de {combinatoria.MAX_DIGITOS:,}".replace(",", "\u202f") +
            "): se muestra su orden de magnitud con 10 decimales en lugar del entero completo.")
    return jsonify(respuesta)


@app.post("/api/probabilidad/condicional")
def api_condicional():
    datos = _cuerpo()
    interseccion = _racional(datos.get("interseccion"), "P(A ∩ B)", "interseccion")
    condicion = _racional(datos.get("condicion"), "P(B)", "condicion")
    for etiqueta, valor_p, campo in (("P(A ∩ B)", interseccion, "interseccion"), ("P(B)", condicion, "condicion")):
        if not 0 <= valor_p <= 1:
            raise ParametroInvalidoError(f"{etiqueta} debe estar entre 0 y 1.", campo=campo)
    pa = None if _vacio(datos.get("pa")) else _racional(datos.get("pa"), "P(A)", "pa")
    exacto = all(isinstance(v, Fraction) for v in (interseccion, condicion) + (() if pa is None else (pa,)))
    if not exacto:  # una sola aritmética: o todo fracciones, o todo decimales
        interseccion, condicion = float(interseccion), float(condicion)
        pa = None if pa is None else float(pa)
    valor = prob.condicional(interseccion, condicion)
    independencia = None
    if pa is not None:
        if not 0 <= pa <= 1:
            raise ParametroInvalidoError("P(A) debe estar entre 0 y 1.", campo="pa")
        independencia = {
            "independientes": bool(prob.independientes(pa, condicion, interseccion)),
            "producto": _valor(pa * condicion),
            "producto_exacto": _fraccion_texto(pa * condicion),
            "interseccion": _valor(interseccion),
            "criterio": ("comparación exacta de fracciones" if exacto else
                         f"|P(A∩B) − P(A)·P(B)| ≤ {prob.TOLERANCIA:g}"),
        }
    factor = (valor / pa) if pa else None
    return jsonify(
        {
            "resultado": _valor(valor),
            "resultado_exacto": _fraccion_texto(valor),
            "formula": r"P(A\mid B)=\frac{P(A\cap B)}{P(B)}",
            "detalle": {
                "interseccion": _valor(interseccion),
                "condicion": _valor(condicion),
                "pa": _valor(pa) if pa is not None else None,
                "pb": _valor(condicion),
                "condicional_inversa": _valor(interseccion / pa) if pa else None,
                "condicional_inversa_exacta": _fraccion_texto(interseccion / pa) if pa else None,
            },
            "independencia": independencia,
            "interpretacion": (
                f"Saber que ocurrió B multiplica la probabilidad de A por {_fmt_compacto(round(float(factor), 6))}."
                if pa else "Se ha normalizado la probabilidad conjunta por P(B)."),
            "avisos": _avisos_entrada(),
        }
    )


def _fraccion_texto(valor) -> str | None:
    """Forma exacta «a/b» de un resultado racional (None si se calculó en decimales)."""
    if not isinstance(valor, Fraction):
        return None
    if valor.denominator == 1:
        return str(valor.numerator)
    if valor.denominator > 10**12:
        return None
    return f"{valor.numerator}/{valor.denominator}"


@app.post("/api/probabilidad/bayes")
def api_bayes():
    datos = _cuerpo()
    hipotesis = datos.get("hipotesis")
    if not isinstance(hipotesis, list) or len(hipotesis) < 2:
        raise ErrorPeticion("Añade al menos dos hipótesis con su probabilidad previa y su verosimilitud.",
                            campo="hipotesis")
    priores, verosimilitudes, nombres = [], [], []
    for i, fila in enumerate(hipotesis, start=1):
        if not isinstance(fila, dict):
            raise ErrorPeticion(f"La fila {i} no es válida.", campo="hipotesis")
        nombres.append(str(fila.get("nombre") or f"Hipótesis {i}").strip()[:60])
        prior = _racional(fila.get("prior"), f"prior de {nombres[-1]}", f"hipotesis.{i - 1}.prior")
        verosimilitud = _racional(fila.get("likelihood"), f"verosimilitud de {nombres[-1]}",
                                  f"hipotesis.{i - 1}.likelihood")
        if not 0 <= prior <= 1:
            raise ParametroInvalidoError(f"El prior de {nombres[-1]} debe estar entre 0 y 1.",
                                         campo=f"hipotesis.{i - 1}.prior")
        if not 0 <= verosimilitud <= 1:
            raise ParametroInvalidoError(f"La verosimilitud de {nombres[-1]} debe estar entre 0 y 1.",
                                         campo=f"hipotesis.{i - 1}.likelihood")
        priores.append(prior)
        verosimilitudes.append(verosimilitud)
    exacto = all(isinstance(v, Fraction) for v in (*priores, *verosimilitudes))
    if exacto and sum(priores, Fraction(0)) != 1:
        # Decimales redondeados (0,333333333333 × 3): no suman 1 exactamente; se
        # pasa a coma flotante y decide la tolerancia documentada.
        exacto = False
    if not exacto:
        priores, verosimilitudes = [float(v) for v in priores], [float(v) for v in verosimilitudes]
    if not prob.suma_uno(priores):
        suma = float(sum(priores))
        raise ParametroInvalidoError(
            f"Las probabilidades previas deben sumar 1 (suman {_fmt_suma(suma)}).",
            campo="hipotesis",
            sugerencia="Si son tercios o séptimos, escríbelas como fracción (por ejemplo 1/3).")
    total = prob.probabilidad_total(priores, verosimilitudes)
    if total <= 0:
        raise ParametroInvalidoError("La evidencia tiene probabilidad cero: revisa las verosimilitudes.",
                                     campo="hipotesis")
    posteriores = [prob.bayes(i, priores, verosimilitudes) for i in range(len(priores))]
    return jsonify(
        {
            "total": _valor(total),
            "total_exacto": _fraccion_texto(total),
            "exacto": exacto,
            "formula": r"P(B_i\mid A)=\frac{P(B_i)P(A\mid B_i)}{\sum_j P(B_j)P(A\mid B_j)}",
            "filas": [
                {
                    "nombre": n,
                    "prior": _valor(p),
                    "likelihood": _valor(v),
                    "conjunta": _valor(p * v),
                    "posterior": _valor(post),
                    "posterior_exacto": _fraccion_texto(post),
                }
                for n, p, v, post in zip(nombres, priores, verosimilitudes, posteriores)
            ],
            "interpretacion": "Las probabilidades posteriores suman 1; la evidencia redistribuye la credibilidad entre las hipótesis.",
        }
    )


@app.post("/api/probabilidad/variable")
def api_variable():
    datos = _cuerpo()
    valores_l = _lectura(datos.get("valores"), "valores", minimo=1, fraccion=True).valores
    masas_l = _lectura(datos.get("masas"), "masas", minimo=1, fraccion=True).valores
    if len(valores_l) != len(masas_l):
        raise ParametroInvalidoError(
            f"Cada valor necesita su probabilidad (hay {len(valores_l)} valores y {len(masas_l)} probabilidades).",
            campo="masas")
    if any(m < 0 or m > 1 for m in masas_l):
        raise ParametroInvalidoError("Cada masa de probabilidad debe estar entre 0 y 1.", campo="masas")
    if not all(isinstance(m, Fraction) for m in masas_l) or sum(masas_l, Fraction(0)) != 1:
        # Sin suma exacta (decimales redondeados) se trabaja en coma flotante con tolerancia.
        masas_l = [float(m) for m in masas_l]
    if not prob.suma_uno(masas_l):
        suma = float(sum(masas_l))
        raise ParametroInvalidoError(
            f"Las probabilidades deben sumar 1 (suman {_fmt_suma(suma)}).", campo="masas",
            sugerencia="Si son tercios o séptimos, escríbelas como fracción (por ejemplo 1/3).")
    # Los valores decimales exactos (0,5; 2; 1/3) se pasan a fracción para dar formas exactas.
    valores_exactos = [v if isinstance(v, Fraction) else Fraction(repr(v)) for v in valores_l]
    exactos = prob.momentos_exactos(valores_exactos, masas_l) if all(isinstance(m, Fraction) for m in masas_l) else None
    valores = np.asarray([float(v) for v in valores_l], dtype=float)
    masas = np.asarray([float(m) for m in masas_l], dtype=float)
    esperanza = prob.esperanza(valores_l, masas_l)
    varianza = prob.varianza(valores_l, masas_l)
    segundo = float((valores ** 2) @ masas)
    mgf = None
    if not _vacio(datos.get("t")):
        mgf = _valor(prob.generadora_momentos(_numero(datos.get("t"), "t"), valores_l, masas_l))
    desviacion = math.sqrt(max(0.0, varianza))
    return jsonify(
        {
            "esperanza": _valor(esperanza),
            "varianza": _valor(varianza),
            "esperanza_exacta": _fraccion_texto(exactos[0]) if exactos else None,
            "varianza_exacta": _fraccion_texto(exactos[1]) if exactos else None,
            "desviacion": _valor(desviacion),
            "segundo_momento": _valor(segundo),
            "mgf": mgf,
            "formula": r"E[X]=\sum_i x_ip_i,\qquad \operatorname{Var}(X)=E[X^2]-E[X]^2",
            "distribucion": [
                {"x": _valor(x), "p": _valor(p)} for x, p in zip(valores, masas)
            ],
            "interpretacion": (f"El valor esperado es {_fmt_compacto(esperanza)} y la dispersión típica "
                               f"alrededor de él es {_fmt_compacto(desviacion)}."),
            "avisos": _avisos_entrada(),
        }
    )


# ---------------------------------------------------------------------------
# Inferencia
# ---------------------------------------------------------------------------

_FAMILIAS_NULAS = {
    "normal": lambda n: stats.norm,
    "t": lambda n: stats.t(df=n["gl"]),
    "chi2": lambda n: stats.chi2(df=n["gl"]),
    "f": lambda n: stats.f(dfn=n["gl"], dfd=n["gl2"]),
}


def _curva_prueba(resultado):
    """Curva nula, valores críticos y región de rechazo a partir de ``resultado.nula``.

    La curva se dibuja **solo** con la distribución con la que el motor calculó
    el p-valor.  Así el marcador del estadístico cae en la zona de rechazo si y
    solo si la prueba rechaza H₀.  Las pruebas exactas no tienen curva.
    """
    nula = resultado.nula
    if not nula or nula["familia"] not in _FAMILIAS_NULAS:
        return None
    alfa = resultado.alfa
    try:
        dist = _FAMILIAS_NULAS[nula["familia"]](nula)
        est = float(nula["estadistico"])
        bajo, alto = float(dist.ppf(1e-5)), float(dist.ppf(1 - 1e-5))
        if not math.isfinite(bajo) or not math.isfinite(alto) or bajo >= alto:
            return None
        # El eje se amplía para que el estadístico sea visible, salvo que quede tan
        # lejos que la curva se reduciría a una aguja ilegible: entonces se dibuja
        # el cuerpo de la distribución y la interfaz indica que el estadístico
        # cae fuera del rango mostrado.
        ancho = alto - bajo
        margen = 0.06 * ancho
        visible = bajo - 1.5 * ancho <= est <= alto + 1.5 * ancho
        if nula["familia"] in {"chi2", "f"}:
            bajo = max(0.0, bajo)
            if visible:
                alto = max(alto, est + margen)
        elif visible:
            bajo, alto = min(bajo, est - margen), max(alto, est + margen)
        xs = np.linspace(bajo, alto, 240)
        ys = dist.pdf(xs)
        if nula["familia"] in {"chi2", "f"} and not math.isfinite(float(ys[0])):
            xs = xs[1:]
            ys = ys[1:]
        cola = nula["cola"]
        if cola == "izquierda":
            critico_bajo, critico_alto, region = float(dist.ppf(alfa)), None, "izquierda"
        elif cola == "derecha":
            critico_bajo, critico_alto, region = None, float(dist.isf(alfa)), "derecha"
        else:
            critico_bajo, critico_alto, region = float(dist.ppf(alfa / 2)), float(dist.isf(alfa / 2)), "bilateral"
        en_rechazo = ((critico_bajo is not None and est < critico_bajo) or
                      (critico_alto is not None and est > critico_alto))
        if en_rechazo != resultado.rechaza:
            # Solo puede ocurrir por redondeo exactamente en la frontera; se prefiere
            # no dibujar a dibujar una figura que contradiga el veredicto.
            log.warning("Curva incoherente con la decisión en %s; se omite.", resultado.metodo)
            return None
        parametros = {}
        if nula["gl"] is not None:
            parametros["gl1" if nula["familia"] == "f" else "gl"] = nula["gl"]
        if nula["gl2"] is not None:
            parametros["gl2"] = nula["gl2"]
        return {
            "x": [_valor(v) for v in xs],
            "y": [_valor(v) for v in ys],
            "familia": nula["familia"],
            "parametros": _valor(parametros),
            "estadistico": _valor(est),
            "etiqueta": nula["etiqueta"],
            "aproximada": bool(nula["aproximada"]),
            "critico_bajo": _valor(critico_bajo),
            "critico_alto": _valor(critico_alto),
            "region": region,
        }
    except (ValueError, FloatingPointError, KeyError, TypeError):
        log.exception("No se pudo generar la curva nula de %s", resultado.metodo)
        return None


def _hipotesis(spec: dict, resultado, datos: dict) -> dict:
    """H₀ y H₁ tal como se contrastaron (con la alternativa y los valores reales)."""
    h0 = spec.get("h0")
    h1 = (spec.get("h1_alternativas") or {}).get(resultado.alternativa or "", spec.get("h1"))
    sustituciones = {}
    if spec.get("clave") in {"t_una", "z_una"} and not _vacio(datos.get("mu0")):
        sustituciones["μ₀"] = _fmt_compacto(_numero(datos.get("mu0"), "mu0"))
    if spec.get("clave") == "prop_una" and not _vacio(datos.get("p0")):
        sustituciones["p₀"] = _fmt_compacto(_numero(datos.get("p0"), "p0"))
    for simbolo, valor in sustituciones.items():
        h0, h1 = h0.replace(simbolo, valor), h1.replace(simbolo, valor)
    return {"h0": h0, "h1": h1}


_ETIQUETAS_ALTERNATIVA = {"two-sided": "bilateral", "less": "unilateral izquierda", "greater": "unilateral derecha"}


@app.post("/api/inferencia")
def api_inferencia():
    datos = _cuerpo()
    prueba = _texto(datos.get("prueba"), "prueba")
    spec = next((p for p in CATALOGO_PRUEBAS if p["clave"] == prueba), None)
    if spec is None:
        raise ErrorPeticion(f"Prueba desconocida: «{prueba}».", campo="prueba")
    alfa = _numero(datos.get("alfa"), "alfa", 0.05)
    try:
        validar_nivel(alfa)
    except ErrorAmPu as exc:
        raise exc.con_campo("alfa")
    alternativa = datos.get("alternativa") or "two-sided"
    if alternativa not in inf.ALTERNATIVAS:
        raise ErrorPeticion("La alternativa debe ser bilateral, menor o mayor.", campo="alternativa")
    if not spec.get("admite_alternativa") and alternativa != "two-sided":
        raise ParametroInvalidoError(
            f"«{spec['nombre']}» no admite una alternativa unilateral: contrasta cualquier diferencia.",
            campo="alternativa", sugerencia="Quita la alternativa o elige una prueba con dirección.")

    def serie(nombre, minimo=2):
        return _serie(datos.get(nombre), nombre, minimo=minimo)

    if prueba == "t_una":
        resultado = inf.t_una_muestra(serie("datos"), _numero(datos.get("mu0"), "mu0"), alfa, alternativa)
    elif prueba == "z_una":
        resultado = inf.z_una_muestra(serie("datos"), _numero(datos.get("mu0"), "mu0"),
                                      _numero(datos.get("sigma"), "sigma"), alfa, alternativa)
    elif prueba == "t_dos":
        resultado = inf.t_dos_muestras(serie("datos"), serie("datos2"), alfa, alternativa)
    elif prueba == "z_dos":
        resultado = inf.z_dos_muestras(serie("datos"), serie("datos2"),
                                       _numero(datos.get("sigma_a"), "sigma_a"),
                                       _numero(datos.get("sigma_b"), "sigma_b"), alfa, alternativa)
    elif prueba == "prop_una":
        resultado = inf.proporcion_una(_entero(datos.get("exitos"), "exitos"), _entero(datos.get("n"), "n"),
                                       _numero(datos.get("p0"), "p0"), alfa, alternativa)
    elif prueba == "prop_dos":
        resultado = inf.proporcion_dos(
            _entero(datos.get("x1"), "x1"), _entero(datos.get("n1"), "n1"),
            _entero(datos.get("x2"), "x2"), _entero(datos.get("n2"), "n2"), alfa, alternativa,
        )
    elif prueba == "chi_bondad":
        resultado = inf.chi_bondad(
            serie("observadas"), serie("esperadas"),
            alfa, _entero(datos.get("parametros_estimados"), "parametros_estimados", 0),
        )
    elif prueba == "chi_indep":
        resultado = inf.chi_independencia(_matriz(datos.get("tabla"), "tabla"), alfa)
    elif prueba == "anova":
        resultado = inf.anova(_grupos(datos.get("grupos")), alfa)
    elif prueba == "correlacion":
        metodo = datos.get("metodo") or "pearson"
        resultado = inf.correlacion(serie("x", 3), serie("y", 3), metodo, alfa, alternativa)
    elif prueba == "mann_whitney":
        resultado = inf.mann_whitney(serie("datos"), serie("datos2"), alfa, alternativa)
    elif prueba == "wilcoxon":
        resultado = inf.wilcoxon(serie("datos"), serie("datos2"), alfa, alternativa)
    else:
        resultado = inf.kruskal(_grupos(datos.get("grupos")), alfa)

    return jsonify(
        {
            "prueba": prueba,
            "nombre": spec.get("nombre", prueba),
            "metodo": resultado.metodo,
            "estadistico": _valor(resultado.estadistico),
            "simbolo": resultado.simbolo,
            "p_valor": _valor(resultado.p_valor),
            "p_texto": inf.formatear_p(resultado.p_valor),
            "exacta": resultado.exacta,
            "alfa": alfa,
            "gl": _valor(resultado.gl),
            "intervalo": _valor(resultado.intervalo),
            "intervalo_de": resultado.intervalo_de,
            "intervalo_nivel": round(1 - alfa, 12),
            "conclusion": resultado.conclusion,
            "rechaza": bool(resultado.rechaza),
            "detalles": _valor(resultado.detalles),
            "extras": _valor(resultado.extras),
            "avisos": [*_avisos_entrada(), *resultado.avisos],
            "hipotesis": _hipotesis(spec, resultado, datos),
            "supuestos": spec.get("supuestos"),
            "teoria": spec.get("teoria"),
            "curva": _curva_prueba(resultado),
            "alternativa": resultado.alternativa,
            "alternativa_texto": _ETIQUETAS_ALTERNATIVA.get(resultado.alternativa or "", None),
            "admite_alternativa": bool(spec.get("admite_alternativa")),
        }
    )


# ---------------------------------------------------------------------------
# Regresión
# ---------------------------------------------------------------------------

def _parse_predictores(valor, n: int) -> np.ndarray:
    """Acepta una serie, una lista plana o una matriz escrita por filas."""
    if _vacio(valor) and not isinstance(valor, (list, tuple)):
        raise ErrorPeticion("Faltan los predictores X.", campo="x")
    valor = _json_si_procede(valor, "x")
    if isinstance(valor, (list, tuple)) and valor and not isinstance(valor[0], (list, tuple, str)):
        valor = [[v] for v in valor]
    filas = entrada.leer_matriz(valor, "x", rectangular=True)
    matriz = np.asarray(filas, dtype=float)
    if matriz.shape[0] == 1 and matriz.shape[1] == n:
        # Una sola línea con todos los valores: es un predictor, no una fila.
        matriz = matriz.reshape(-1, 1)
    if matriz.shape[0] != n:
        raise ParametroInvalidoError(
            f"X debe tener {n} filas, una por cada valor de Y (ahora tiene {matriz.shape[0]}).", campo="x",
            sugerencia="Escribe una observación por línea, con sus predictores separados por espacios.")
    return matriz


def _parse_predicciones(valor, p: int) -> np.ndarray:
    """Acepta una o varias filas de predictores para predecir."""
    valor = _json_si_procede(valor, "predecir")
    if isinstance(valor, (list, tuple)) and valor and not isinstance(valor[0], (list, tuple, str)):
        plana = entrada.leer_serie(list(valor), "predecir").valores
        if len(plana) % p:
            raise ParametroInvalidoError(f"Cada fila de predicción necesita {p} valores.", campo="predecir")
        valor = [plana[i:i + p] for i in range(0, len(plana), p)]
    filas = entrada.leer_matriz(valor, "predecir", rectangular=False)
    if any(len(f) != p for f in filas):
        raise ParametroInvalidoError(
            f"Cada fila de predicción debe tener {p} predictor{'es' if p != 1 else ''}.", campo="predecir")
    return np.asarray(filas, dtype=float)


@app.post("/api/regresion")
def api_regresion():
    datos = _cuerpo()
    y = _serie(datos.get("y"), "y", minimo=3)
    x = _parse_predictores(datos.get("x"), len(y))
    confianza = _numero(datos.get("confianza"), "confianza", 0.95)
    try:
        validar_nivel(confianza)
    except ErrorAmPu as exc:
        raise exc.con_campo("confianza")
    alfa = round(1 - confianza, 12)
    nombres = datos.get("nombres")
    if isinstance(nombres, str):
        nombres = [n.strip() for n in re.split(r"[,;]", nombres) if n.strip()]
    if nombres and len(nombres) != x.shape[1]:
        raise ParametroInvalidoError(
            f"Indica {x.shape[1]} nombres de predictor o deja el campo vacío.", campo="nombres")
    if x.shape[1] == 1:
        resultado = reg.lineal_simple(x[:, 0], y, confianza)
    else:
        resultado = reg.lineal_multiple(x, y, confianza, nombres)

    beta = np.asarray(resultado.coeficientes, dtype=float)
    inferiores = np.asarray(resultado.intervalos, dtype=float)[:, 0]
    superiores = np.asarray(resultado.intervalos, dtype=float)[:, 1]
    errores = np.asarray(resultado.errores, dtype=float)
    diag = resultado.diagnostico or {}
    diseño = np.column_stack([np.ones(len(y)), x])
    y_hat = diseño @ beta
    residuos = y - y_hat
    sse = float(residuos @ residuos)
    sst = float(((y - y.mean()) ** 2).sum())
    rmse = math.sqrt(sse / resultado.gl)

    coeficientes = []
    for nombre, est, inf_i, sup_i, err, p in zip(
        resultado.nombres, beta, inferiores, superiores, errores, np.asarray(resultado.p_valores)
    ):
        coeficientes.append({
            "nombre": nombre,
            "estimacion": _valor(est),
            "error": _valor(err),
            "ic_inferior": _valor(inf_i),
            "ic_superior": _valor(sup_i),
            "p_valor": _valor(p),
            "significativo": bool(float(p) < alfa),
        })

    puntos = [{"x": _valor(v), "y": _valor(float(yi))} for v, yi in zip(x[:, 0], y)]
    ajuste = None
    if x.shape[1] == 1:
        xs = np.linspace(float(x.min()), float(x.max()), 120)
        ajuste = {"x": [_valor(v) for v in xs], "y": [_valor(v) for v in beta[0] + beta[1] * xs]}

    predicciones = None
    if datos.get("predecir"):
        nuevos = _parse_predicciones(datos["predecir"], x.shape[1])
        vals = np.atleast_1d(resultado.predecir(nuevos))
        # Intervalos para la media y para una observación nueva, y aviso de extrapolación.
        xtx_inv = np.linalg.inv(diseño.T @ diseño)
        tcrit = float(stats.t.ppf((1 + confianza) / 2, resultado.gl))
        minimos, maximos = x.min(axis=0), x.max(axis=0)
        predicciones = []
        for i, (fila, v) in enumerate(zip(nuevos, vals)):
            x0 = np.concatenate([[1.0], fila])
            h0 = float(x0 @ xtx_inv @ x0)
            se_media, se_pred = rmse * math.sqrt(h0), rmse * math.sqrt(1 + h0)
            fuera = bool(np.any(fila < minimos) or np.any(fila > maximos))
            predicciones.append({
                "fila": i + 1, "prediccion": _valor(v),
                "ic_media": [_valor(v - tcrit * se_media), _valor(v + tcrit * se_media)],
                "ic_prediccion": [_valor(v - tcrit * se_pred), _valor(v + tcrit * se_pred)],
                "extrapola": fuera,
            })
        if any(pr["extrapola"] for pr in predicciones):
            avisos_pred = ("Alguna predicción cae fuera del rango de los datos observados (extrapolación): "
                           "el modelo no está respaldado por datos en esa zona.")
        else:
            avisos_pred = None
    else:
        avisos_pred = None

    r2 = float(resultado.r_cuadrado)
    r2_ajustado = 1 - (1 - r2) * (len(y) - 1) / resultado.gl if resultado.gl > 0 else None

    return jsonify(
        {
            "n": int(resultado.n),
            "gl": int(resultado.gl),
            "predictores": int(x.shape[1]),
            "coeficientes": coeficientes,
            "bondad": {
                "r2": _valor(r2),
                "r2_ajustado": _valor(r2_ajustado),
                "rmse": _valor(rmse),
                "sse": _valor(sse),
                "sst": _valor(sst),
                "confianza": confianza,
                "alfa": alfa,
                "f": _valor(diag.get("f")),
                "gl_modelo": diag.get("gl_modelo"),
                "gl_residual": diag.get("gl_residual"),
                "p_f": _valor(diag.get("p_f")),
            },
            "diagnostico": {
                "shapiro_p": _valor(diag.get("shapiro_p")),
                "breusch_pagan_p": _valor(diag.get("breusch_pagan_p")),
                "durbin_watson": _valor(diag.get("durbin_watson")),
                "influyentes": diag.get("influyentes", []),
                "atipicos": diag.get("atipicos", []),
                "vif": _valor(diag.get("vif")),
                "condicion": _valor(diag.get("condicion")),
            },
            "avisos": [*_avisos_entrada(), *diag.get("avisos", []), *([avisos_pred] if avisos_pred else [])],
            "puntos": puntos,
            "ajuste": ajuste,
            "residuos": [
                {"ajustado": _valor(float(a)), "residuo": _valor(float(r)), "observado": _valor(float(o)),
                 "estandarizado": _valor(float(e)), "apalancamiento": _valor(float(h)), "cook": _valor(float(c))}
                for a, r, o, e, h, c in zip(y_hat, residuos, y, diag["estandarizados"], diag["apalancamiento"],
                                            diag["cook"])
            ],
            "predicciones": predicciones,
            "conclusion": resultado.conclusion,
            "nota": "Los intervalos son al nivel de confianza indicado. La asociación no implica causalidad.",
        }
    )


# ---------------------------------------------------------------------------
# Muestreo
# ---------------------------------------------------------------------------

@app.post("/api/muestreo/tamano")
def api_tamano():
    datos = _cuerpo()
    tipo = _texto(datos.get("tipo"), "tipo")
    confianza = _numero(datos.get("confianza"), "confianza", 0.95)
    error = _numero(datos.get("error"), "error", 0.05)
    N = datos.get("N")
    N = _entero(N, "N") if N not in (None, "") else None
    if tipo == "proporcion":
        n = muestreo_aleatorio.tamano_proporcion(_numero(datos.get("p"), "p", 0.5), error, confianza, N)
        formula = r"n=\frac{z^2p(1-p)}{e^2}"
    elif tipo == "media":
        n = muestreo_aleatorio.tamano_media(_numero(datos.get("sigma"), "sigma"), error, confianza, N)
        formula = r"n=\left(\frac{z\sigma}{e}\right)^2"
    elif tipo == "diferencia_medias":
        n = muestreo_aleatorio.tamano_diferencia_medias(
            _numero(datos.get("sigma1"), "sigma1"), _numero(datos.get("sigma2"), "sigma2"), error, confianza
        )
        formula = r"n_{\text{por grupo}}=\frac{z^2(\sigma_1^2+\sigma_2^2)}{e^2}"
    elif tipo == "diferencia_proporciones":
        n = muestreo_aleatorio.tamano_diferencia_proporciones(
            _numero(datos.get("p1"), "p1"), _numero(datos.get("p2"), "p2"), error, confianza
        )
        formula = r"n_{\text{por grupo}}=\frac{z^2[p_1(1-p_1)+p_2(1-p_2)]}{e^2}"
    else:
        raise ErrorPeticion("Tipo de tamaño muestral desconocido.", campo="tipo")
    return jsonify({"n": n, "formula": formula, "confianza": confianza, "error": error, "N": N})


@app.post("/api/muestreo")
def api_muestreo():
    datos = _cuerpo()
    metodo = _texto(datos.get("metodo"), "metodo")
    N = _entero(datos.get("N"), "N", 1000)
    n = _entero(datos.get("n"), "n", 100)
    semilla = _entero(datos.get("semilla"), "semilla", 42)
    auto = _booleano(datos.get("auto"), False)
    p = _numero(datos.get("p"), "p", 0.5)
    error = _numero(datos.get("error"), "error", 0.05)
    confianza = _numero(datos.get("confianza"), "confianza", 0.95)
    estratos_crudos = datos.get("estratos") or []
    estratos = None
    if estratos_crudos:
        estratos = []
        for i, fila in enumerate(estratos_crudos, start=1):
            if not isinstance(fila, dict):
                raise ErrorPeticion(f"El estrato {i} no es válido.", campo="estratos")
            nombre = str(fila.get("nombre") or f"Estrato {i}").strip()
            tam = _entero(fila.get("N"), f"N de {nombre}")
            sigma = _numero(fila.get("sigma"), f"σ de {nombre}", 1.0)
            costo = _numero(fila.get("costo"), f"coste de {nombre}", 1.0)
            estratos.append((nombre, tam, sigma, costo))
        if auto:
            N = sum(e[1] for e in estratos)
    resultado = ejecutar_diseno(
        metodo, N, n, semilla, estratos, auto, p, error, confianza, None,
        _entero(datos.get("n_por_grupo"), "n_por_grupo") if datos.get("n_por_grupo") not in (None, "") else None,
    )
    tablas = {nombre: _tabla(df) for nombre, df in resultado.tablas.items()}
    return jsonify(
        {
            "metodo": metodo,
            "resumen": resultado.resumen,
            "semilla": resultado.semilla,
            "tablas": tablas,
            "etiquetas": _valor(resultado.etiquetas),
            "poblacion": _valor(resultado.poblacion),
            "seleccion": _valor(resultado.seleccion),
            "tasa": _valor([s / p if p else 0 for s, p in zip(resultado.seleccion, resultado.poblacion)]),
            "total_poblacion": int(sum(resultado.poblacion)),
            "total_muestra": int(sum(resultado.seleccion)),
        }
    )


# ---------------------------------------------------------------------------
# Simulación
# ---------------------------------------------------------------------------

def _convergencia(valores: np.ndarray, escala: float = 1.0, puntos: int = 120, confianza: float = 0.95) -> dict:
    """Trayectoria de la estimación con su banda al **nivel de confianza pedido**."""
    n = len(valores)
    z = float(stats.norm.ppf((1 + confianza) / 2))
    pasos = np.unique(np.linspace(max(1, n // puntos), n, min(puntos, n)).astype(int))
    medias = np.cumsum(valores)[pasos - 1] / pasos
    valores_est = medias * escala
    if n > 1:
        acum2 = np.cumsum(valores ** 2)
        var = np.maximum(acum2[pasos - 1] / pasos - medias ** 2, 0)
        se = np.sqrt(var / pasos) * abs(escala)
    else:
        se = np.zeros_like(medias)
    return {
        "n": [_valor(int(v)) for v in pasos],
        "valor": [_valor(v) for v in valores_est],
        "ic_inferior": [_valor(v - z * s) for v, s in zip(valores_est, se)],
        "ic_superior": [_valor(v + z * s) for v, s in zip(valores_est, se)],
        "confianza": confianza,
    }


@app.post("/api/simulacion")
def api_simulacion():
    datos = _cuerpo()
    tipo = _texto(datos.get("tipo"), "tipo")
    semilla = _entero(datos.get("semilla"), "semilla", 42)
    n = _entero(datos.get("n"), "n", 10_000)
    confianza = _numero(datos.get("confianza"), "confianza", 0.95)
    try:
        validar_nivel(confianza)
    except ErrorAmPu as exc:
        raise exc.con_campo("confianza")

    if tipo == "pi":
        estimacion = montecarlo.simular_pi(n, semilla, confianza)
        coordenadas, dentro = montecarlo.puntos_pi(n, semilla)
        paso = max(1, n // 2500)
        puntos = [
            {"x": _valor(float(px)), "y": _valor(float(py)), "dentro": bool(d)}
            for (px, py), d in zip(coordenadas[::paso], dentro[::paso])
        ]
        return jsonify({
            "tipo": tipo,
            "estimacion": {"valor": _valor(estimacion.valor), "error_estandar": _valor(estimacion.error_estandar),
                           "intervalo": _valor(estimacion.intervalo), "n": estimacion.n},
            "referencia": {"valor": math.pi, "etiqueta": "π"},
            "error_absoluto": _valor(abs(estimacion.valor - math.pi)),
            "puntos": puntos,
            "convergencia": _convergencia(dentro.astype(float), 4.0, confianza=confianza),
            "confianza": confianza,
            "nota": "Cada punto se genera con una semilla local; repetir con la misma semilla produce el mismo resultado.",
        })

    if tipo == "integral":
        clave = _texto(datos.get("funcion"), "funcion", obligatorio=False) or "cuadrado"
        integrando, a, b = montecarlo.integrando(
            clave,
            None if _vacio(datos.get("a")) else _numero(datos.get("a"), "a"),
            None if _vacio(datos.get("b")) else _numero(datos.get("b"), "b"),
        )
        funcion, etiqueta = integrando.funcion, integrando.etiqueta
        # La referencia es la integral exacta EN EL INTERVALO PEDIDO, F(b) − F(a).
        referencia = integrando.exacta(a, b)
        estimacion = montecarlo.integrar(funcion, a, b, n, semilla, confianza)
        x = np.random.default_rng(semilla).uniform(a, b, size=n)
        y = funcion(x)
        xs = np.linspace(a, b, 220)
        nota = (f"Valor exacto en [{_fmt_compacto(a)}, {_fmt_compacto(b)}]: {integrando.expresion_exacta} "
                f"= {_fmt_compacto(referencia)}.")
        return jsonify({
            "tipo": tipo,
            "funcion": clave,
            "etiqueta": etiqueta,
            "intervalo_integracion": [_valor(a), _valor(b)],
            "estimacion": {"valor": _valor(estimacion.valor), "error_estandar": _valor(estimacion.error_estandar),
                           "intervalo": _valor(estimacion.intervalo), "n": estimacion.n},
            "referencia": {"valor": _valor(referencia), "etiqueta": "valor exacto",
                           "expresion": integrando.expresion_exacta},
            "error_absoluto": _valor(abs(estimacion.valor - referencia)),
            "curva": {"x": [_valor(v) for v in xs], "y": [_valor(v) for v in funcion(xs)]},
            "convergencia": _convergencia(np.asarray(y), b - a, confianza=confianza),
            "confianza": confianza,
            "nota": nota,
        })

    if tipo == "muestra":
        clave = _texto(datos.get("clave"), "clave")
        modelo = obtener(clave)
        parametros = _parametros_modelo(modelo, datos.get("parametros"))
        # Se genera exactamente el tamaño pedido (el motor limita a 1 000 000 con un error declarado).
        muestra = np.asarray(montecarlo.generar_muestra(clave, parametros, n, semilla))
        nota = "Muestra simulada con semilla reproducible."
        if muestra.ndim > 1:
            muestra = muestra[:, 0]
            nota = "Se analiza la primera componente marginal de la simulación multivariante."
        params = modelo.validar(**parametros)
        if modelo.discreta:
            # Clases centradas en enteros y de anchura entera: así la altura de cada barra
            # (frecuencia relativa / anchura) es comparable con la función de masa.
            minimo, maximo = int(np.min(muestra)), int(np.max(muestra))
            paso = max(1, math.ceil((maximo - minimo + 1) / 40))
            clases = math.ceil((maximo - minimo + 1) / paso)
            bordes = minimo - 0.5 + paso * np.arange(clases + 1)
            conteos, bordes = np.histogram(muestra, bins=bordes, density=True)
            centros = (bordes[1:] + bordes[:-1]) / 2
            if paso == 1:
                xs = np.arange(minimo, maximo + 1)
                ys = modelo.pmf(xs, **params)
            else:
                xs = centros
                acumulada = np.asarray(modelo.cdf(np.floor(bordes), **params), dtype=float)
                ys = np.diff(acumulada) / paso
                nota += f" Las clases agrupan {paso} valores enteros; la curva teórica es la masa media por valor en cada clase."
        else:
            conteos, bordes = np.histogram(muestra, bins=min(40, max(8, int(math.sqrt(len(muestra))))), density=True)
            centros = (bordes[1:] + bordes[:-1]) / 2
            xs = np.linspace(float(np.min(muestra)), float(np.max(muestra)), 220)
            ys = modelo.pdf(xs, **params)
        return jsonify({
            "tipo": tipo,
            "clave": clave,
            "nombre": modelo.nombre,
            "n": int(len(muestra)),
            "resumen": {
                "media": _valor(float(np.mean(muestra))),
                "mediana": _valor(float(np.median(muestra))),
                "desviacion": _valor(float(np.std(muestra, ddof=1))),
                "minimo": _valor(float(np.min(muestra))),
                "maximo": _valor(float(np.max(muestra))),
                "q1": _valor(float(np.quantile(muestra, .25))),
                "q3": _valor(float(np.quantile(muestra, .75))),
            },
            "histograma": {"centros": [_valor(c) for c in centros], "densidad": [_valor(v) for v in conteos], "bordes": [_valor(v) for v in bordes]},
            "teorica": {"x": [_valor(v) for v in xs], "y": [_valor(v) for v in ys]},
            "discreta": bool(modelo.discreta),
            "muestra": [_valor(v) for v in muestra[:250]],
            "nota": nota,
        })

    if tipo == "ajuste":
        clave = _texto(datos.get("clave"), "clave")
        x = _serie(datos.get("datos"), "datos", minimo=5)
        ajuste = montecarlo.ajustar_distribucion(x, clave, semilla)
        xs, ys = montecarlo.curva_ajustada(ajuste, x)
        conteos, bordes = np.histogram(x, bins=min(24, max(6, int(math.sqrt(len(x))))), density=True)
        centros = (bordes[1:] + bordes[:-1]) / 2
        ordenados = np.sort(x)
        probs = (np.arange(1, len(ordenados) + 1) - 0.5) / len(ordenados)
        try:
            congelada = stats.norm(**ajuste.parametros) if clave == "normal" else {
                "exponencial": stats.expon, "gamma": stats.gamma, "weibull": stats.weibull_min,
                "lognormal": stats.lognorm, "beta": stats.beta,
            }[clave](**ajuste.parametros)
            teoricos = congelada.ppf(probs)
            qq = {"teoricos": [_valor(v) for v in teoricos], "observados": [_valor(v) for v in ordenados]}
        except Exception:  # noqa: BLE001
            qq = None
        return jsonify({
            "tipo": tipo,
            "clave": clave,
            "parametros": _valor(ajuste.parametros),
            "aic": _valor(ajuste.aic),
            "ks": _valor(ajuste.ks),
            "p_ks": _valor(ajuste.p_ks),
            "histograma": {"centros": [_valor(c) for c in centros], "densidad": [_valor(v) for v in conteos], "bordes": [_valor(v) for v in bordes]},
            "curva": {"x": [_valor(v) for v in xs], "y": [_valor(v) for v in ys]},
            "qq": qq,
            "n": int(len(x)),
            "nota": ("Ajuste por máxima verosimilitud (determinista: no depende de la semilla). El p-valor de "
                     "Kolmogorov–Smirnov es exploratorio: los parámetros se estimaron con los mismos datos."),
            "avisos": _avisos_entrada(),
        })

    if tipo == "qq":
        clave = _texto(datos.get("clave"), "clave")
        modelo = obtener(clave)
        parametros = _parametros_modelo(modelo, datos.get("parametros"))
        x = _serie(datos.get("datos"), "datos", minimo=3)
        teoricos, observados = montecarlo.qq_plot(x, clave, parametros)
        return jsonify({
            "tipo": tipo,
            "clave": clave,
            "teoricos": [_valor(v) for v in teoricos],
            "observados": [_valor(v) for v in observados],
            "n": int(len(x)),
            "nota": "Si los puntos siguen aproximadamente una recta, el modelo describe bien la muestra.",
        })

    raise ErrorPeticion("Tipo de simulación desconocido.", campo="tipo")


# ---------------------------------------------------------------------------
# Teoría
# ---------------------------------------------------------------------------

@app.get("/api/teoria/lista")
def api_teoria_lista():
    return jsonify(_catalogo_teoria(listar_teoria()))


@lru_cache(maxsize=128)
def _render_leccion(clave: str) -> dict | None:
    texto = _texto_leccion(clave)
    if texto is None:
        return None
    lineas = texto.splitlines()
    titulo = lineas[0].lstrip("# ").strip() if lineas else clave
    preparado, tokens = _preservar_matematicas(texto)
    conversor = markdown.Markdown(extensions=["tables", "fenced_code", "toc", "sane_lists"], output_format="html5")
    html = conversor.convert(preparado)
    for token, fragmento in tokens.items():
        html = html.replace(f"<p>{token}</p>", fragmento).replace(token, fragmento)
    html = html.replace('src="../imagenes/', 'src="/media/teoria/')
    html = html.replace('<table>', '<div class="tabla-scroll"><table>').replace('</table>', '</table></div>')

    def _toc(items, nivel=0):
        salida = []
        for item in items:
            salida.append({"nivel": item["level"], "texto": item["name"], "id": item["id"]})
            salida.extend(_toc(item.get("children", []), nivel + 1))
        return salida

    info = _info_leccion(clave)
    return {
        "clave": clave,
        "titulo": titulo,
        "html": html,
        "toc": _toc(conversor.toc_tokens),
        "resumen": info.get("resumen", ""),
        "minutos": info.get("minutos", 1),
        "formula": info.get("formula"),
    }


@app.get("/api/teoria/<clave>")
def api_teoria(clave: str):
    if not re.fullmatch(r"[a-z0-9_]+", clave):
        return _error("Clave de lección inválida.", 404)
    contenido = _render_leccion(clave)
    if contenido is None:
        return _error(f"No existe la lección «{clave}».", 404)
    lecciones = listar_teoria()
    claves = [c for c, _ in lecciones]
    indice = claves.index(clave) if clave in claves else -1
    anterior = claves[indice - 1] if indice > 0 else None
    siguiente = claves[indice + 1] if 0 <= indice < len(claves) - 1 else None
    titulos = dict(lecciones)
    contenido["navegacion"] = {
        "anterior": {"clave": anterior, "titulo": titulos.get(anterior)} if anterior else None,
        "siguiente": {"clave": siguiente, "titulo": titulos.get(siguiente)} if siguiente else None,
    }
    contenido["relacionados"] = _relacionados(clave)
    return jsonify(contenido)


def _relacionados(clave: str) -> list[dict]:
    mapa = {
        "bernoulli": ["binomial", "geometrica", "combinatoria"],
        "binomial": ["bernoulli", "poisson", "hipergeometrica"],
        "normal": ["normal_estandar", "t_student", "intervalos_confianza"],
        "normal_estandar": ["normal", "t_student"],
        "poisson": ["binomial", "exponencial", "montecarlo"],
        "exponencial": ["poisson", "gamma", "weibull"],
        "chi_cuadrado": ["chi_bondad", "chi_independencia", "anova"],
        "t_student": ["prueba_t_una", "prueba_t_dos", "normal"],
        "descriptiva": ["qq_plot", "correlacion", "intervalos_confianza"],
        "bayes": ["combinatoria", "probabilidad_condicional"],
        "regresion": ["correlacion", "qq_plot"],
        "montecarlo": ["integral", "normal"],
    }
    titulos = dict(listar_teoria())
    claves = mapa.get(clave, [])
    return [{"clave": c, "titulo": titulos.get(c, c)} for c in claves if c in titulos]


# ---------------------------------------------------------------------------
# Exportación
# ---------------------------------------------------------------------------

def _figura_export(payload: dict | None):
    if not payload or not payload.get("series"):
        return None
    from textwrap import fill
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    from matplotlib.figure import Figure

    fig = Figure(figsize=(8.4, 4.6), dpi=120, facecolor="white", layout="constrained")
    ax = fig.add_subplot(111)
    colores = ["#0f766e", "#1d4ed8", "#b45309", "#7c3aed", "#be123c"]
    for i, serie in enumerate(payload["series"]):
        xs, ys = serie.get("x") or [], serie.get("y") or []
        pares = [(float(a), float(b)) for a, b in zip(xs, ys) if a is not None and b is not None]
        if not pares:
            continue
        color = colores[i % len(colores)]
        if serie.get("tipo") == "barra":
            ax.bar([p[0] for p in pares], [p[1] for p in pares], color=color, alpha=.75, width=.8,
                   label=serie.get("nombre"))
        elif serie.get("tipo") == "dispersion":
            ax.scatter([p[0] for p in pares], [p[1] for p in pares], s=16, color=color, alpha=.7,
                       label=serie.get("nombre"))
        else:
            ax.plot([p[0] for p in pares], [p[1] for p in pares], color=color, linewidth=1.8,
                    label=serie.get("nombre"))
            if serie.get("relleno"):
                ax.fill_between([p[0] for p in pares], [p[1] for p in pares], color=color, alpha=.12)
    if payload.get("marcador") is not None:
        ax.axvline(float(payload["marcador"]), color="#be123c", linestyle="--", linewidth=1.2)
    if payload.get("titulo"):
        ax.set_title(payload["titulo"], fontsize=11, loc="left")
    if payload.get("xlabel"):
        ax.set_xlabel(payload["xlabel"])
    if payload.get("ylabel"):
        ax.set_ylabel(payload["ylabel"])
    ax.grid(color="#dbe4ee", linewidth=.6, alpha=.8)
    ax.set_axisbelow(True)
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    trazos, nombres = ax.get_legend_handles_labels()
    if trazos:
        columnas = min(3, len(nombres))
        # Una franja propia bajo los ejes: nunca se dibuja sobre las series.
        etiquetas = [fill(nombre, width=60 // columnas, break_on_hyphens=False) for nombre in nombres]
        leyenda = fig.legend(trazos, etiquetas, loc="outside lower center", ncols=columnas,
                             frameon=False, fontsize=8)
        for texto in leyenda.get_texts():
            texto.set_parse_math(False)  # Son nombres de la interfaz, no expresiones MathText.
        renderer = FigureCanvasAgg(fig).get_renderer()
        alto_leyenda = leyenda.get_window_extent(renderer).height / fig.dpi
        # Más filas amplían la figura en vez de reducir el área de datos.
        fig.set_figheight(fig.get_figheight() + alto_leyenda + .1)
    return fig


def _slug_archivo(texto: str) -> str:
    limpio = re.sub(r"[^a-zA-Z0-9]+", "-", unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode())
    return limpio.strip("-").lower()[:60] or "ampu-resultado"


@app.post("/api/exportar")
def api_exportar():
    datos = _cuerpo()
    formato = (_texto(datos.get("formato"), "formato") or "pdf").lower()
    titulo = str(datos.get("titulo") or "Informe AmPu 3.1")[:160]
    resumen = str(datos.get("resumen") or "")[:4000]
    tablas_crudas = datos.get("tablas") or []
    if not isinstance(tablas_crudas, list):
        raise ErrorPeticion("«tablas» debe ser una lista de tablas.")
    tablas: dict[str, pd.DataFrame] = {}
    for i, tabla in enumerate(tablas_crudas[:8], start=1):
        if not isinstance(tabla, dict):
            continue
        columnas = tabla.get("columnas") or []
        filas = tabla.get("filas") or []
        if not columnas:
            continue
        ancho = len(columnas)
        normalizadas = [(list(f) + [None] * ancho)[:ancho] for f in filas[:5000]]
        nombre = str(tabla.get("nombre") or f"Tabla {i}")[:60]
        tablas[nombre] = pd.DataFrame(normalizadas, columns=[str(c) for c in columnas])

    figura = _figura_export(datos.get("figura"))
    temp_dir = Path(tempfile.mkdtemp(prefix="ampu-export-"))
    base = _slug_archivo(titulo)
    mimetypes = {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "csv": "text/csv",
        "png": "image/png",
        "json": "application/json",
    }
    try:
        if formato in {"xlsx", "excel"}:
            if not tablas:
                raise ErrorPeticion("No hay tablas para exportar a Excel.")
            ruta = ServicioExportacion.excel(tablas, temp_dir / f"{base}.xlsx")
            nombre = f"{base}.xlsx"
        elif formato == "csv":
            if not tablas:
                raise ErrorPeticion("No hay tablas para exportar a CSV.")
            ruta = ServicioExportacion.csv(next(iter(tablas.values())), temp_dir / f"{base}.csv")
            nombre = f"{base}.csv"
        elif formato == "png":
            if figura is None:
                raise ErrorPeticion("No hay un gráfico disponible para exportar.")
            ruta = ServicioExportacion.png(figura, temp_dir / f"{base}.png")
            nombre = f"{base}.png"
        elif formato == "pdf":
            ruta = ServicioExportacion.pdf(temp_dir / f"{base}.pdf", titulo, resumen, tablas, figura, datos.get("formula"))
            nombre = f"{base}.pdf"
        elif formato == "json":
            estado = datos.get("estado") or {}
            ruta = ServicioExportacion.guardar({"titulo": titulo, "resumen": resumen, "vista": datos.get("vista"), **estado},
                                              temp_dir / f"{base}.json")
            nombre = f"{base}.json"
        else:
            raise ErrorPeticion("Formato de exportación no soportado.")
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise

    @after_this_request
    def _limpiar(respuesta):
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except OSError:
            pass
        return respuesta

    return send_file(ruta, as_attachment=True, download_name=nombre,
                     mimetype=mimetypes.get(formato, "application/octet-stream"))


# ---------------------------------------------------------------------------
# Salud y manejo de errores
# ---------------------------------------------------------------------------

@app.get("/api/salud")
def api_salud():
    return jsonify({
        "estado": "ok",
        "version": VERSION_APP,
        "motor": MOTOR_VERSION,
        "distribuciones": len(catalogo()),
        "lecciones": len(listar_teoria()),
        "offline": True,
        "hora_utc": datetime.now(timezone.utc).isoformat(),
    })


@app.errorhandler(ErrorAmPu)
def _manejar_error_ampu(error: ErrorAmPu):
    """Errores tipados del motor: mensaje en español, campo culpable y sugerencia."""
    estado = 504 if isinstance(error, TiempoExcedidoError) else 400
    return _error(str(error), estado, campo=error.campo, tipo=error.tipo, sugerencia=error.sugerencia,
                  posicion=error.posicion, detalle=error.detalle)


@app.errorhandler(KeyError)
def _manejar_keyerror(error: KeyError):
    mensaje = str(error.args[0]) if error.args else ""
    if mensaje.startswith(("Distribución no registrada", "Categoría desconocida")):
        return _error(mensaje.strip("'\""), 404, campo="clave", tipo="no_encontrado")
    return _manejar_excepcion(error)


_MENSAJES_HTTP = {
    400: "La petición no es válida.",
    403: "Acceso no permitido.",
    404: "No se encontró el recurso solicitado.",
    405: "Método no permitido para esta ruta.",
    408: "La petición tardó demasiado en llegar.",
    413: "La petición es demasiado grande (máximo 16 MB).",
    415: "Formato no admitido: la API espera JSON.",
    429: "Demasiadas peticiones seguidas.",
}


@app.errorhandler(HTTPException)
def _manejar_http(error: HTTPException):
    if request.path.startswith("/api/"):
        codigo = error.code or 500
        return _error(_MENSAJES_HTTP.get(codigo, f"Error HTTP {codigo}."), codigo, tipo="http")
    return error


@app.errorhandler(Exception)
def _manejar_excepcion(error: Exception):
    """Nunca se muestra al usuario un mensaje interno ni en otro idioma."""
    log.exception("Error no controlado en %s", request.path)
    if not request.path.startswith("/api/"):
        return "Error interno", 500
    if isinstance(error, (ValueError, ArithmeticError)):
        # Una biblioteca numérica rechazó los datos: es un problema de dominio,
        # pero su mensaje original (en inglés) se queda en el registro.
        return _error(
            "No se pudo calcular con estos datos: algún valor está fuera del dominio de la operación.",
            400, tipo="dominio", sugerencia="Revisa valores extremos, ceros o muestras sin variación.")
    return _error(
        "El motor encontró un problema interno. No es un fallo de tus datos; inténtalo de nuevo.",
        500, tipo="interno")


@app.get("/api/ejemplos")
def api_ejemplos():
    """Conjuntos de datos didácticos, listos para cargar con un clic."""
    rng = np.random.default_rng(7)
    return jsonify({
        "descriptiva": {
            "nombre": "Tiempos de atención (min)",
            "descripcion": "40 tiempos de espera con algunos valores atípicos.",
            "datos": [round(float(v), 1) for v in np.concatenate([rng.normal(18, 4, 36), [38, 41, 44, 47]])],
        },
        "t_una": {
            "nombre": "Peso de paquetes (kg)",
            "descripcion": "Muestra de 24 paquetes; la media nula es 10 kg.",
            "datos": [round(float(v), 2) for v in rng.normal(10.4, 0.6, 24)],
            "mu0": 10,
        },
        "t_dos": {
            "nombre": "Método A frente a método B",
            "descripcion": "Puntuaciones de dos métodos de enseñanza (n=18 cada uno).",
            "datos": [round(float(v), 1) for v in rng.normal(72, 6, 18)],
            "datos2": [round(float(v), 1) for v in rng.normal(77, 6, 18)],
        },
        "chi_indep": {
            "nombre": "Hábito y preferencia",
            "descripcion": "Tabla 2×3 de frecuencias observadas.",
            "tabla": "42 28 30\n18 32 40",
        },
        "regresion": {
            "nombre": "Publicidad y ventas",
            "descripcion": "Inversión publicitaria (miles €) y ventas (miles €).",
            "x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            "y": [12, 14, 17, 18, 21, 23, 24, 27, 29, 32],
            "nombres": ["publicidad"],
        },
        "ajuste": {
            "nombre": "Mediciones con distribución normal",
            "descripcion": "120 mediciones simuladas de una normal(μ=50, σ=8).",
            "datos": [round(float(v), 2) for v in rng.normal(50, 8, 120)],
        },
        "muestra": {
            "nombre": "Población de 1 200 unidades",
            "descripcion": "Cinco estratos con distinto tamaño y variabilidad.",
            "estratos": [
                {"nombre": "Norte", "N": 400, "sigma": 8, "costo": 1},
                {"nombre": "Sur", "N": 320, "sigma": 12, "costo": 1.2},
                {"nombre": "Este", "N": 240, "sigma": 6, "costo": 0.9},
                {"nombre": "Oeste", "N": 160, "sigma": 15, "costo": 1.5},
                {"nombre": "Centro", "N": 80, "sigma": 10, "costo": 1.1},
            ],
        },
    })


def servir(anfitrion: str = "127.0.0.1", puerto: int = 5000) -> None:
    """Sirve la aplicación con Waitress (servidor WSGI de producción).

    Solo si Waitress no está instalado se recurre al servidor de desarrollo de
    Werkzeug, con un aviso en el registro.
    """
    try:
        from waitress import serve
    except ImportError:
        log.warning("Waitress no está disponible: se usa el servidor de desarrollo de Flask.")
        app.run(host=anfitrion, port=puerto, debug=False, use_reloader=False, threaded=True)
        return
    serve(app, host=anfitrion, port=puerto, threads=8, channel_timeout=60, ident="AmPu",
          max_request_body_size=app.config["MAX_CONTENT_LENGTH"])


if __name__ == "__main__":
    puerto = int(os.environ.get("AMPU_PORT", os.environ.get("PORT", "5000")))
    anfitrion = os.environ.get("AMPU_HOST", "127.0.0.1")
    log.info("AmPu %s · http://%s:%s", VERSION_APP, anfitrion, puerto)
    servir(anfitrion, puerto)
