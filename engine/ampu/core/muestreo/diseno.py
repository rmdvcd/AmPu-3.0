"""Orquesta diseños de selección y resultados tabulares para cualquier UI."""

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ampu.core.errores import ParametroInvalidoError
from ampu.core.validacion import validar_semilla, validar_tamano

from .aleatorio import muestra_aleatoria, tamano_proporcion
from .conglomerados import muestra_conglomerados
from .estratificado import asignacion_estratos, muestra_estratificada
from .sistematico import muestra_sistematica


@dataclass
class ResultadoDiseno:
    """Tablas de unidades y asignaciones, más serie resumida para gráfico."""

    tablas: dict[str, pd.DataFrame]
    resumen: str
    etiquetas: list[str]
    poblacion: list[int]
    seleccion: list[int]
    semilla: int | None


def ejecutar_diseno(
    metodo: str, N: int, n: int, seed: int | None = 42,
    estratos: list[tuple[str, int, float, float]] | None = None,
    auto: bool = False, p: float = .5, error: float = .05,
    confianza: float = .95, poblacion: list[str] | None = None,
    n_por_grupo: int | None = None,
) -> ResultadoDiseno:
    """Construye el diseño elegido sin GUI, con tablas exportables completas.

    Args:
        metodo: ``finito``, ``infinito``, ``sistematico``, ``proporcional``,
            ``neyman``, ``optimo`` o ``conglomerados``.
        N: Población para métodos simples (ignorada si hay estratos).
        n: Unidades elegidas o cantidad de conglomerados.
        seed: Semilla compartida para asignación y selección.
        estratos: Tuplas (nombre, tamaño, desviación, coste).
        auto: Si procede, calcula n recomendado a partir del margen.
        p: Proporción supuesta de diseño.
        error: Error absoluto máximo para dimensionar automáticamente.
        confianza: Confianza de diseño.
        poblacion: Identificadores individuales opcionales.
        n_por_grupo: Unidades internas en muestreo de conglomerados en dos etapas.
    """
    validos = ("finito", "infinito", "sistematico", "proporcional", "neyman", "optimo", "conglomerados")
    if metodo not in validos:
        raise ParametroInvalidoError("Método de muestreo desconocido.")
    n = validar_tamano(n)
    seed = validar_semilla(seed)
    if metodo in ("finito", "infinito", "sistematico"):
        if isinstance(N, bool) or not isinstance(N, int) or N < 1 or N > 1_000_000:
            raise ParametroInvalidoError("N debe estar entre 1 y 1 000 000.")
        if poblacion is not None and len(poblacion) != N:
            raise ParametroInvalidoError("La cantidad de identificadores debe coincidir con N.")
        datos = np.arange(1, N+1) if poblacion is None else np.asarray(poblacion, dtype=str)
        if auto:
            n = tamano_proporcion(p, error, confianza, N=N if metodo != "infinito" else None)
        if metodo == "infinito":
            muestra = muestra_aleatoria(datos, n, seed=seed, reemplazo=True)
        elif metodo == "sistematico":
            muestra = muestra_sistematica(datos, n, seed=seed)
        else:
            muestra = muestra_aleatoria(datos, n, seed=seed)
        tabla = pd.DataFrame({"Orden": np.arange(1, n+1), "Selección": muestra, "Semilla": [seed] * n})
        return ResultadoDiseno({"Selección": tabla}, f"{n} unidades de {N} ({metodo}); semilla {seed}. "
                               + ("Tamaño calculado para el margen solicitado." if auto else "Tamaño introducido manualmente."),
                               ["Total"], [N], [n], seed)

    if not estratos:
        raise ParametroInvalidoError("Agrega al menos un grupo en la tabla de estratos.")
    nombres = [fila[0] for fila in estratos]
    if len(nombres) != len(set(nombres)) or any(not k.strip() for k in nombres):
        raise ParametroInvalidoError("Los nombres de los grupos deben ser únicos y no vacíos.")
    tamanos = {k: v for k, v, _, _ in estratos}
    if metodo == "conglomerados":
        grupos = {clave: [f"{clave}-{j}" for j in range(1, cantidad+1)]
                  for clave, cantidad in tamanos.items() if isinstance(cantidad, int) and cantidad > 0}
        if len(grupos) != len(estratos):
            raise ParametroInvalidoError("Cada conglomerado requiere un tamaño positivo.")
        seleccionados = muestra_conglomerados(grupos, n, seed=seed, n_por_grupo=n_por_grupo)
        tabla = pd.DataFrame([(g, unidad) for g, unidades in seleccionados.items() for unidad in unidades],
                             columns=["Conglomerado", "Selección"])
        resumen = f"{n} conglomerados de {len(grupos)}; {len(tabla)} unidades extraídas. Semilla {seed}."
        return ResultadoDiseno({"Selección": tabla}, resumen, list(tamanos), list(tamanos.values()),
                               [len(seleccionados[k]) if k in seleccionados else 0 for k in tamanos], seed)

    if auto:
        n = tamano_proporcion(p, error, confianza, N=sum(tamanos.values()))
    sigma = {k: s for k, _, s, _ in estratos}
    costos = {k: c for k, _, _, c in estratos}
    cuotas = asignacion_estratos(tamanos, n, metodo, desviaciones=sigma, costos=costos)
    grupos = {clave: [f"{clave}-{j}" for j in range(1, cantidad+1)] for clave, cantidad in tamanos.items()}
    seleccionados = muestra_estratificada(grupos, cuotas, seed=seed)
    asignacion = pd.DataFrame([{"Estrato": k, "Nh": tamanos[k], "nh": cuotas[k], "Sh": sigma[k], "Coste": costos[k]}
                               for k in tamanos])
    seleccion = pd.DataFrame([(k, elemento) for k, elementos in seleccionados.items() for elemento in elementos],
                             columns=["Estrato", "Selección"])
    return ResultadoDiseno({"Asignación": asignacion, "Selección": seleccion},
                           f"Asignación {metodo}: {n} unidades de {sum(tamanos.values())}; semilla {seed}.",
                           list(tamanos), list(tamanos.values()), list(cuotas.values()), seed)
