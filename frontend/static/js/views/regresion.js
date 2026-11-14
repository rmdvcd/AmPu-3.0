import { VISTAS } from "../data.js";
import {
  el,
  panel,
  boton,
  campo,
  kpi,
  tabla,
  alerta,
  estadoVacio,
  toast,
  copiar,
  conCarga,
  fmtNum,
  fmtP,
  fmtPorcentaje,
  fmtIntervalo,
  errorEnCampo,
  textoError,
  avisosMotor,
  latex,
  renderMath,
  pliegue,
  anunciar,
  botonesExportar,
  comportamientoScroll,
} from "../ui.js";
import { icono } from "../icons.js";
import { dibujar } from "../chart.js";
import { api, esCancelacion } from "../api.js";
import { leerSerie, leerMatriz } from "../entrada.js";
import { cargarMeta, navegar, registrarHistorial } from "../store.js";

const EJEMPLO_SIMPLE = {
  y: "6,4 8,7 10,9 13,2 15,4 17,8 20,1 22,2 24,6 26,8 29,2 31,1",
  x: "1 2 3 4 5 6 7 8 9 10 11 12",
};

const EJEMPLO_MULTIPLE = {
  y: "12,4 15,1 18,2 21,9 24,8 28,3 31,1 34,6 37,2 40,4",
  x: "1 2,1\n2 2,4\n3 1,9\n4 2,8\n5 2,5\n6 3,2\n7 2,9\n8 3,4\n9 3,1\n10 3,6",
  predecir: "8,5 3,3\n11 3,8",
};

function normalizar(texto) {
  return String(texto || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Lee los predictores con el mismo lector que el motor (coma o punto decimal;
 * espacios, punto y coma o salto de línea como separadores).
 * Lanza un Error con mensaje para el campo si la forma no encaja con n.
 */
function parsearX(texto, n) {
  const lectura = leerMatriz(texto);
  if (lectura.error) throw new Error(lectura.error.mensaje);
  const lineas = lectura.filas;
  if (!lineas.length) throw new Error("Faltan los predictores X.");
  if (lineas.length === 1) {
    const fila = lineas[0];
    if (fila.length !== n) {
      throw new Error(`Si X está en una sola línea debe tener ${n} valores, uno por observación de Y (ahora tiene ${fila.length}).`);
    }
    return { matriz: fila.map((v) => [v]), p: 1, transpuesta: false, avisos: lectura.avisos };
  }
  const anchos = new Set(lineas.map((f) => f.length));
  if (lineas.length === n && anchos.size === 1) {
    return { matriz: lineas, p: lineas[0].length, transpuesta: false, avisos: lectura.avisos };
  }
  if (anchos.size === 1 && lineas[0].length === n) {
    const matriz = Array.from({ length: n }, (_, i) => lineas.map((fila) => fila[i]));
    return { matriz, p: lineas.length, transpuesta: true, avisos: lectura.avisos };
  }
  throw new Error(
    `X debe tener ${n} filas (una por observación) con el mismo número de columnas. Ahora tiene ${lineas.length} filas de anchura ${[...anchos].join("/")}.`
  );
}

function parsearPrediccion(texto, p) {
  const lectura = leerMatriz(texto);
  if (lectura.error) throw new Error(lectura.error.mensaje);
  const lineas = lectura.filas;
  if (!lineas.length) return null;
  const falta = `Cada fila de predicción necesita ${p} valor${p === 1 ? "" : "es"}, uno por predictor.`;
  if (lineas.length === 1) {
    const plana = lineas[0];
    if (plana.length % p !== 0) throw new Error(falta);
    const filas = [];
    for (let i = 0; i < plana.length; i += p) filas.push(plana.slice(i, i + p));
    return filas;
  }
  const mala = lineas.findIndex((f) => f.length !== p);
  if (mala >= 0) throw new Error(`Fila ${mala + 1}: tiene ${lineas[mala].length} valores. ${falta}`);
  return lineas;
}

/** Número para KaTeX: coma decimal sin espacio, potencias de diez explícitas. */
function numLatex(valor, decimales = 4) {
  const v = Number(valor);
  if (!Number.isFinite(v)) return "\\text{—}";
  const abs = Math.abs(v);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e9)) {
    const [mantisa, exponente] = v.toExponential(3).split("e");
    return `${mantisa.replace(".", "{,}")}\\times 10^{${Number(exponente)}}`;
  }
  return fmtNum(v, { decimales })
    .replace("−", "-")
    .replace(/[\u202f\u00a0]/g, "\\,")
    .replace(",", "{,}");
}

