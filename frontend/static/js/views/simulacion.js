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
  anunciar,
  botonesExportar,
} from "../ui.js";
import { icono } from "../icons.js";
import { dibujar } from "../chart.js";
import { api, esCancelacion } from "../api.js";
import { fmtEntrada, leerNumero, leerSerie } from "../entrada.js";
import { cargarMeta, navegar, registrarHistorial, transito } from "../store.js";
import { crearCamposParametros, resumenParametros } from "../params.js";

const HERRAMIENTAS = [
  { clave: "pi", nombre: "Estimar π", descripcion: "Monte Carlo geométrico con convergencia e intervalo.", icono: "pi" },
  { clave: "integral", nombre: "Integrar", descripcion: "Integrales definidas por promedio de valores aleatorios.", icono: "integral" },
  { clave: "muestra", nombre: "Generar muestra", descripcion: "Simula cualquiera de las 26 distribuciones del motor.", icono: "distribuciones" },
  { clave: "ajuste", nombre: "Ajustar distribución", descripcion: "Máxima verosimilitud, AIC y KS exploratorio.", icono: "objetivo" },
  { clave: "qq", nombre: "QQ-plot", descripcion: "Compara cuantiles empíricos y teóricos.", icono: "dispersion" },
];

const FUNCIONES_INTEGRAL = [
  ["cuadrado", "x² en [0, 1]"],
  ["seno", "sen(x) en [0, π]"],
  ["exponencial", "eˣ en [0, 1]"],
  ["circulo", "√(1−x²) en [0, 1]"],
];

const MODELOS_AJUSTE = ["normal", "exponencial", "gamma", "weibull", "lognormal", "beta"];

const EJEMPLO_AJUSTE = "12,1 11,4 12,8 12,3 11,9 12,6 12,2 11,7 12,9 12,4 12,0 11,8 12,5 12,7 11,6 12,3 12,1 12,8";
const EJEMPLO_QQ = "0,21 0,34 0,48 0,55 0,61 0,72 0,69 0,81 0,76 0,88 0,91 0,84";

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const lectura = leerNumero(valor);
  return lectura.error || lectura.vacio ? null : lectura.valor;
}

/** Anchura de clase de un histograma, en unidades del eje. */
function anchoClase(histograma) {
  const { bordes, centros } = histograma || {};
  if (Array.isArray(bordes) && bordes.length > 1) return bordes[1] - bordes[0];
  if (Array.isArray(centros) && centros.length > 1) return centros[1] - centros[0];
  return 1;
}

/** Texto de una serie llegada de otra vista, con la convención de entrada. */
function textoDeSerie(valor) {
  if (Array.isArray(valor)) return valor.map((v) => (typeof v === "number" ? fmtEntrada(v) : String(v))).join(" ");
  return valor ?? "";
}

/**
 * Valida un campo de serie con el mismo lector que el motor.
 * Devuelve la lectura, o null si dejó el error marcado en el campo.
 */
function serieValida(campoDatos, minimo) {
  campoDatos.limpiarError();
  const lectura = leerSerie(campoDatos.texto());
  if (lectura.error) {
    campoDatos.setError(lectura.error.mensaje);
    campoDatos.enfocar();
    return null;
  }
  if (lectura.valores.length < minimo) {
    campoDatos.setError(`Introduce al menos ${minimo} observaciones (se han leído ${lectura.valores.length}).`);
    campoDatos.enfocar();
    return null;
  }
  return lectura;
}

/** Muestra un error del motor: junto al campo culpable si se conoce, y siempre en el panel. */
function mostrarErrorMotor(resultadoHost, error, titulo, campos = {}) {
  const enCampo = errorEnCampo(error, campos);
  resultadoHost.replaceChildren(
    alerta({ tipo: "error", titulo: error.tipo === "timeout" ? "La simulación tardó demasiado" : enCampo ? `${titulo}: revisa el campo marcado` : titulo, texto: textoError(error) })
  );
  anunciar(`Error: ${error.message}`);
}

function panelEspera(titulo, texto) {
  return panel({
    titulo: "Sin resultados",
    icono: "info",
    contenido: estadoVacio({ icono: "simulacion", titulo, texto }),
  });
}

function crearCampoNumerico(id, etiqueta, valor, { min = null, max = null, ayuda = "", opcional = false, codigo = null } = {}) {
  return campo({ etiqueta, codigo: codigo || id, tipo: "numero", valor, min, max, ayuda, opcional, requerido: !opcional });
}


async function exportarSimulacion(botonNodo, { titulo, resumen, tablas, figura, estado }, formato = "pdf") {
  await conCarga(botonNodo, async () => {
    try {
      await api.exportar({
        formato,
        titulo: `${titulo} · AmPu 3.2`,
        resumen,
        tablas,
        figura,
        vista: "simulacion",
        estado,
      });
      toast(`Archivo ${formato.toUpperCase()} generado`, { tipo: "ok" });
    } catch (error) {
      if (!esCancelacion(error)) toast(textoError(error), { tipo: "error" });
    }
  });
}

function panelControles(titulo, subtitulo, camposNodos, acciones, formula = null) {
  return panel({
    titulo,
    subtitulo,
    icono: "simulacion",
    contenido: el(
      "div",
      { class: "pila" },
      el("div", { class: "columnas-formulario" }, camposNodos.map((c) => (c.envoltura ? c.envoltura : c))),
      acciones,
      formula
    ),
  });
}

