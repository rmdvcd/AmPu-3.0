import { VISTAS } from "../data.js";
import {
  el,
  panel,
  boton,
  campo,
  kpi,
  tabla,
  alerta,
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
  pestanas,
  latex,
  anunciar,
  botonesExportar,
} from "../ui.js";
import { icono } from "../icons.js";
import { dibujar } from "../chart.js";
import { api, esCancelacion } from "../api.js";
import { leerSerie, leerMatriz, fmtEntrada } from "../entrada.js";
import { cargarMeta, registrarHistorial, transito } from "../store.js";
import { abrirVentana, ventanasAbiertas, barraResultados } from "../ventanas.js";
import { abrirTeoriaVentana } from "../teoria_dialogo.js";

const EJEMPLO_SIMPLE = {
  y: "6,4 8,7 10,9 13,2 15,4 17,8 20,1 22,2 24,6 26,8 29,2 31,1",
  x: "1 2 3 4 5 6 7 8 9 10 11 12",
};

const EJEMPLO_MULTIPLE = {
  y: "12,4 15,1 18,2 21,9 24,8 28,3 31,1 34,6 37,2 40,4",
  x: "1 2,1\n2 2,4\n3 1,9\n4 2,8\n5 2,5\n6 3,2\n7 2,9\n8 3,4\n9 3,1\n10 3,6",
  predecir: "8,5 3,3\n11 3,8",
};

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
  let tabGraficoActiva = "ajuste";
  let tabTablaActiva = "coeficientes";

  const yInicial = transito.regresion?.y
    ? transito.regresion.y.map((v) => fmtEntrada(v)).join(" ")
    : EJEMPLO_SIMPLE.y;
  const xInicial = transito.regresion?.x
    ? transito.regresion.x.map((v) => fmtEntrada(v)).join(" ")
    : EJEMPLO_SIMPLE.x;
  transito.regresion = null;

  const campoY = campo({
    etiqueta: "Variable dependiente Y",
    codigo: "y",
    tipo: "serie",
    requerido: true,
    valor: yInicial,
    filas: 5,
    nombre: "y",
    ayuda: "Valores separados por espacios o saltos de línea. Decimales con coma o punto.",
  });
  const campoX = campo({
    etiqueta: "Predictores X",
    codigo: "x",
    tipo: "matriz",
    requerido: true,
    valor: xInicial,
    filas: 5,
    nombre: "x",
    ayuda: "Una fila por observación (una sola línea = 1 predictor; varias columnas = regresión múltiple).",
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
    ayuda: "Opcional. Una fila por predicción con el mismo número de predictores que X.",
  });

  const diagnostico = el("span", { class: "chip chip--marca" }, "n = 12 · 1 predictor");
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
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
    toast("Ejemplo cargado", { tipo: "ok" });
  }

  const formulario = panel({
    titulo: "Datos y configuración",
    subtitulo: "Una columna de X ajusta regresión simple; varias columnas ajustan regresión múltiple.",
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
      )
    ),
  });

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

  async function calcular({ enfocarResultados = true } = {}) {
    const datos = validar();
    if (!datos) {
      toast("Revisa los campos marcados", { tipo: "error" });
      return;
    }
    if (controlador) controlador.abort();
    controlador = new AbortController();
    botonCalcular.cargando(true);
    estado.replaceChildren(el("span", { class: "pulso" }), "Ajustando…");
    errorHost.replaceChildren();
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
      renderBarra();
      abrirResultadosVentana({ enfocar: enfocarResultados });
      if (ventanasAbiertas().some((v) => v.id === "reg-graficos")) abrirGraficosVentana({ enfocar: false });
      if (ventanasAbiertas().some((v) => v.id === "reg-tablas")) abrirTablasVentana({ enfocar: false });
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
        errorHost.replaceChildren(
          alerta({
            tipo: "error",
            titulo: error.tipo === "timeout" ? "El cálculo tardó demasiado" : enCampo ? "Revisa el campo marcado" : "No se pudo ajustar el modelo",
            texto: textoError(error),
          })
        );
        anunciar(`Error: ${error.message}`);
      }
      estado.replaceChildren("");
    } finally {
      botonCalcular.cargando(false);
    }
  }

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
        altura: 320,
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
      altura: 320,
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
      altura: 310,
      yCero: true,
      ariaLabel: "Gráfico de residuos frente a valores ajustados",
    };
  }

  function abrirGraficosVentana({ enfocar = true } = {}) {
    if (!resultado) return;
    const hostAjuste = el("div");
    const hostResiduos = el("div");

    const tabs = pestanas({
      etiqueta: "Gráficos de regresión",
      activa: tabGraficoActiva,
      items: [
        {
          clave: "ajuste",
          titulo: resultado.predictores === 1 ? "Dispersión y recta" : "Observado vs ajustado",
          icono: "regresion",
          contenido: hostAjuste,
        },
        {
          clave: "residuos",
          titulo: "Residuos",
          icono: "dispersion",
          contenido: el("div", { class: "pila pila--sm" }, hostResiduos, el("p", { class: "texto-tenue texto-pequeno" }, "Busca dispersión sin forma: patrones curvos o embudos sugieren un modelo inadecuado.")),
        },
      ],
      onCambio: (clave) => {
        tabGraficoActiva = clave;
        if (clave === "ajuste") dibujar(hostAjuste, configAjuste(resultado));
        else dibujar(hostResiduos, configResiduos(resultado));
      },
    });

    abrirVentana({
      id: "reg-graficos",
      titulo: "Gráficos · Regresión lineal",
      tituloCorto: "Gráficos",
      subtitulo: `R² = ${fmtNum(resultado.bondad.r2, { decimales: 4 })} · n = ${resultado.n}`,
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("PNG", { variante: "fantasma", pequeno: true, icono: "imagen", onClick: (e) => exportar("png", e.currentTarget) }),
      ],
      contenido: tabs,
      pie: el(
        "div",
        { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana() }),
        boton("Tablas y supuestos", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: () => abrirTablasVentana() })
      ),
    });

    if (tabGraficoActiva === "ajuste") dibujar(hostAjuste, configAjuste(resultado));
    else dibujar(hostResiduos, configResiduos(resultado));
  }

  function abrirTablasVentana({ enfocar = true } = {}) {
    if (!resultado) return;
    const bondad = resultado.bondad;
    const d = resultado.diagnostico || {};
    const alfa = bondad?.alfa ?? 0.05;

    const tablaCoef = tabla({
      columnas: ["Término", "Estimación", "Error típ.", `IC ${fmtPorcentaje(bondad.confianza, 0)}`, "p-valor", `p < ${fmtNum(alfa)}`],
      filas: resultado.coeficientes.map((c) => [
        c.nombre,
        c.estimacion,
        c.error,
        fmtIntervalo([c.ic_inferior, c.ic_superior], { decimales: 4 }),
        c.p_valor,
        c.significativo ? "✓ sí" : "no",
      ]),
      total: resultado.coeficientes.length,
      formatos: {
        Estimación: (v) => fmtNum(v, { decimales: 5 }),
        "Error típ.": (v) => fmtNum(v, { decimales: 5 }),
        "p-valor": (v) => fmtP(v),
      },
      nota: `Contraste bilateral de cada coeficiente frente a cero con t de Student (${resultado.gl} g. l.).`,
    });

    const dw = d.durbin_watson;
    const lecturaDW = dw === null || dw === undefined ? "no calculable" : `${fmtNum(dw, { decimales: 3 })} · ${dw < 1.5 ? "posible autocorrelación positiva" : dw > 2.5 ? "posible autocorrelación negativa" : "sin indicios de autocorrelación (≈ 2)"}`;
    const filasSup = [
      ["Normalidad de los residuos (Shapiro–Wilk)", veredicto(d.shapiro_p, alfa, "compatible con normalidad", "se aparta de la normalidad")],
      ["Varianza constante (Breusch–Pagan)", veredicto(d.breusch_pagan_p, alfa, "sin indicios de heterocedasticidad", "la dispersión cambia con X")],
      ["Independencia (Durbin–Watson)", lecturaDW],
      ["Observaciones influyentes (Cook > 4/n)", d.influyentes?.length ? `n.º ${d.influyentes.join(", ")}` : "ninguna"],
      ["Residuos atípicos (|estandarizado| > 3)", d.atipicos?.length ? `n.º ${d.atipicos.join(", ")}` : "ninguno"],
    ];
    if (Array.isArray(d.vif)) {
      const maximo = Math.max(...d.vif);
      filasSup.push(["Colinealidad (VIF)", `${d.vif.map((v) => fmtNum(v, { decimales: 2 })).join(" · ")} — ${maximo >= 10 ? "colinealidad grave" : maximo >= 5 ? "colinealidad apreciable" : "aceptable (< 5)"}`]);
    }
    if (d.condicion !== null && d.condicion !== undefined) {
      filasSup.push(["Número de condición", `${fmtNum(d.condicion, { decimales: 1 })}${d.condicion > 30 ? " — diseño mal condicionado" : ""}`]);
    }
    const panelSupuestos = el(
      "div",
      { class: "pila pila--sm" },
      el("dl", { class: "lista-definicion" }, filasSup.map(([k, v]) => el("div", {}, el("dt", {}, k), el("dd", {}, v)))),
      el("p", { class: "texto-tenue texto-pequeno" }, resultado.nota || "Revisa linealidad, independencia, homocedasticidad y normalidad aproximada de los residuos.")
    );

    const residuos = resultado.residuos || [];
    const tablaResiduos = tabla({
      columnas: ["N.º", "Observado", "Ajustado", "Residuo", "Res. estandarizado", "Apalancamiento", "Cook"],
      filas: residuos.map((r, i) => [i + 1, r.observado, r.ajustado, r.residuo, r.estandarizado, r.apalancamiento, r.cook]),
      total: residuos.length,
      formatos: Object.fromEntries(["Observado", "Ajustado", "Residuo", "Res. estandarizado", "Apalancamiento", "Cook"].map((c) => [c, (v) => fmtNum(v, { decimales: 4 })])),
      altura: 300,
    });

    const items = [
      { clave: "coeficientes", titulo: "Coeficientes", icono: "tabla", contenido: tablaCoef },
      { clave: "supuestos", titulo: "Supuestos", icono: "escudo", contenido: panelSupuestos },
      { clave: "residuos", titulo: "Observaciones y Cook", icono: "lista", contenido: tablaResiduos },
    ];
    if (predicciones?.length) {
      const nivel = fmtPorcentaje(bondad.confianza, 0);
      const hayExtrapolacion = predicciones.some((p) => p.extrapola);
      items.push({
        clave: "predicciones",
        titulo: `Predicciones (${predicciones.length})`,
        icono: "objetivo",
        contenido: el(
          "div",
          { class: "pila pila--sm" },
          tabla({
            columnas: ["Fila", "Predicción", `IC ${nivel} media`, `IC ${nivel} predicción`, "Rango"],
            filas: predicciones.map((p) => [
              p.fila,
              fmtNum(p.prediccion, { decimales: 5 }),
              fmtIntervalo(p.ic_media, { decimales: 4 }),
              fmtIntervalo(p.ic_prediccion, { decimales: 4 }),
              p.extrapola ? "⚠ fuera (extrapola)" : "dentro",
            ]),
            total: predicciones.length,
          }),
          hayExtrapolacion
            ? alerta({ tipo: "aviso", titulo: "Hay extrapolación", texto: "Alguna fila queda fuera del rango de X observado." })
            : null
        ),
      });
    } else if (tabTablaActiva === "predicciones") {
      tabTablaActiva = "coeficientes";
    }

    const tabs = pestanas({
      etiqueta: "Tablas y diagnóstico de regresión",
      activa: tabTablaActiva,
      items,
      onCambio: (c) => { tabTablaActiva = c; },
    });

    abrirVentana({
      id: "reg-tablas",
      titulo: "Tablas y diagnóstico · Regresión",
      tituloCorto: "Tablas",
      subtitulo: `n = ${resultado.n} · ${resultado.gl} g. l. residuales`,
      icono: "tabla",
      tipo: "tabla",
      alcance: "vista",
      enfocar,
      contenido: tabs,
      pie: el(
        "div",
        { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana() }),
        boton("Gráficos", { variante: "fantasma", pequeno: true, icono: "grafico", onClick: () => abrirGraficosVentana() })
      ),
    });
  }

  function abrirResultadosVentana({ enfocar = true } = {}) {
    if (!resultado) return;
    const bondad = resultado.bondad;
    const formulaNodo = el("div", { class: "formula-card" }, el("span", { class: "formula-etiqueta" }, "Ecuación ajustada"));
    const destinoFormula = el("div");
    formulaNodo.append(destinoFormula);
    latex(destinoFormula, ecuacionLatex(resultado), { display: true });

    const kpis = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: "R²", valor: fmtNum(bondad.r2, { decimales: 4 }), detalle: `${fmtPorcentaje(bondad.r2, 1)} explicado`, tono: "marca" }),
      kpi({ etiqueta: "R² ajustado", valor: fmtNum(bondad.r2_ajustado, { decimales: 4 }), detalle: "penaliza predictores" }),
      kpi({ etiqueta: "RMSE", valor: fmtNum(bondad.rmse, { decimales: 4 }), detalle: "error típico de residuo" }),
      kpi({ etiqueta: `F(${bondad.gl_modelo}; ${bondad.gl_residual})`, valor: fmtNum(bondad.f, { decimales: 3 }), detalle: `p = ${fmtP(bondad.p_f)} · contraste global` }),
      kpi({ etiqueta: "n", valor: fmtNum(resultado.n, { entero: true }), detalle: `${resultado.gl} g. l. residuales` }),
      kpi({ etiqueta: "Confianza", valor: fmtPorcentaje(bondad.confianza, 0), detalle: "nivel de intervalos" })
    );

    const cuerpo = el(
      "div",
      { class: "pila" },
      formulaNodo,
      kpis,
      alerta({ tipo: "info", titulo: resultado.conclusion, texto: interpretarR2(bondad.r2) }),
      predicciones?.length
        ? alerta({
            tipo: "ok",
            titulo: `${predicciones.length} ${predicciones.length === 1 ? "predicción calculada" : "predicciones calculadas"}`,
            texto: predicciones.slice(0, 2).map((p) => `Fila ${p.fila}: ŷ = ${fmtNum(p.prediccion, { decimales: 4 })} (IC ${fmtIntervalo(p.ic_prediccion, { decimales: 3 })})`).join(" · "),
          })
        : null,
      avisosMotor(resultado.avisos)
    );

    const pie = el(
      "div",
      { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
      el(
        "div",
        { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
        boton("Ver gráficos", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGraficosVentana() }),
        boton("Tablas y supuestos", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTablasVentana() }),
        boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("regresion", { alcance: "vista" }) })
      ),
      el(
        "div",
        { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
        boton("Copiar ecuación", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(`ŷ = ${ecuacionTexto(resultado)}`) }),
        ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) => exportar(formato, nodo), { variante: "fantasma" })
      )
    );

    abrirVentana({
      id: "reg-resultados",
      titulo: "Modelo ajustado",
      tituloCorto: "Resultados",
      subtitulo: `R² = ${fmtNum(bondad.r2, { decimales: 4 })} · RMSE = ${fmtNum(bondad.rmse, { decimales: 4 })}`,
      icono: "regresion",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
      contenido: cuerpo,
      pie,
    });
  }

  function renderBarra() {
    if (!resultado) { barraHost.replaceChildren(); return; }
    barraHost.replaceChildren(
      barraResultados({
        icono: "regresion",
        resumen: `Modelo ajustado · R² = ${fmtNum(resultado.bondad.r2, { decimales: 4 })} · p(F) = ${fmtP(resultado.bondad.p_f)}`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana() }),
          boton("Gráficos", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGraficosVentana() }),
          boton("Tablas y supuestos", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTablasVentana() }),
        ],
      })
    );
  }

  async function exportar(formato, botonNodo) {
    if (!resultado) return;
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
          estado: { y: campoY.texto(), x: campoX.texto(), nombres: campoNombres.texto(), confianza: campoConfianza.valor() },
        });
        toast(`Archivo ${formato.toUpperCase()} generado`, { tipo: "ok" });
      } catch (error) {
        if (!esCancelacion(error)) toast(textoError(error), { tipo: "error" });
      }
    });
  }

  botonCalcular.addEventListener("click", () => calcular({ enfocarResultados: true }));

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
          el("p", { class: "vista__subtitulo" }, VISTAS.regresion.subtitulo)
        ),
        el(
          "div",
          { class: "vista__acciones" },
          boton("Teoría", {
            variante: "secundario",
            icono: "teoria",
            onClick: () => abrirTeoriaVentana("regresion", { alcance: "vista" }),
          })
        )
      ),
      el("div", { class: "pila" }, formulario, barraHost, errorHost)
    )
  );

  actualizarDiagnostico();

  return () => {
    if (controlador) controlador.abort();
  };
}