function nombreLatex(nombre) {
  return String(nombre)
    .replace(/\\/g, "")
    .replace(/_/g, "\\_")
    .replace(/%/g, "\\%")
    .replace(/&/g, "\\&")
    .replace(/\$/g, "\\$");
}

function ecuacionLatex(datos) {
  const terminos = datos.coeficientes.map((c, i) => {
    const valor = Number(c.estimacion);
    if (i === 0) return numLatex(valor);
    const nombre = `\\mathrm{${nombreLatex(c.nombre || `x_{${i}}`)}}`;
    return `${valor >= 0 ? "+" : "-"} ${numLatex(Math.abs(valor))}\\,${nombre}`;
  });
  return `\\hat{y} = ${terminos.join(" ")}`;
}

function ecuacionTexto(datos) {
  return datos.coeficientes
    .map((c, i) => {
      const valor = Number(c.estimacion);
      if (i === 0) return fmtNum(valor, { decimales: 4 });
      return `${valor >= 0 ? "+" : "−"} ${fmtNum(Math.abs(valor), { decimales: 4 })}·${c.nombre || `x${i}`}`;
    })
    .join(" ");
}

function interpretarR2(r2) {
  const valor = Number(r2);
  const magnitud = valor >= 0.7 ? "alta" : valor >= 0.4 ? "moderada" : valor >= 0.2 ? "baja" : "muy baja";
  return `El modelo explica el ${fmtPorcentaje(valor, 1)} de la variabilidad observada (capacidad explicativa ${magnitud}).`;
}

function veredicto(p, alfa, siOk, siNo) {
  if (p === null || p === undefined) return "no calculable con estos datos";
  return `p = ${fmtP(p)} · ${p < alfa ? siNo : siOk}`;
}