function configConvergencia(convergencia, referencia, etiqueta) {
  return {
    series: [
      { nombre: "Estimación", x: convergencia.n, y: convergencia.valor, tipo: "linea", color: "var(--grafico-1)" },
      { nombre: etiqueta, x: [convergencia.n[0], convergencia.n[convergencia.n.length - 1]], y: [referencia, referencia], tipo: "linea", color: "var(--grafico-4)" },
    ],
    banda: { x: convergencia.n, superior: convergencia.ic_superior, inferior: convergencia.ic_inferior, color: "var(--grafico-1)" },
    xlabel: "Número de simulaciones",
    ylabel: "Valor estimado",
    altura: 300,
    ariaLabel: "Convergencia de la estimación con su intervalo de confianza",
  };
}

/* ================================================================== */
/* π                                                                  */
/* ================================================================== */

function herramientaPi(pendiente) {
  const campoN = crearCampoNumerico("n", "Simulaciones", pendiente?.n || 10000, { min: 100, max: 200000, ayuda: "El error disminuye aproximadamente como 1/√n." });
  const campoSemilla = crearCampoNumerico("semilla", "Semilla", 42, { min: 0, max: 999999999 });
  const campoConfianza = campo({ etiqueta: "Confianza del intervalo", tipo: "select", valor: "0.95", opciones: [["0.90", "90 %"], ["0.95", "95 %"], ["0.99", "99 %"]] });
  const resultadoHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Simular", { icono: "reproducir", dataset: { accionPrimaria: "true" } });

  async function ejecutar() {
    const n = campoN.valor();
    if (typeof n !== "number" || !Number.isInteger(n) || n < 100 || n > 200000) {
      campoN.setError("Usa un entero entre 100 y 200 000.");
      return;
    }
    botonCalcular.cargando(true);
    try {
      const datos = await api.post("/api/simulacion", { tipo: "pi", n, semilla: campoSemilla.valor(), confianza: Number(campoConfianza.valor()) });
      render(datos);
      registrarHistorial({ titulo: "Monte Carlo · π", detalle: `${fmtNum(datos.estimacion.valor, { decimales: 6 })} ± ${fmtNum(datos.estimacion.error_estandar, { decimales: 6 })}`, ruta: "simulacion/pi", tipo: "simulacion", icono: "pi" });
    } catch (error) {
      if (!esCancelacion(error)) mostrarErrorMotor(resultadoHost, error, "No se pudo simular", { n: campoN, semilla: campoSemilla });
    } finally {
      botonCalcular.cargando(false);
    }
  }

  function render(datos) {
    const graf = el("div");
    setTimeout(() => dibujar(graf, { ...configConvergencia(datos.convergencia, Math.PI, "π exacto"), titulo: "Convergencia de la estimación de π" }), 0);
    resultadoHost.replaceChildren(
      el(
        "div",
        { class: "pila" },
        panel({
          titulo: "Estimación de π",
          subtitulo: datos.nota,
          icono: "pi",
          acciones: [
            boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(`π ≈ ${datos.estimacion.valor}`) }),
            ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) =>
              exportarSimulacion(nodo, {
                titulo: "Monte Carlo · estimación de π",
                resumen: `π ≈ ${datos.estimacion.valor}\nError absoluto: ${datos.error_absoluto}\nIntervalo: [${datos.estimacion.intervalo[0]}, ${datos.estimacion.intervalo[1]}]`,
                tablas: [{ nombre: "Estimación", columnas: ["Métrica", "Valor"], filas: [["Estimación", datos.estimacion.valor], ["π exacto", Math.PI], ["Error absoluto", datos.error_absoluto], ["Error estándar", datos.estimacion.error_estandar], ["Límite inferior", datos.estimacion.intervalo[0]], ["Límite superior", datos.estimacion.intervalo[1]], ["Simulaciones", datos.estimacion.n]] }],
                figura: { series: [{ nombre: "Estimación", x: datos.convergencia.n, y: datos.convergencia.valor, tipo: "linea" }], xlabel: "Simulaciones", ylabel: "π estimado", titulo: "Convergencia" },
                estado: { tipo: "pi", n: datos.estimacion.n, semilla: campoSemilla.valor() },
              }, formato)),
          ],
          contenido: el(
            "div",
            { class: "pila" },
            el("div", { class: "numero-grande" }, fmtNum(datos.estimacion.valor, { decimales: 6 })),
            kpi({
              etiqueta: "Error absoluto",
              valor: fmtNum(datos.error_absoluto, { decimales: 6 }),
              detalle: `π = ${fmtNum(Math.PI, { decimales: 6 })}`,
              tono: datos.error_absoluto < 0.01 ? "ok" : "aviso",
            }),
            el(
              "div",
              { class: "rejilla rejilla--kpi" },
              kpi({ etiqueta: "Intervalo", valor: fmtIntervalo(datos.estimacion.intervalo, { decimales: 5 }), detalle: `${fmtPorcentaje(datos.confianza ?? Number(campoConfianza.valor()), 0)} de confianza`, tono: "marca" }),
              kpi({ etiqueta: "Error estándar", valor: fmtNum(datos.estimacion.error_estandar, { decimales: 6 }), detalle: "precisión de la media" })
            ),
            alerta({ tipo: "info", texto: `Cada punto cae dentro del cuarto de círculo con probabilidad π/4. La fracción observada es ${fmtNum(datos.estimacion.valor / 4, { decimales: 6 })}.` })
          ),
        }),
        panel({ titulo: "Convergencia", subtitulo: `La banda representa el intervalo de confianza al ${fmtPorcentaje(datos.confianza ?? 0.95, 0)}.`, icono: "grafico", contenido: graf })
      )
    );
  }

  botonCalcular.addEventListener("click", ejecutar);
  resultadoHost.append(panelEspera("Estima π sin fórmulas", "Se lanzan puntos aleatorios en un cuadrado y se cuenta la fracción que cae dentro del cuarto de círculo."));
  const nodo = panelControles("Estimar π por Monte Carlo", "La precisión mejora con √n: para dividir el error por 10 necesitas 100 veces más puntos.", [campoN, campoSemilla, campoConfianza], el("div", { class: "fila" }, botonCalcular), el("div", { class: "formula-card" }, el("span", { class: "formula-etiqueta" }, "Estimador"), el("p", { class: "formula-texto" }, "π ≈ 4 · (puntos dentro / puntos totales)")));
  return {
    nodo: el("div", { class: "pila" }, nodo, resultadoHost),
    ejecutar,
  };
}

