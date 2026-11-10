"""Lectura única de números, series y matrices escritos por una persona.

Regla de AmPu (idéntica en ``frontend/static/js/entrada.js``):

* Los valores se separan con espacios, tabuladores, saltos de línea o ``;``.
  Una coma seguida de espacio (``1, 2, 3``) también separa.
* El separador decimal puede ser coma o punto: ``3,14`` y ``3.14`` son el
  mismo número.  Dentro de un valor solo puede haber uno.
* Lo que admite dos lecturas **no se interpreta en silencio**: ``1,2,3`` o
  ``1.234,5`` se rechazan con una explicación y una corrección sugerida.
* No se aceptan ``NaN``, infinitos, hexadecimales, guiones bajos ni booleanos.

Las fracciones ``a/b`` se admiten solo donde se pide expresamente
(probabilidades), y entonces se conservan exactas con ``fractions.Fraction``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from fractions import Fraction
from numbers import Real

from .errores import EntradaAmbiguaError, EntradaInvalidaError

# Espacios de agrupación de miles (fino, duro) entre dígitos: 12 345 → 12345.
_AGRUPADORES = "\u202f\u00a0\u2009"
_RE_AGRUPADOR = re.compile(rf"(?<=\d)[{_AGRUPADORES}](?=\d{{3}}(?!\d))")
_RE_NUMERO = re.compile(r"^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$")
_RE_FRACCION = re.compile(r"^([+-]?\d+)\s*/\s*(\d+)$")
# Decimal «corto» escrito por una persona (0,95; 12; .5): es un racional exacto.
_RE_DECIMAL_EXACTO = re.compile(r"^[+-]?(?:\d{1,15}(?:[.,]\d{0,15})?|[.,]\d{1,15})$")
_RE_MILES_PUNTO = re.compile(r"^[+-]?\d{1,3}(?:\.\d{3})+$")
_MENOS = str.maketrans({"−": "-", "–": "-", "—": "-", "\ufeff": ""})


@dataclass
class Lectura:
    """Resultado de leer un texto: valores, cómo se leyó y qué conviene revisar."""

    valores: list = field(default_factory=list)
    tokens: list[str] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)


def _trocear(texto: str) -> list[tuple[str, int]]:
    """Divide en tokens y devuelve cada uno con su posición (carácter, base 1)."""
    limpio = _RE_AGRUPADOR.sub("", texto.translate(_MENOS))
    # «, » (coma + espacio) separa sin ambigüedad: una coma decimal nunca lleva espacio.
    limpio = re.sub(r",(?=\s)", " ", limpio)
    return [(m.group(0), m.start() + 1) for m in re.finditer(r"[^\s;]+", limpio)]


def _error_token(token: str, indice: int, columna: int, campo: str | None) -> Exception:
    """Clasifica un token ilegible y propone la corrección."""
    donde = f"valor {indice} («{token[:24]}»)"
    comas, puntos = token.count(","), token.count(".")
    if comas >= 1 and puntos >= 1:
        partes = [p for p in token.split(",") if p]
        return EntradaAmbiguaError(
            f"El {donde} mezcla puntos y comas y admite dos lecturas.",
            campo=campo, posicion=indice,
            sugerencia=("Si son varios valores, sepáralos con espacios: "
                        f"{' '.join(partes[:4])}{' …' if len(partes) > 4 else ''}. "
                        "Si es un solo número, escríbelo sin separador de miles."),
            detalle={"token": token, "columna": columna},
        )
    if comas >= 2 or puntos >= 2:
        signo = "," if comas >= 2 else "."
        partes = [p for p in token.split(signo) if p]
        return EntradaAmbiguaError(
            f"El {donde} tiene más de un separador decimal.",
            campo=campo, posicion=indice,
            sugerencia=("Si son varios valores, sepáralos con espacios o punto y coma: "
                        f"{' '.join(partes[:6])}{' …' if len(partes) > 6 else ''}."),
            detalle={"token": token, "columna": columna},
        )
    minus = token.lower()
    if minus in {"nan", "inf", "+inf", "-inf", "infinity", "-infinity", "∞", "-∞"}:
        mensaje, pista = f"El {donde} no es un número finito.", "Elimina ese valor o sustitúyelo por un dato real."
    elif minus.startswith(("0x", "0b", "0o")) or "_" in token:
        mensaje, pista = f"El {donde} no está en notación decimal.", "Escribe el número en base 10, sin prefijos ni guiones bajos."
    elif "/" in token:
        mensaje, pista = f"El {donde} es una fracción y este campo solo admite decimales.", "Escribe su valor decimal, por ejemplo 0,3333."
    elif token.endswith("%"):
        mensaje, pista = f"El {donde} lleva el símbolo %.", "Escribe la proporción sin símbolo: 5 % → 0,05."
    else:
        mensaje, pista = f"El {donde} no es un número.", "Usa solo dígitos, signo y un separador decimal (coma o punto)."
    return EntradaInvalidaError(mensaje, campo=campo, posicion=indice, sugerencia=pista,
                                detalle={"token": token, "columna": columna})


def _a_float(token: str) -> float | None:
    if not _RE_NUMERO.match(token):
        return None
    try:
        valor = float(token.replace(",", "."))
    except ValueError:
        return None
    return valor if valor == valor and valor not in (float("inf"), float("-inf")) else None


def leer_numero(valor: object, campo: str | None = None, *, fraccion: bool = False):
    """Lee un único número (texto o numérico).  Con ``fraccion`` devuelve ``Fraction`` si procede."""
    if isinstance(valor, bool) or valor is None:
        raise EntradaInvalidaError(f"«{campo or 'valor'}» debe ser un número.", campo=campo,
                                   sugerencia="Introduce un valor numérico.")
    if isinstance(valor, Fraction):
        return valor if fraccion else float(valor)
    if isinstance(valor, Real):
        numero = float(valor)
        if numero != numero or numero in (float("inf"), float("-inf")):
            raise EntradaInvalidaError(f"«{campo or 'valor'}» debe ser un número finito.", campo=campo)
        return numero
    if not isinstance(valor, str):
        raise EntradaInvalidaError(f"«{campo or 'valor'}» debe ser un número.", campo=campo)
    tokens = _trocear(valor)
    if len(tokens) != 1:
        if fraccion and (m := _RE_FRACCION.match(valor.strip().translate(_MENOS))):
            tokens = [(m.group(0).replace(" ", ""), 1)]
        else:
            raise EntradaInvalidaError(
                f"«{campo or 'valor'}» debe contener un solo número.", campo=campo,
                sugerencia="Escribe un único valor, por ejemplo 0,05.")
    token, columna = tokens[0]
    if fraccion and (m := _RE_FRACCION.match(token)):
        if int(m.group(2)) == 0:
            raise EntradaInvalidaError(f"«{campo or 'valor'}»: el denominador no puede ser cero.", campo=campo)
        return Fraction(int(m.group(1)), int(m.group(2)))
    numero = _a_float(token)
    if numero is None:
        raise _error_token(token, 1, columna, campo)
    if fraccion and _RE_DECIMAL_EXACTO.match(token):
        # «0,95» es exactamente 95/100: se conserva así para poder dar formas
        # exactas (19/118) en lugar de arrastrar el error binario de 0.95.
        return Fraction(token.replace(",", "."))
    return numero


def leer_serie(valor: object, campo: str | None = "datos", *, minimo: int = 0,
               maximo: int = 100_000, fraccion: bool = False) -> Lectura:
    """Lee una serie de números desde texto o desde una lista JSON."""
    lectura = Lectura()
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        elementos: list[tuple[object, int]] = []
    elif isinstance(valor, str):
        elementos = list(_trocear(valor))
    elif isinstance(valor, (list, tuple)):
        elementos = [(v, i + 1) for i, v in enumerate(valor)]
    else:
        raise EntradaInvalidaError(f"«{campo}» debe ser una lista de números o un texto con números.", campo=campo)

    if len(elementos) > maximo:
        raise EntradaInvalidaError(
            f"«{campo}» tiene {len(elementos):,} valores y el máximo es {maximo:,}.".replace(",", "\u202f"),
            campo=campo, sugerencia="Divide los datos o trabaja con una muestra.")

    for indice, (crudo, columna) in enumerate(elementos, start=1):
        if isinstance(crudo, str) and isinstance(valor, str):
            token = crudo
            if fraccion and (m := _RE_FRACCION.match(token)):
                if int(m.group(2)) == 0:
                    raise EntradaInvalidaError(f"El valor {indice} («{token}») tiene denominador cero.",
                                               campo=campo, posicion=indice)
                lectura.valores.append(Fraction(int(m.group(1)), int(m.group(2))))
                lectura.tokens.append(token)
                continue
            numero = _a_float(token)
            if numero is None:
                raise _error_token(token, indice, columna, campo)
            if _RE_MILES_PUNTO.match(token):
                lectura.avisos.append(
                    f"«{token}» se leyó como {numero:g} (el punto es decimal). "
                    f"Si querías {token.replace('.', '')}, escríbelo sin puntos.")
            if fraccion and _RE_DECIMAL_EXACTO.match(token):
                numero = Fraction(token.replace(",", "."))
            lectura.valores.append(numero)
            lectura.tokens.append(token)
        else:
            try:
                numero = leer_numero(crudo, campo, fraccion=fraccion)
            except EntradaInvalidaError as exc:
                texto = str(crudo)[:24]
                raise type(exc)(f"El valor {indice} («{texto}») de «{campo}» no es un número válido.",
                                campo=campo, posicion=indice, sugerencia=exc.sugerencia) from exc
            except EntradaAmbiguaError as exc:
                exc.posicion = indice
                raise
            lectura.valores.append(numero)
            lectura.tokens.append(str(crudo))

    if isinstance(valor, str) and len(lectura.tokens) == 1 and "," in lectura.tokens[0]:
        partes = lectura.tokens[0].split(",")
        lectura.avisos.append(
            f"«{lectura.tokens[0]}» se leyó como un solo valor (la coma es decimal). "
            f"Si son dos valores, sepáralos con un espacio: {partes[0]} {partes[1]}.")
    if len(lectura.valores) < minimo:
        raise EntradaInvalidaError(
            f"«{campo}» necesita al menos {minimo} valores numéricos (hay {len(lectura.valores)}).",
            campo=campo, sugerencia="Separa los valores con espacios, punto y coma o saltos de línea.")
    return lectura


def leer_matriz(valor: object, campo: str | None = "tabla", *, minimo_filas: int = 1,
                minimo_columnas: int = 1, rectangular: bool = True,
                maximo_celdas: int = 200_000) -> list[list[float]]:
    """Lee una matriz: una fila por línea (texto) o lista de listas (JSON)."""
    if isinstance(valor, str):
        lineas = [linea for linea in valor.replace("\r", "").split("\n") if linea.strip()]
        filas = [leer_serie(linea, campo).valores for linea in lineas]
    elif isinstance(valor, (list, tuple)):
        filas = []
        for fila in valor:
            if isinstance(fila, (list, tuple, str)):
                filas.append(leer_serie(fila, campo).valores)
            else:
                filas.append([leer_numero(fila, campo)])
    else:
        raise EntradaInvalidaError(f"«{campo}» debe ser una tabla numérica.", campo=campo)

    if len(filas) < minimo_filas or any(len(f) < minimo_columnas for f in filas):
        raise EntradaInvalidaError(
            f"«{campo}» necesita al menos {minimo_filas} filas y {minimo_columnas} columnas numéricas.",
            campo=campo, sugerencia="Escribe una fila por línea y separa las columnas con espacios.")
    if rectangular and len({len(f) for f in filas}) > 1:
        anchos = "/".join(str(len(f)) for f in filas[:6])
        raise EntradaInvalidaError(
            f"Todas las filas de «{campo}» deben tener el mismo número de columnas (ahora: {anchos}).",
            campo=campo, sugerencia="Revisa la fila con distinto número de valores.")
    if sum(len(f) for f in filas) > maximo_celdas:
        raise EntradaInvalidaError(f"«{campo}» supera el máximo de {maximo_celdas} celdas.", campo=campo)
    return filas