/** Diagnóstico numérico de los supuestos: complementa (no sustituye) al gráfico de residuos. */
function panelDiagnostico(respuesta) {
  const d = respuesta.diagnostico || {};
  const alfa = respuesta.bondad?.alfa ?? 0.05;
  const dw = d.durbin_watson;
  const lecturaDW =
    dw === null || dw === undefined
      ? "no calculable"
      : `${fmtNum(dw, { decimales: 3 })} · ${dw < 1.5 ? "posible autocorrelación positiva" : dw > 2.5 ? "posible autocorrelación negativa" : "sin indicios de autocorrelación (≈ 2)"}`;
  const filas = [
    ["Normalidad de los residuos (Shapiro–Wilk)", veredicto(d.shapiro_p, alfa, "compatible con normalidad", "se aparta de la normalidad")],
    ["Varianza constante (Breusch–Pagan)", veredicto(d.breusch_pagan_p, alfa, "sin indicios de heterocedasticidad", "la dispersión cambia con X")],
    ["Independencia (Durbin–Watson)", lecturaDW],
    ["Observaciones influyentes (Cook > 4/n)", d.influyentes?.length ? `n.º ${d.influyentes.join(", ")}` : "ninguna"],
    ["Residuos atípicos (|estandarizado| > 3)", d.atipicos?.length ? `n.º ${d.atipicos.join(", ")}` : "ninguno"],
  ];
  if (Array.isArray(d.vif)) {
    const maximo = Math.max(...d.vif);
    filas.push([
      "Colinealidad (VIF)",
      `${d.vif.map((v) => fmtNum(v, { decimales: 2 })).join(" · ")} — ${maximo >= 10 ? "colinealidad grave" : maximo >= 5 ? "colinealidad apreciable" : "aceptable (< 5)"}`,
    ]);
  }
  if (d.condicion !== null && d.condicion !== undefined) {
    filas.push(["Número de condición", `${fmtNum(d.condicion, { decimales: 1 })}${d.condicion > 30 ? " — diseño mal condicionado" : ""}`]);
  }
  const residuos = respuesta.residuos || [];
  const detalle = tabla({
    columnas: ["N.º", "Observado", "Ajustado", "Residuo", "Res. estandarizado", "Apalancamiento", "Distancia de Cook"],
    filas: residuos.map((r, i) => [i + 1, r.observado, r.ajustado, r.residuo, r.estandarizado, r.apalancamiento, r.cook]),
    total: residuos.length,
    formatos: Object.fromEntries(
      ["Observado", "Ajustado", "Residuo", "Res. estandarizado", "Apalancamiento", "Distancia de Cook"].map((c) => [c, (v) => fmtNum(v, { decimales: 4 })])
    ),
    altura: 280,
  });
  return panel({
    titulo: "Comprobación de supuestos",
    subtitulo: `Contrastes al nivel α = ${fmtNum(alfa)}. Con muestras pequeñas tienen poca potencia: mira también el gráfico de residuos.`,
    icono: "escudo",
    contenido: el(
      "div",
      { class: "pila pila--sm" },
      el("dl", { class: "lista-definicion" }, filas.map(([k, v]) => el("div", {}, el("dt", {}, k), el("dd", {}, v)))),
      pliegue({ titulo: "Residuos, apalancamiento y distancia de Cook por observación", contenido: detalle })
    ),
  });
}