/* ================================================================== */
/* Integral                                                           */
/* ================================================================== */

function herramientaIntegral(pendiente) {
  const campoFuncion = campo({ etiqueta: "Función", tipo: "select", valor: "cuadrado", opciones: FUNCIONES_INTEGRAL });
  const campoA = campo({ etiqueta: "Límite inferior a", tipo: "numero", valor: "", opcional: true, placeholder: "según función" });
  const campoB = campo({ etiqueta: "Límite superior b", tipo: "numero", valor: "", opcional: true, placeholder: "según función" });
  const campoN = crearCampoNumerico("n", "Simulaciones", pendiente?.n || 10000, { min: 100, max: 200000 });
  const campoSemilla = crearCampoNumerico("semilla", "Semilla", 42, { min: 0, max: 999999999 });
  const resultadoHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Integrar", { icono: "reproducir", dataset: { accionPrimaria: "true" } });

  async function ejecutar() {
    const n = campoN.valor();
    if (typeof n !== "number" || !Number.isInteger(n) || n < 100 || n > 200000) {
      campoN.setError("Usa un entero entre 100 y 200 000.");
      return;
    }
    for (const c of [campoA, campoB, campoN]) c.limpiarError();
    if (!campoA.validar() || !campoB.validar()) return;
    const a = campoA.valor();
    const b = campoB.valor();
    if ((a === null) !== (b === null)) {
      (a === null ? campoA : campoB).setError("Indica los dos límites o deja los dos vacíos.");
      return;
    }
    if (a !== null && b !== null && a >= b) {
      campoB.setError("b debe ser mayor que a.");
      return;
    }
    botonCalcular.cargando(true);
    try {
      const datos = await api.post("/api/simulacion", {
        tipo: "integral",
        funcion: campoFuncion.valor(),
        a: a ?? "",
        b: b ?? "",
        n,
        semilla: campoSemilla.valor(),
        confianza: 0.95,
      });
      render(datos);
      registrarHistorial({ titulo: "Monte Carlo · integral", detalle: `${datos.etiqueta}: ${fmtNum(datos.estimacion.valor, { decimales: 5 })}`, ruta: "simulacion/integral", tipo: "simulacion", icono: "sigma" });
    } catch (error) {
      if (!esCancelacion(error)) mostrarErrorMotor(resultadoHost, error, "No se pudo integrar", { a: campoA, b: campoB, n: campoN, semilla: campoSemilla });
    } finally {
      botonCalcular.cargando(false);
    }
  }

  function render(datos) {
    const graf = el("div");
    setTimeout(() => {
      dibujar(graf, {
        series: [{ nombre: `f(x) = ${datos.etiqueta}`, x: datos.curva.x, y: datos.curva.y, tipo: "linea", relleno: true, color: "var(--grafico-1)" }],
        xlabel: "x",
        ylabel: "f(x)",
        altura: 270,
        ariaLabel: `Función ${datos.etiqueta}`,
      });
    }, 0);
    const grafConv = el("div");
    setTimeout(() => dibujar(grafConv, { ...configConvergencia(datos.convergencia, datos.referencia.valor, "Valor exacto"), titulo: "Convergencia de la integral" }), 0);
    resultadoHost.replaceChildren(
      el(
        "div",
        { class: "pila" },
        panel({
          titulo: `Integral de ${datos.etiqueta}`,
          subtitulo: `Integral en ${fmtIntervalo(datos.intervalo_integracion)} · ${datos.nota}`,
          icono: "sigma",
          acciones: [
            ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) =>
              exportarSimulacion(nodo, {
                titulo: `Integral de ${datos.etiqueta}`,
                resumen: `Estimación: ${datos.estimacion.valor}\nValor exacto: ${datos.referencia.valor}\nError absoluto: ${datos.error_absoluto}`,
                tablas: [{ nombre: "Integral", columnas: ["Métrica", "Valor"], filas: [["Estimación", datos.estimacion.valor], ["Valor exacto", datos.referencia.valor], ["Error absoluto", datos.error_absoluto], ["Error estándar", datos.estimacion.error_estandar], ["Límite inferior", datos.estimacion.intervalo[0]], ["Límite superior", datos.estimacion.intervalo[1]]] }],
                figura: { series: [{ nombre: datos.etiqueta, x: datos.curva.x, y: datos.curva.y, tipo: "linea" }], xlabel: "x", ylabel: "f(x)", titulo: "Función integrada" },
                estado: { tipo: "integral", funcion: campoFuncion.valor(), n: campoN.valor(), semilla: campoSemilla.valor() },
              }, formato)),
          ],
          contenido: el(
            "div",
            { class: "pila" },
            el("div", { class: "numero-grande" }, fmtNum(datos.estimacion.valor, { decimales: 6 })),
            el(
              "div",
              { class: "rejilla rejilla--kpi" },
              kpi({ etiqueta: "Valor exacto", valor: fmtNum(datos.referencia.valor, { decimales: 6 }), detalle: datos.referencia.expresion || "referencia analítica" }),
              kpi({ etiqueta: "Error absoluto", valor: fmtNum(datos.error_absoluto, { decimales: 6 }), detalle: "estimación frente a exacto", tono: "marca" }),
              kpi({ etiqueta: "Error estándar", valor: fmtNum(datos.estimacion.error_estandar, { decimales: 6 }), detalle: "variabilidad del estimador" }),
              kpi({ etiqueta: "Intervalo", valor: fmtIntervalo(datos.estimacion.intervalo, { decimales: 5 }), detalle: `${fmtPorcentaje(datos.confianza ?? 0.95, 0)} de confianza` })
            )
          ),
        }),
        el("div", { class: "rejilla rejilla--2" }, panel({ titulo: "Función integrada", icono: "grafico", contenido: graf }), panel({ titulo: "Convergencia", icono: "grafico", contenido: grafConv }))
      )
    );
  }

  botonCalcular.addEventListener("click", ejecutar);
  resultadoHost.append(panelEspera("Integra por muestreo", "El método promedia f(x) sobre puntos uniformes y multiplica por la longitud del intervalo."));
  return {
    nodo: el("div", { class: "pila" }, panelControles("Integración Monte Carlo", "Elige una de las funciones de referencia. Si dejas a y b vacíos se usan los límites naturales de cada ejemplo; con otros límites, el valor exacto se recalcula para ese intervalo.", [campoFuncion, campoA, campoB, campoN, campoSemilla], el("div", { class: "fila" }, botonCalcular)), resultadoHost),
    ejecutar,
  };
}

