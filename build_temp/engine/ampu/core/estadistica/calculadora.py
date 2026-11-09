"""Cálculo aritmético seguro con traza didáctica; no es un CAS simbólico."""

import ast
import math
import operator
from dataclasses import dataclass

from ampu.core.errores import ParametroInvalidoError

_BINARIAS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
             ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod}
_NOMBRES = {ast.Add: ("+", "Suma"), ast.Sub: ("−", "Resta"),
            ast.Mult: ("×", "Producto"), ast.Div: ("÷", "División"),
            ast.Pow: ("^", "Potencia"), ast.Mod: ("mod", "Residuo")}
_FUNCIONES = {"sin": math.sin, "cos": math.cos, "tan": math.tan, "log": math.log10,
              "ln": math.log, "sqrt": math.sqrt, "exp": math.exp, "abs": abs,
              "factorial": math.factorial}
_CONSTANTES = {"pi": math.pi, "e": math.e}


@dataclass(frozen=True)
class Paso:
    """Una operación realmente ejecutada por el evaluador, no álgebra inferida."""

    expresion: str
    sustitucion: str
    resultado: float
    justificacion: str


@dataclass(frozen=True)
class Explicacion:
    """Entrada interpretada, operaciones en orden y resultado verificable."""

    entrada: str
    interpretacion: str
    pasos: tuple[Paso, ...]
    resultado: float
    supuestos: str


def explicar(expresion: str) -> Explicacion:
    """Evalúa un AST acotado y registra cada sustitución numérica real.

    Solo admite aritmética, constantes y funciones declaradas aquí. Trigonometría
    en radianes; ``log`` es base diez y ``ln`` es logaritmo natural. La traza no
    pretende resolver ecuaciones simbólicas ni derivar identidades.
    """
    if not isinstance(expresion, str) or not 0 < len(expresion) <= 200:
        raise ParametroInvalidoError("Introduce una expresión de hasta 200 caracteres.")
    normalizada = expresion.replace("^", "**")
    pasos: list[Paso] = []
    try:
        raiz = ast.parse(normalizada, mode="eval").body

        def fuente(nodo: ast.AST) -> str:
            return ast.get_source_segment(normalizada, nodo) or ast.unparse(nodo)

        def finito(valor: object, nodo: ast.AST) -> float:
            numero = float(valor)
            if not math.isfinite(numero):
                raise ParametroInvalidoError(f"Resultado intermedio no finito cerca de «{fuente(nodo)}».")
            return numero

        def visitar(nodo: ast.AST, profundidad: int = 0) -> int | float:
            """Desciende solo por nodos permitidos; no usa eval/exec."""
            if profundidad > 25:
                raise ParametroInvalidoError("Expresión demasiado profunda.")
            if isinstance(nodo, ast.Constant) and type(nodo.value) in (int, float):
                return nodo.value
            if isinstance(nodo, ast.Name) and nodo.id in _CONSTANTES:
                return _CONSTANTES[nodo.id]
            if isinstance(nodo, ast.UnaryOp) and isinstance(nodo.op, (ast.UAdd, ast.USub)):
                valor = visitar(nodo.operand, profundidad + 1)
                resultado = valor if isinstance(nodo.op, ast.UAdd) else -valor
                pasos.append(Paso(fuente(nodo), f"{'+' if isinstance(nodo.op, ast.UAdd) else '−'}({valor:.12g})",
                                  finito(resultado, nodo), "Signo del operando"))
                return resultado
            if isinstance(nodo, ast.BinOp) and type(nodo.op) in _BINARIAS:
                izq, der = visitar(nodo.left, profundidad + 1), visitar(nodo.right, profundidad + 1)
                if isinstance(nodo.op, ast.Pow) and abs(der) > 100:
                    raise ParametroInvalidoError("El exponente máximo es 100.")
                resultado = _BINARIAS[type(nodo.op)](izq, der)
                signo, motivo = _NOMBRES[type(nodo.op)]
                pasos.append(Paso(fuente(nodo), f"{izq:.12g} {signo} {der:.12g}",
                                  finito(resultado, nodo), motivo))
                return resultado
            if (isinstance(nodo, ast.Call) and isinstance(nodo.func, ast.Name)
                    and nodo.func.id in _FUNCIONES and len(nodo.args) == 1 and not nodo.keywords):
                argumento = visitar(nodo.args[0], profundidad + 1)
                nombre = nodo.func.id
                # El cálculo es síncrono en el asistente: factoriales gigantes
                # bloquearían la interfaz y no cabrían en un resultado float.
                if nombre == "factorial" and (not isinstance(argumento, int)
                                               or not 0 <= argumento <= 170):
                    raise ParametroInvalidoError("factorial exige un entero entre 0 y 170.")
                resultado = _FUNCIONES[nombre](argumento)
                motivo = {"log": "Logaritmo decimal (argumento > 0)",
                          "ln": "Logaritmo natural (argumento > 0)",
                          "sqrt": "Raíz principal (argumento ≥ 0)",
                          "sin": "Seno en radianes", "cos": "Coseno en radianes",
                          "tan": "Tangente en radianes", "factorial": "Factorial de entero no negativo"}.get(
                              nombre, "Evaluación de función permitida")
                pasos.append(Paso(fuente(nodo), f"{nombre}({argumento:.12g})",
                                  finito(resultado, nodo), motivo))
                return resultado
            posicion = getattr(nodo, "col_offset", 0) + 1
            raise ParametroInvalidoError(
                f"Elemento no permitido en la columna {posicion}: {fuente(nodo)}. "
                "Usa números, + − × ÷ ^, paréntesis o las funciones indicadas.")

        resultado = finito(visitar(raiz), raiz)
        if not pasos:
            pasos.append(Paso(fuente(raiz), fuente(raiz), resultado, "Valor de entrada o constante"))
        return Explicacion(
            entrada=expresion, interpretacion=ast.unparse(raiz), pasos=tuple(pasos), resultado=resultado,
            supuestos="Funciones trigonométricas en radianes; log base 10; ln base e. "
                      "Solo aritmética numérica finita, sin resolución simbólica."
        )
    except ParametroInvalidoError:
        raise
    except SyntaxError as exc:
        columna = exc.offset or (len(normalizada.rstrip()) + 1)
        raise ParametroInvalidoError(
            f"Sintaxis no válida en la columna {columna}: revisa paréntesis y operadores."
        ) from exc
    except (ValueError, ZeroDivisionError, OverflowError, TypeError) as exc:
        raise ParametroInvalidoError(f"Expresión no válida: {exc}") from exc


def calcular(expresion: str) -> float:
    """Conserva la API numérica de la calculadora, compartiendo el mismo motor."""
    return explicar(expresion).resultado