export async function montar(host) {
  try {
    await cargarMeta();
  } catch (error) {
    host.append(alerta({ tipo: "error", titulo: "El motor no responde", texto: textoError(error) }));
    return null;
  }

  let resultado = null;
  let predicciones = null;
  let controlador = null;
  let pActual = 1;

  const campoY = campo({
    etiqueta: "Variable dependiente Y",
    codigo: "y",
    tipo: "serie",
    requerido: true,
    valor: EJEMPLO_SIMPLE.y,
    filas: 6,
    nombre: "y",
    ayuda: "Una observación por valor, separadas por espacios o saltos de línea. Decimales con coma o punto (12,5 o 12.5).",
  });
  const campoX = campo({
    etiqueta: "Predictores X",
    codigo: "x",
    tipo: "matriz",
    requerido: true,
    valor: EJEMPLO_SIMPLE.x,
    filas: 6,
    nombre: "x",
    ayuda: "Una fila por observación, columnas separadas por espacios. Una sola línea con n valores = un predictor; varias columnas = regresión múltiple.",
  });
  const campoNombres = campo({
    etiqueta: "Nombres de predictores",
    codigo: "nombres",
    tipo: "texto",
    valor: "",
    opcional: true,
    placeholder: "edad, ingresos",
    nombre: "nombres",
    ayuda: "Solo para regresión múltiple. Separa los nombres con comas.",
  });
  const campoConfianza = campo({
    etiqueta: "Nivel de confianza",
    codigo: "confianza",
    tipo: "select",
    valor: "0.95",
    opciones: [["0.90", "90 %"], ["0.95", "95 %"], ["0.99", "99 %"]],
  });
  const campoPredecir = campo({
    etiqueta: "Predecir nuevos valores",
    codigo: "predecir",
    tipo: "matriz",
    valor: "",
    opcional: true,
    filas: 3,
    nombre: "predecir",
    ayuda: "Opcional. Una fila por predicción con el mismo número de predictores que X. Se devuelven el intervalo para la media y el de predicción.",
  });
  const diagnostico = el("span", { class: "chip chip--marca" }, "n = 12 · 1 predictor");
  const resultadoHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Ajustar modelo", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
  const estado = el("span", { class: "calculando" });

  function actualizarDiagnostico() {
    const y = leerSerie(campoY.texto());
    let p = null;
    const n = y.error ? 0 : y.valores.length;
    try {
      const x = parsearX(campoX.texto(), n || 1);
      p = x.p;
    } catch {
      p = null;
    }
    diagnostico.replaceChildren(
      y.error ? "Y por revisar" : `n = ${n}${n === 1 ? " observación" : " observaciones"}`,
      el("span", { class: "chip__separador" }, "·"),
      p ? `${p} predictor${p === 1 ? "" : "es"}` : "predictores por revisar"
    );
    diagnostico.dataset.valido = String(Boolean(p) && n >= 3);
    campoNombres.envoltura.classList.toggle("oculto", p === null || p < 2);
    return p;
  }

  campoY.control.addEventListener("input", actualizarDiagnostico);
  campoX.control.addEventListener("input", actualizarDiagnostico);

  function cargarEjemplo(tipo) {
    if (tipo === "simple") {
      campoY.setValor(EJEMPLO_SIMPLE.y);
      campoX.setValor(EJEMPLO_SIMPLE.x);
      campoNombres.setValor("");
      campoPredecir.setValor("");
    } else {
      campoY.setValor(EJEMPLO_MULTIPLE.y);
      campoX.setValor(EJEMPLO_MULTIPLE.x);
      campoNombres.setValor("x1, x2");
      campoPredecir.setValor(EJEMPLO_MULTIPLE.predecir);
    }
    actualizarDiagnostico();
    resultado = null;
    resultadoHost.replaceChildren(estadoInicial());
    toast("Ejemplo cargado", { tipo: "ok" });
  }

  function estadoInicial() {
    return panel({
      titulo: "Sin modelo todavía",
      icono: "info",
      contenido: estadoVacio({
        icono: "regresion",
        titulo: "Ajusta un modelo lineal",
        texto: "Una columna de X ajusta un modelo simple; varias columnas, uno múltiple.",
      }),
    });
  }

  const formulario = panel({
    titulo: "Datos y configuración",
    subtitulo: "Una fila por observación; conserva el mismo orden en X e Y.",
    icono: "regresion",
    acciones: [diagnostico],
    contenido: el(
      "div",
      { class: "pila" },
      el("div", { class: "rejilla rejilla--2" }, campoY.envoltura, el("div", { class: "pila" }, campoX.envoltura, campoNombres.envoltura)),
      el("div", { class: "rejilla rejilla--2", style: { alignItems: "end" } }, campoConfianza.envoltura, campoPredecir.envoltura),
      el(
        "div",
        { class: "fila fila--entre" },
        el(
          "div",
          { class: "fila" },
          botonCalcular,
          boton("Ejemplo simple", { variante: "secundario", icono: "ejemplo", onClick: () => cargarEjemplo("simple") }),
          boton("Ejemplo múltiple", { variante: "fantasma", icono: "ejemplo", onClick: () => cargarEjemplo("multiple") })
        ),
        estado
      ),
      pliegue({
        titulo: "Cómo interpretar R², coeficientes y residuos",
        contenido: el(
          "div",
          { class: "pila pila--sm" },
          el("p", { class: "texto-articulo" }, "Cada coeficiente estima el cambio medio de Y al aumentar una unidad su predictor, manteniendo el resto constante. El p-valor contrasta si ese coeficiente es distinto de cero."),
          el("p", { class: "texto-articulo" }, "R² mide la proporción de variabilidad explicada; siempre aumenta al añadir predictores, por eso también se muestra el R² ajustado. Un modelo con R² alto puede tener residuos con estructura: revisa siempre el gráfico de residuos."),
          el("p", { class: "texto-articulo" }, "La asociación no implica causalidad. No extrapoles fuera del rango observado sin justificarlo.")
        ),
      })
    ),
  });

  /* ------------------------------ cálculo ------------------------------ */

  function validar() {
    let ok = true;
    campoY.limpiarError();
    campoX.limpiarError();
    campoPredecir.limpiarError();
    campoNombres.limpiarError();
    const y = leerSerie(campoY.texto());
    let falloY = true;
    if (y.error) {
      campoY.setError(y.error.mensaje);
      ok = false;
    } else if (y.valores.length < 3) {
      campoY.setError(`Introduce al menos 3 observaciones en Y (se han leído ${y.valores.length}).`);
      ok = false;
    } else {
      falloY = false;
    }
    let x = null;
    if (ok) {
      try {
        x = parsearX(campoX.texto(), y.valores.length);
      } catch (error) {
        campoX.setError(error.message);
        ok = false;
      }
    }
    if (!ok) {
      (falloY ? campoY : campoX).enfocar();
      return null;
    }
    if (x.transpuesta) {
      toast("Detectamos X transpuesta: cada columna era un predictor. La hemos girado automáticamente.", { tipo: "aviso", duracion: 6500 });
    }
    const nombres = campoNombres.texto();
    if (nombres && x.p > 1) {
      const lista = nombres.split(",").map((n) => n.trim()).filter(Boolean);
      if (lista.length !== x.p) {
        campoNombres.setError(`Indica ${x.p} nombres separados por comas o deja el campo vacío.`);
        campoNombres.enfocar();
        return null;
      }
    }
    let prediccion = null;
    try {
      prediccion = parsearPrediccion(campoPredecir.texto(), x.p);
    } catch (error) {
      campoPredecir.setError(error.message);
      campoPredecir.enfocar();
      return null;
    }
    return { y: y.valores, x, nombres: nombres || null, prediccion };
  }

  async function calcular() {
    const datos = validar();
    if (!datos) {
      toast("Revisa los campos marcados", { tipo: "error" });
      return;
    }
    pActual = datos.x.p;
    if (controlador) controlador.abort();
    controlador = new AbortController();
    botonCalcular.cargando(true);
    estado.replaceChildren(el("span", { class: "pulso" }), "Ajustando…");
    try {
      const respuesta = await api.post(
        "/api/regresion",
        {
          y: datos.y,
          x: datos.x.matriz,
          nombres: datos.nombres,
          confianza: campoConfianza.valor(),
          predecir: datos.prediccion,
        },
        { senal: controlador.signal }
      );
      resultado = respuesta;
      predicciones = respuesta.predicciones;
      renderResultado();
      estado.replaceChildren("Ajustado");
      registrarHistorial({
        titulo: "Regresión lineal",
        detalle: `R² = ${fmtNum(respuesta.bondad.r2, { decimales: 4 })} · ${respuesta.predictores} predictor${respuesta.predictores === 1 ? "" : "es"}`,
        ruta: "regresion",
        tipo: "regresion",
        icono: "regresion",
      });
      anunciar(`Modelo ajustado con R cuadrado ${fmtNum(respuesta.bondad.r2, { decimales: 3 })}.`);
    } catch (error) {
      if (!esCancelacion(error)) {
        const enCampo = errorEnCampo(error, { y: campoY, x: campoX, nombres: campoNombres, confianza: campoConfianza, predecir: campoPredecir });
        resultado = null;
        resultadoHost.replaceChildren(
          panel({
            titulo: "No se pudo ajustar el modelo",
            icono: "alerta",
            contenido: alerta({
              tipo: "error",
              titulo: error.tipo === "timeout" ? "El cálculo tardó demasiado" : enCampo ? "Revisa el campo marcado" : "Revisa los datos",
              texto: textoError(error),
            }),
          })
        );
        anunciar(`Error: ${error.message}`);
      }
    } finally {
      botonCalcular.cargando(false);
      if (!estado.textContent.includes("Ajustado")) estado.replaceChildren("");
    }
  }

  botonCalcular.addEventListener("click", calcular);

  /* ------------------------------ resultado ------------------------------ */

  function configAjuste(respuesta) {
    if (respuesta.predictores === 1 && respuesta.ajuste) {
      return {
        series: [
          { nombre: "Observaciones", x: respuesta.puntos.map((p) => p.x), y: respuesta.puntos.map((p) => p.y), tipo: "dispersion", color: "var(--grafico-1)", opacidad: 0.7 },
          { nombre: "Recta ajustada", x: respuesta.ajuste.x, y: respuesta.ajuste.y, tipo: "linea", color: "var(--grafico-4)", marcadores: false },
        ],
        marcadores: true,
        xlabel: "X",
        ylabel: "Y",
        altura: 290,
        ariaLabel: "Diagrama de dispersión con la recta de regresión ajustada",
      };
    }
    const xs = respuesta.residuos.map((r) => r.ajustado);
    const ys = respuesta.residuos.map((r) => r.observado);
    const min = Math.min(...xs, ...ys);
    const max = Math.max(...xs, ...ys);
    return {
      series: [
        { nombre: "Observado vs ajustado", x: xs, y: ys, tipo: "dispersion", color: "var(--grafico-2)" },
        { nombre: "Referencia y = x", x: [min, max], y: [min, max], tipo: "linea", color: "var(--grafico-4)" },
      ],
      xlabel: "Valor ajustado",
      ylabel: "Valor observado",
      altura: 290,
      ariaLabel: "Valores observados frente a valores ajustados",
    };
  }

  function configResiduos(respuesta) {
    const xs = respuesta.residuos.map((r) => r.ajustado);
    const ys = respuesta.residuos.map((r) => r.residuo);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    return {
      series: [
        { nombre: "Residuos", x: xs, y: ys, tipo: "dispersion", color: "var(--grafico-3)" },
        { nombre: "Residuo cero", x: [minX, maxX], y: [0, 0], tipo: "linea", color: "var(--texto-3)" },
      ],
      xlabel: "Valor ajustado",
      ylabel: "Residuo",
      altura: 290,
      yCero: true,
      ariaLabel: "Gráfico de residuos frente a valores ajustados",
    };
  }

  function renderResultado() {
    const bondad = resultado.bondad;
    const kpis = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: "R²", valor: fmtNum(bondad.r2, { decimales: 4 }), detalle: fmtPorcentaje(bondad.r2, 1) + " explicado", tono: "marca" }),
      kpi({ etiqueta: "R² ajustado", valor: fmtNum(bondad.r2_ajustado, { decimales: 4 }), detalle: "penaliza predictores" }),
      kpi({ etiqueta: "RMSE", valor: fmtNum(bondad.rmse, { decimales: 4 }), detalle: "error típico de residuo" }),
      kpi({
        etiqueta: `F(${bondad.gl_modelo}; ${bondad.gl_residual})`,
        valor: fmtNum(bondad.f, { decimales: 3 }),
        detalle: `p = ${fmtP(bondad.p_f)} · contraste global`,
        titulo: "Contrasta si todos los coeficientes de los predictores son cero a la vez.",
      }),
      kpi({ etiqueta: "n", valor: fmtNum(resultado.n, { entero: true }), detalle: `${resultado.gl} grados de libertad residuales` }),
      kpi({ etiqueta: "Confianza", valor: fmtPorcentaje(bondad.confianza, 0), detalle: "nivel de los intervalos" })
    );

    const formulaNodo = el("div", { class: "formula-card" }, el("span", { class: "formula-etiqueta" }, "Ecuación ajustada"));
    const destinoFormula = el("div");
    formulaNodo.append(destinoFormula);
    latex(destinoFormula, ecuacionLatex(resultado), { display: true });

    const filasCoef = resultado.coeficientes.map((c) => [
      c.nombre,
      c.estimacion,
      c.error,
      fmtIntervalo([c.ic_inferior, c.ic_superior], { decimales: 4 }),
      c.p_valor,
      c.significativo ? "✓ sí" : "no",
    ]);
    const tablaCoef = tabla({
      columnas: ["Término", "Estimación", "Error típ.", `IC ${fmtPorcentaje(bondad.confianza, 0)}`, "p-valor", `p < ${fmtNum(bondad.alfa ?? 0.05)}`],
      filas: filasCoef,
      total: filasCoef.length,
      formatos: {
        Estimación: (v) => fmtNum(v, { decimales: 5 }),
        "Error típ.": (v) => fmtNum(v, { decimales: 5 }),
        "p-valor": (v) => fmtP(v),
      },
      nota: `Contraste bilateral de cada coeficiente frente a cero con t de Student (${resultado.gl} g. l.). La asociación no implica causalidad.`,
    });

    const hostAjuste = el("div");
    const hostResiduos = el("div");
    setTimeout(() => {
      dibujar(hostAjuste, configAjuste(resultado));
      dibujar(hostResiduos, configResiduos(resultado));
    }, 0);

    const panelEcuacion = panel({
      titulo: "Modelo ajustado",
      subtitulo: resultado.conclusion,
      icono: "regresion",
      acciones: [
        boton("Copiar ecuación", {
          variante: "fantasma",
          pequeno: true,
          icono: "copiar",
          onClick: () => copiar(`ŷ = ${ecuacionTexto(resultado)}`),
        }),
        ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) => exportar(formato, nodo)),
      ],
      contenido: el(
        "div",
        { class: "pila" },
        kpis,
        formulaNodo,
        alerta({ tipo: "info", texto: interpretarR2(bondad.r2) }),
        avisosMotor(resultado.avisos)
      ),
    });

    const paneles = [
      panelEcuacion,
      panel({ titulo: "Coeficientes", icono: "tabla", contenido: tablaCoef }),
      el(
        "div",
        { class: "rejilla rejilla--2" },
        panel({
          titulo: resultado.predictores === 1 ? "Dispersión y recta" : "Observado frente a ajustado",
          icono: "grafico",
          contenido: hostAjuste,
        }),
        panel({
          titulo: "Diagnóstico de residuos",
          subtitulo: "Busca dispersión sin forma: patrones curvos o embudos sugieren un modelo inadecuado.",
          icono: "grafico",
          contenido: hostResiduos,
        })
      ),
    ];

    paneles.push(panelDiagnostico(resultado));

    if (predicciones?.length) {
      const nivel = fmtPorcentaje(bondad.confianza, 0);
      const hayExtrapolacion = predicciones.some((p) => p.extrapola);
      paneles.push(
        panel({
          titulo: "Predicciones",
          subtitulo: `Intervalos al ${nivel}`,
          icono: "objetivo",
          contenido: el(
            "div",
            { class: "pila pila--sm" },
            tabla({
              columnas: ["Fila", "Predicción", `IC ${nivel} de la media`, `Intervalo de predicción ${nivel}`, "Rango de datos"],
              filas: predicciones.map((p) => [
                p.fila,
                fmtNum(p.prediccion, { decimales: 5 }),
                fmtIntervalo(p.ic_media, { decimales: 4 }),
                fmtIntervalo(p.ic_prediccion, { decimales: 4 }),
                p.extrapola ? "⚠ fuera (extrapola)" : "dentro",
              ]),
              total: predicciones.length,
              nota: "El IC de la media acota el valor medio de Y para esos predictores; el intervalo de predicción acota una observación nueva y por eso es más ancho.",
            }),
            hayExtrapolacion
              ? alerta({ tipo: "aviso", titulo: "Hay extrapolación", texto: "Alguna fila queda fuera del rango de X observado. El modelo no está respaldado por datos en esa zona y los intervalos no reflejan ese riesgo." })
              : null
          ),
        })
      );
    }

    paneles.push(
      panel({
        titulo: "Lectura crítica",
        icono: "escudo",
        contenido: el(
          "div",
          { class: "pila pila--sm" },
          el("p", { class: "texto-articulo" }, resultado.nota),
          el("p", { class: "texto-articulo" }, "Comprueba linealidad, independencia, homocedasticidad y normalidad aproximada de los residuos. Un R² alto no corrige un diseño sesgado ni un modelo mal especificado.")
        ),
      })
    );

    resultadoHost.replaceChildren(el("div", { class: "pila" }, paneles));
    renderMath(resultadoHost);
    resultadoHost.scrollIntoView({ behavior: comportamientoScroll(), block: "nearest" });
  }

  async function exportar(formato, botonNodo) {
    const cfg = configAjuste(resultado);
    const tablas = [
      {
        nombre: "Coeficientes",
        columnas: ["Término", "Estimación", "Error típico", "IC inferior", "IC superior", "p-valor"],
        filas: resultado.coeficientes.map((c) => [c.nombre, c.estimacion, c.error, c.ic_inferior, c.ic_superior, c.p_valor]),
      },
      {
        nombre: "Bondad",
        columnas: ["Métrica", "Valor"],
        filas: [
          ["R²", resultado.bondad.r2],
          ["R² ajustado", resultado.bondad.r2_ajustado],
          ["RMSE", resultado.bondad.rmse],
          ["n", resultado.n],
          ["Grados de libertad", resultado.gl],
          ["Nivel de confianza", resultado.bondad.confianza],
          ["F global", resultado.bondad.f],
          ["p-valor de F", resultado.bondad.p_f],
          ["Shapiro–Wilk (p)", resultado.diagnostico?.shapiro_p ?? ""],
          ["Breusch–Pagan (p)", resultado.diagnostico?.breusch_pagan_p ?? ""],
          ["Durbin–Watson", resultado.diagnostico?.durbin_watson ?? ""],
        ],
      },
    ];
    if (predicciones?.length) {
      tablas.push({
        nombre: "Predicciones",
        columnas: ["Fila", "Predicción", "IC media inf.", "IC media sup.", "Predicción inf.", "Predicción sup.", "Extrapola"],
        filas: predicciones.map((p) => [p.fila, p.prediccion, p.ic_media?.[0], p.ic_media?.[1], p.ic_prediccion?.[0], p.ic_prediccion?.[1], p.extrapola ? "sí" : "no"]),
      });
    }
    await conCarga(botonNodo, async () => {
      try {
        await api.exportar({
          formato,
          titulo: "Regresión lineal · AmPu 3.2",
          resumen: `${resultado.conclusion}\nEcuación: ŷ = ${ecuacionTexto(resultado)}\n${interpretarR2(resultado.bondad.r2)}`,
          tablas,
          figura: {
            series: cfg.series.map((s) => ({ nombre: s.nombre, x: s.x, y: s.y, tipo: s.tipo === "dispersion" ? "dispersion" : "linea" })),
            xlabel: cfg.xlabel,
            ylabel: cfg.ylabel,
            titulo: "Ajuste del modelo",
          },
          vista: "regresion",
          estado: {
            y: campoY.texto(),
            x: campoX.texto(),
            nombres: campoNombres.texto(),
            confianza: campoConfianza.valor(),
          },
        });
        toast(`Archivo ${formato.toUpperCase()} generado`, { tipo: "ok" });
      } catch (error) {
        if (!esCancelacion(error)) toast(textoError(error), { tipo: "error" });
      }
    });
  }

  host.append(
    el(
      "div",
      { class: "vista" },
      el(
        "header",
        { class: "vista__cabecera" },
        el(
          "div",
          {},
          el("span", { class: "ceja" }, "Inferir · Regresión"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("regresion", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Regresión lineal")
          ),
          el(
            "p",
            { class: "vista__subtitulo" },
            VISTAS.regresion.subtitulo
          )
        ),
        el(
          "div",
          { class: "vista__acciones" },
          boton("Guía de regresión", { variante: "secundario", icono: "teoria", onClick: () => navegar("teoria/regresion") })
        )
      ),
      el("div", { class: "pila" }, formulario, resultadoHost)
    )
  );

  actualizarDiagnostico();
  resultadoHost.append(estadoInicial());

  return () => {
    if (controlador) controlador.abort();
  };
}