/* ================================================================== */
/* Muestra                                                            */
/* ================================================================== */

function herramientaMuestra(pendiente, metaDatos) {
  const distribuciones = metaDatos.distribuciones;
  let modelo = distribuciones.find((d) => d.clave === (pendiente?.clave || "normal")) || distribuciones.find((d) => d.clave === "normal") || distribuciones[0];
  let parametros = crearCamposParametros(modelo, { valores: pendiente?.parametros || {} });
  const campoModelo = campo({
    etiqueta: "Distribución",
    tipo: "select",
    valor: modelo.clave,
    opciones: distribuciones.map((d) => [d.clave, d.nombre]),
  });
  const campoN = crearCampoNumerico("n", "Tamaño de la muestra", pendiente?.n || 1000, { min: 10, max: 200000 });
  const campoSemilla = crearCampoNumerico("semilla", "Semilla", 42, { min: 0, max: 999999999 });
  const contenedorParametros = el("div", {}, parametros.el);
  const resultadoHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Generar muestra", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
  const notaModelo = el("p", { class: "texto-tenue texto-pequeno" });

  function actualizarNota() {
    notaModelo.replaceChildren(
      `${modelo.discreta ? "Discreta" : "Continua"} · ${modelo.dimensionalidad}. `,
      modelo.dimensionalidad !== "univariante" ? "Se analiza la primera componente marginal; el resto se descarta para el histograma." : "Se compara el histograma con la densidad teórica."
    );
  }

  campoModelo.control.addEventListener("change", () => {
    modelo = distribuciones.find((d) => d.clave === campoModelo.valor()) || modelo;
    parametros = crearCamposParametros(modelo, { valores: {} });
    contenedorParametros.replaceChildren(parametros.el);
    actualizarNota();
  });
  actualizarNota();

  async function ejecutar() {
    const validacion = parametros.validar();
    if (!validacion.ok) {
      toast("Revisa los parámetros de la distribución", { tipo: "error" });
      return;
    }
    const n = campoN.valor();
    if (typeof n !== "number" || !Number.isInteger(n) || n < 10 || n > 200000) {
      campoN.setError("Usa un entero entre 10 y 200 000.");
      return;
    }
    botonCalcular.cargando(true);
    const modeloUsado = modelo;
    const semillaUsada = campoSemilla.valor();
    try {
      const datos = await api.post("/api/simulacion", {
        tipo: "muestra",
        clave: modeloUsado.clave,
        parametros: validacion.valores,
        n,
        semilla: semillaUsada,
      });
      render(datos, validacion.valores, modeloUsado, semillaUsada);
      registrarHistorial({ titulo: `Simulación · ${modeloUsado.nombre}`, detalle: `${datos.n} observaciones · ${resumenParametros(modeloUsado, validacion.valores)}`, ruta: "simulacion/muestra", tipo: "simulacion", icono: "distribuciones" });
    } catch (error) {
      if (!esCancelacion(error)) mostrarErrorMotor(resultadoHost, error, "No se pudo generar la muestra", { ...parametros.campos, n: campoN, semilla: campoSemilla });
    } finally {
      botonCalcular.cargando(false);
    }
  }

  function render(datos, valores, modelo, semilla) {
    const graf = el("div");
    setTimeout(() => {
      dibujar(graf, {
        series: [
          { nombre: "Histograma", x: datos.histograma.centros, y: datos.histograma.densidad, tipo: "barra", anchoDatos: anchoClase(datos.histograma), color: "var(--grafico-2)" },
          datos.discreta
            ? { nombre: "Masa teórica", x: datos.teorica.x, y: datos.teorica.y, tipo: "dispersion", forma: "rombo", opacidad: 1, color: "var(--grafico-4)" }
            : { nombre: "Densidad teórica", x: datos.teorica.x, y: datos.teorica.y, tipo: "linea", color: "var(--grafico-4)" },
        ],
        xlabel: "x",
        ylabel: datos.discreta ? "Frecuencia relativa por valor" : "Densidad",
        zoom: false,
        altura: 300,
        yCero: true,
        ariaLabel: `Histograma de la muestra simulada y densidad teórica de ${datos.nombre}`,
      });
    }, 0);

    resultadoHost.replaceChildren(
      el(
        "div",
        { class: "pila" },
        panel({
          titulo: `Muestra de ${datos.nombre}`,
          subtitulo: `${datos.n} observaciones · ${resumenParametros(modelo, valores)}`,
          icono: "distribuciones",
          acciones: [
            ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) =>
              exportarSimulacion(nodo, {
                titulo: `Muestra simulada · ${datos.nombre}`,
                resumen: `${datos.n} observaciones · ${resumenParametros(modelo, valores)}`,
                tablas: [
                  { nombre: "Resumen", columnas: ["Métrica", "Valor"], filas: [["Media", datos.resumen.media], ["Mediana", datos.resumen.mediana], ["Desviación", datos.resumen.desviacion], ["Mínimo", datos.resumen.minimo], ["Máximo", datos.resumen.maximo], ["Q1", datos.resumen.q1], ["Q3", datos.resumen.q3]] },
                  { nombre: "Muestra", columnas: ["#", "Valor"], filas: datos.muestra.map((v, i) => [i + 1, v]) },
                ],
                figura: { series: [{ nombre: "Densidad teórica", x: datos.teorica.x, y: datos.teorica.y, tipo: "linea" }], xlabel: "x", ylabel: "Densidad", titulo: datos.nombre },
                estado: { tipo: "muestra", clave: modelo.clave, parametros: valores, n: datos.n, semilla },
              }, formato)),
            boton("Ajustar esta muestra", {
              variante: "secundario",
              pequeno: true,
              icono: "objetivo",
              onClick: () => {
                transito.simulacion = { tipo: "ajuste", clave: modelo.clave, datos: datos.muestra };
                navegar("simulacion/ajuste");
              },
            }),
          ],
          contenido: el(
            "div",
            { class: "pila" },
            el(
              "div",
              { class: "rejilla rejilla--kpi" },
              kpi({ etiqueta: "Media", valor: fmtNum(datos.resumen.media, { decimales: 4 }), detalle: "muestral", tono: "marca" }),
              kpi({ etiqueta: "Mediana", valor: fmtNum(datos.resumen.mediana, { decimales: 4 }), detalle: "percentil 50" }),
              kpi({ etiqueta: "Desviación", valor: fmtNum(datos.resumen.desviacion, { decimales: 4 }), detalle: "muestral (n−1)" }),
              kpi({ etiqueta: "Mínimo y máximo", valor: fmtIntervalo([datos.resumen.minimo, datos.resumen.maximo], { decimales: 3 }), detalle: `Q1 y Q3: ${fmtIntervalo([datos.resumen.q1, datos.resumen.q3], { decimales: 3 })}` })
            ),
            alerta({ tipo: "info", texto: datos.nota })
          ),
        }),
        panel({ titulo: "Muestra frente a teoría", icono: "grafico", contenido: graf }),
        panel({
          titulo: "Primeras observaciones",
          icono: "tabla",
          contenido: tabla({
            columnas: ["#", "Valor"],
            filas: datos.muestra.map((v, i) => [i + 1, v]),
            total: datos.n,
            maximo: 60,
            formatos: { Valor: (v) => fmtNum(v, { decimales: 5 }) },
            nota: `Vista previa de ${Math.min(60, datos.muestra.length)} valores. La muestra completa está disponible en Excel.`,
          }),
        })
      )
    );
  }

  botonCalcular.addEventListener("click", ejecutar);
  resultadoHost.append(panelEspera("Simula cualquier distribución", "Elige un modelo, ajusta sus parámetros y genera observaciones reproducibles. Compara el histograma con la densidad teórica."));

  const nodo = el(
    "div",
    { class: "pila" },
    panel({
      titulo: "Generar una muestra",
      subtitulo: "Los parámetros se validan con los mismos metadatos que usa el motor.",
      icono: "distribuciones",
      contenido: el(
        "div",
        { class: "pila" },
        el("div", { class: "rejilla rejilla--2" }, campoModelo.envoltura, campoN.envoltura),
        contenedorParametros,
        notaModelo,
        el("div", { class: "columnas-formulario" }, campoSemilla.envoltura),
        el("div", { class: "fila" }, botonCalcular)
      ),
    }),
    resultadoHost
  );

  if (pendiente?.tipo === "muestra" && pendiente.clave) {
    setTimeout(() => {
      campoModelo.setValor(modelo.clave);
      actualizarNota();
      ejecutar();
    }, 80);
  }

  return { nodo, ejecutar };
}

/* ================================================================== */
/* Ajuste                                                             */
/* ================================================================== */

function herramientaAjuste(pendiente, metaDatos) {
  let clave = MODELOS_AJUSTE.includes(pendiente?.clave) ? pendiente.clave : "normal";
  const campoModelo = campo({ etiqueta: "Modelo candidato", tipo: "select", valor: clave, opciones: MODELOS_AJUSTE.map((c) => [c, metaDatos.distribuciones.find((d) => d.clave === c)?.nombre || c]) });
  const campoDatos = campo({
    etiqueta: "Datos observados",
    tipo: "serie",
    filas: 5,
    valor: pendiente?.datos ? textoDeSerie(pendiente.datos) : EJEMPLO_AJUSTE,
    requerido: true,
    ayuda: "Al menos 5 observaciones. Los parámetros se estiman por máxima verosimilitud.",
  });
  const resultadoHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Ajustar", { icono: "reproducir", dataset: { accionPrimaria: "true" } });

  async function ejecutar() {
    const serie = serieValida(campoDatos, 5);
    if (!serie) return;
    botonCalcular.cargando(true);
    try {
      const datos = await api.post("/api/simulacion", { tipo: "ajuste", clave: campoModelo.valor(), datos: campoDatos.texto() });
      render(datos);
      registrarHistorial({ titulo: `Ajuste · ${datos.clave}`, detalle: `AIC ${fmtNum(datos.aic, { decimales: 2 })} · KS p = ${fmtP(datos.p_ks)}`, ruta: "simulacion/ajuste", tipo: "simulacion", icono: "objetivo" });
    } catch (error) {
      if (!esCancelacion(error)) mostrarErrorMotor(resultadoHost, error, "No se pudo ajustar", { datos: campoDatos });
    } finally {
      botonCalcular.cargando(false);
    }
  }

  function render(datos) {
    const graf = el("div");
    setTimeout(() => {
      dibujar(graf, {
        series: [
          { nombre: "Histograma", x: datos.histograma.centros, y: datos.histograma.densidad, tipo: "barra", anchoDatos: anchoClase(datos.histograma), color: "var(--grafico-2)" },
          { nombre: "Modelo ajustado", x: datos.curva.x, y: datos.curva.y, tipo: "linea", color: "var(--grafico-4)" },
        ],
        zoom: false,
        xlabel: "x",
        ylabel: "Densidad",
        altura: 290,
        yCero: true,
        ariaLabel: "Histograma de los datos y densidad del modelo ajustado",
      });
    }, 0);

    const filasParametros = Object.entries(datos.parametros || {}).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => fmtNum(x)).join(" · ") : v]);
    resultadoHost.replaceChildren(
      el(
        "div",
        { class: "pila" },
        panel({
          titulo: `Ajuste ${datos.clave}`,
          subtitulo: `${datos.n} observaciones · máxima verosimilitud`,
          icono: "objetivo",
          acciones: [
            ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) =>
              exportarSimulacion(nodo, {
                titulo: `Ajuste de distribución · ${datos.clave}`,
                resumen: `AIC: ${datos.aic}\nKS: ${datos.ks}\np-valor KS: ${datos.p_ks}\n${datos.nota}`,
                tablas: [
                  { nombre: "Parámetros", columnas: ["Parámetro", "Valor"], filas: filasParametros },
                  { nombre: "Bondad", columnas: ["Métrica", "Valor"], filas: [["AIC", datos.aic], ["KS", datos.ks], ["p-valor KS", datos.p_ks], ["n", datos.n]] },
                ],
                figura: { series: [{ nombre: "Modelo ajustado", x: datos.curva.x, y: datos.curva.y, tipo: "linea" }], xlabel: "x", ylabel: "Densidad", titulo: `Ajuste ${datos.clave}` },
                estado: { tipo: "ajuste", clave: datos.clave, datos: campoDatos.texto() },
              }, formato)),
          ],
          contenido: el(
            "div",
            { class: "pila" },
            el(
              "div",
              { class: "rejilla rejilla--kpi" },
              kpi({ etiqueta: "AIC", valor: fmtNum(datos.aic, { decimales: 2 }), detalle: "menor es mejor", tono: "marca" }),
              kpi({ etiqueta: "KS", valor: fmtNum(datos.ks, { decimales: 5 }), detalle: "distancia empírica" }),
              kpi({ etiqueta: "p-valor KS", valor: fmtP(datos.p_ks), detalle: "exploratorio" }),
              kpi({ etiqueta: "n", valor: fmtNum(datos.n, { entero: true }), detalle: "observaciones" })
            ),
            alerta({ tipo: "aviso", texto: datos.nota })
          ),
        }),
        el(
          "div",
          { class: "rejilla rejilla--2" },
          panel({ titulo: "Ajuste visual", icono: "grafico", contenido: graf }),
          panel({ titulo: "Parámetros estimados", icono: "tabla", contenido: tabla({ columnas: ["Parámetro", "Valor"], filas: filasParametros, total: filasParametros.length }) })
        ),
        datos.qq
          ? (() => {
              const hostQQ = el("div");
              setTimeout(() => {
                const xs = datos.qq.teoricos;
                const ys = datos.qq.observados;
                const min = Math.min(...xs);
                const max = Math.max(...xs);
                dibujar(hostQQ, {
                  series: [
                    { nombre: "Cuantiles observados", x: xs, y: ys, tipo: "dispersion", color: "var(--grafico-1)" },
                    { nombre: "Referencia", x: [min, max], y: [min, max], tipo: "linea", color: "var(--grafico-4)" },
                  ],
                  xlabel: "Cuantiles teóricos",
                  ylabel: "Cuantiles observados",
                  altura: 280,
                  ariaLabel: "QQ-plot del modelo ajustado",
                });
              }, 0);
              return panel({ titulo: "QQ-plot del ajuste", icono: "dispersion", contenido: hostQQ });
            })()
          : null
      )
    );
  }

  botonCalcular.addEventListener("click", ejecutar);
  resultadoHost.append(panelEspera("Ajusta una distribución", "Pega datos y compara el histograma con el modelo estimado. El p-valor KS es orientativo cuando los parámetros se estiman con los mismos datos."));
  const nodo = el(
    "div",
    { class: "pila" },
    panel({
      titulo: "Ajustar una distribución",
      subtitulo: "Seis familias con soporte para máxima verosimilitud.",
      icono: "objetivo",
      contenido: el(
        "div",
        { class: "pila" },
        campoModelo.envoltura,
        campoDatos.envoltura,
        el("div", { class: "fila" }, botonCalcular)
      ),
    }),
    resultadoHost
  );

  if (pendiente?.tipo === "ajuste" && pendiente.datos) {
    setTimeout(ejecutar, 80);
  }
  return { nodo, ejecutar };
}

/* ================================================================== */
/* QQ                                                                 */
/* ================================================================== */

function herramientaQQ(pendiente, metaDatos) {
  let modelo = metaDatos.distribuciones.find((d) => d.clave === (pendiente?.clave || "normal")) || metaDatos.distribuciones[0];
  let parametros = crearCamposParametros(modelo);
  const campoModelo = campo({ etiqueta: "Modelo teórico", tipo: "select", valor: modelo.clave, opciones: metaDatos.distribuciones.map((d) => [d.clave, d.nombre]) });
  const campoDatos = campo({
    etiqueta: "Datos observados",
    tipo: "serie",
    filas: 5,
    valor: pendiente?.datos ? textoDeSerie(pendiente.datos) : EJEMPLO_QQ,
    requerido: true,
    ayuda: "Al menos 3 observaciones para comparar cuantiles.",
  });
  const contenedorParametros = el("div", {}, parametros.el);
  const resultadoHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Construir QQ-plot", { icono: "reproducir", dataset: { accionPrimaria: "true" } });

  campoModelo.control.addEventListener("change", () => {
    modelo = metaDatos.distribuciones.find((d) => d.clave === campoModelo.valor()) || modelo;
    parametros = crearCamposParametros(modelo);
    contenedorParametros.replaceChildren(parametros.el);
  });

  async function ejecutar() {
    const serie = serieValida(campoDatos, 3);
    if (!serie) return;
    const validacion = parametros.validar();
    if (!validacion.ok) {
      toast("Revisa los parámetros del modelo", { tipo: "error" });
      return;
    }
    botonCalcular.cargando(true);
    const modeloUsado = modelo;
    const parametrosUsados = validacion.valores;
    try {
      const datos = await api.post("/api/simulacion", { tipo: "qq", clave: modeloUsado.clave, parametros: parametrosUsados, datos: campoDatos.texto() });
      render(datos, modeloUsado, parametrosUsados);
      registrarHistorial({ titulo: `QQ-plot · ${modeloUsado.nombre}`, detalle: `${datos.n} observaciones`, ruta: "simulacion/qq", tipo: "simulacion", icono: "dispersion" });
    } catch (error) {
      if (!esCancelacion(error)) mostrarErrorMotor(resultadoHost, error, "No se pudo construir el QQ-plot", { ...parametros.campos, datos: campoDatos });
    } finally {
      botonCalcular.cargando(false);
    }
  }

  function render(datos, modelo, parametrosUsados) {
    const host = el("div");
    setTimeout(() => {
      const xs = datos.teoricos;
      const ys = datos.observados;
      const min = Math.min(...xs, ...ys);
      const max = Math.max(...xs, ...ys);
      dibujar(host, {
        series: [
          { nombre: "Cuantiles", x: xs, y: ys, tipo: "dispersion", color: "var(--grafico-1)" },
          { nombre: "Ajuste perfecto", x: [min, max], y: [min, max], tipo: "linea", color: "var(--grafico-4)" },
        ],
        xlabel: "Cuantiles teóricos",
        ylabel: "Cuantiles observados",
        altura: 320,
        ariaLabel: "QQ-plot de cuantiles observados frente a teóricos",
      });
    }, 0);
    resultadoHost.replaceChildren(
      el(
        "div",
        { class: "pila" },
        panel({
          titulo: `QQ-plot · ${modelo.nombre}`,
          subtitulo: datos.nota,
          icono: "dispersion",
          acciones: [
            ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) =>
              exportarSimulacion(nodo, {
                titulo: `QQ-plot · ${modelo.nombre}`,
                resumen: datos.nota,
                tablas: [{ nombre: "Cuantiles", columnas: ["Teórico", "Observado"], filas: datos.teoricos.map((v, i) => [v, datos.observados[i]]) }],
                figura: { series: [{ nombre: "Cuantiles", x: datos.teoricos, y: datos.observados, tipo: "dispersion" }], xlabel: "Cuantiles teóricos", ylabel: "Cuantiles observados", titulo: "QQ-plot" },
                estado: { tipo: "qq", clave: modelo.clave, parametros: parametrosUsados, datos: campoDatos.texto() },
              }, formato)),
          ],
          contenido: el(
            "div",
            { class: "pila" },
            el("div", { class: "rejilla rejilla--kpi" }, kpi({ etiqueta: "n", valor: fmtNum(datos.n, { entero: true }), detalle: "observaciones" }), kpi({ etiqueta: "Parámetros", valor: String(Object.keys(parametros.valores()).length), detalle: resumenParametros(modelo, parametros.valores()) })),
            alerta({ tipo: "info", texto: "Una separación en los extremos puede indicar diferencias entre las colas del modelo y las de los datos." })
          ),
        }),
        panel({ titulo: "Cuantiles", icono: "grafico", contenido: host })
      )
    );
  }

  botonCalcular.addEventListener("click", ejecutar);
  resultadoHost.append(panelEspera("Diagnostica el ajuste", "El QQ-plot enfrenta los cuantiles observados con los del modelo. Puntos cercanos a una recta sugieren concordancia; no la demuestran."));
  return {
    nodo: el(
      "div",
      { class: "pila" },
      panel({
        titulo: "QQ-plot frente a un modelo",
        subtitulo: "Compara la forma de las colas, no solo la media y la varianza.",
        icono: "dispersion",
        contenido: el(
          "div",
          { class: "pila" },
          el("div", { class: "rejilla rejilla--2" }, campoModelo.envoltura, campoDatos.envoltura),
          contenedorParametros,
          el("div", { class: "fila" }, botonCalcular)
        ),
      }),
      resultadoHost
    ),
    ejecutar,
  };
}

/* ================================================================== */
/* Vista                                                              */
/* ================================================================== */

export async function montar(host, parametro) {
  let metaDatos;
  try {
    metaDatos = await cargarMeta();
  } catch (error) {
    host.append(alerta({ tipo: "error", titulo: "El motor no responde", texto: textoError(error) }));
    return null;
  }

  let pendiente = transito.simulacion;
  transito.simulacion = null;
  let activa = HERRAMIENTAS.some((h) => h.clave === parametro)
    ? parametro
    : HERRAMIENTAS.some((h) => h.clave === pendiente?.tipo)
      ? pendiente.tipo
      : "pi";

  const selector = el("div", { class: "rejilla rejilla--herramientas" });
  const contenido = el("div", { class: "pila" });
  const constructores = {
    pi: () => herramientaPi(pendiente?.tipo === "pi" ? pendiente : null),
    integral: () => herramientaIntegral(pendiente?.tipo === "integral" ? pendiente : null),
    muestra: () => herramientaMuestra(pendiente, metaDatos),
    ajuste: () => herramientaAjuste(pendiente, metaDatos),
    qq: () => herramientaQQ(pendiente, metaDatos),
  };

  /* Los gráficos de simulación viven dentro de «contenido» y registran un
     ResizeObserver; se desconecta al cambiar de herramienta o de vista. */
  function desconectarGraficos() {
    contenido.querySelectorAll(".grafico").forEach((nodo) => nodo._observadorGrafico?.disconnect());
  }

  function renderSelector() {
    selector.replaceChildren();
    for (const h of HERRAMIENTAS) {
      selector.append(
        el(
          "button",
          {
            type: "button",
            class: `tarjeta-herramienta ${h.clave === activa ? "tarjeta-herramienta--activa" : ""}`,
            "aria-pressed": String(h.clave === activa),
            onClick: () => {
              activa = h.clave;
              history.replaceState(null, "", `#/simulacion/${h.clave}`);
              renderSelector();
              desconectarGraficos();
              contenido.replaceChildren(constructores[h.clave]().nodo);
              anunciar(`Herramienta ${h.nombre} seleccionada.`);
            },
          },
          el("span", { class: "tarjeta-herramienta__icono" }, icono(h.icono, { tamano: 17 })),
          el("span", { class: "tarjeta-herramienta__titulo" }, h.nombre),
          el("span", { class: "tarjeta-herramienta__texto" }, h.descripcion)
        )
      );
    }
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
          el("span", { class: "ceja" }, "Diseñar · Simulación"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("simulacion", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Simulación y Monte Carlo")
          ),
          el(
            "p",
            { class: "vista__subtitulo" },
            VISTAS.simulacion.subtitulo
          )
        ),
        el("div", { class: "vista__acciones" }, boton("Leer Monte Carlo", { variante: "secundario", icono: "teoria", onClick: () => navegar("teoria/montecarlo") }))
      ),
      selector,
      contenido
    )
  );

  renderSelector();
  contenido.append(constructores[activa]().nodo);
  pendiente = null;

  return () => desconectarGraficos();
}
