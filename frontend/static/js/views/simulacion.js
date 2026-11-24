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
  pestanas,
  anunciar,
  botonesExportar,
} from "../ui.js";
import { icono } from "../icons.js";
import { dibujar } from "../chart.js";
import { api, esCancelacion } from "../api.js";
import { fmtEntrada, leerSerie } from "../entrada.js";
import { cargarMeta, navegar, registrarHistorial, transito } from "../store.js";
import { crearCamposParametros, resumenParametros } from "../params.js";
import { abrirVentana, cerrarVentanasPorAlcance, ventanasAbiertas, barraResultados } from "../ventanas.js";
import { abrirTeoriaVentana } from "../teoria_dialogo.js";

const HERRAMIENTAS = [
  { clave: "pi", nombre: "Estimar π", descripcion: "Monte Carlo geométrico con convergencia e intervalo.", icono: "pi", teoria: "montecarlo" },
  { clave: "integral", nombre: "Integrar", descripcion: "Integrales definidas por promedio de valores aleatorios.", icono: "integral", teoria: "montecarlo" },
  { clave: "muestra", nombre: "Generar muestra", descripcion: "Simula cualquiera de las 26 distribuciones del motor.", icono: "distribuciones", teoria: "normal" },
  { clave: "ajuste", nombre: "Ajustar distribución", descripcion: "Máxima verosimilitud, AIC y KS exploratorio.", icono: "objetivo", teoria: "ajuste_distribuciones" },
  { clave: "qq", nombre: "QQ-plot", descripcion: "Compara cuantiles empíricos y teóricos.", icono: "dispersion", teoria: "qq_plot" },
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

function anchoClase(histograma) {
  const { bordes, centros } = histograma || {};
  if (Array.isArray(bordes) && bordes.length > 1) return bordes[1] - bordes[0];
  if (Array.isArray(centros) && centros.length > 1) return centros[1] - centros[0];
  return 1;
}

function textoDeSerie(valor) {
  if (Array.isArray(valor)) return valor.map((v) => (typeof v === "number" ? fmtEntrada(v) : String(v))).join(" ");
  return valor ?? "";
}

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

function mostrarErrorMotor(errorHost, error, titulo, campos = {}) {
  const enCampo = errorEnCampo(error, campos);
  errorHost.replaceChildren(
    alerta({ tipo: "error", titulo: error.tipo === "timeout" ? "La simulación tardó demasiado" : enCampo ? `${titulo}: revisa el campo marcado` : titulo, texto: textoError(error) })
  );
  anunciar(`Error: ${error.message}`);
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
  let resultado = null;
  const campoN = crearCampoNumerico("n", "Simulaciones", pendiente?.n || 10000, { min: 100, max: 200000, ayuda: "El error disminuye aproximadamente como 1/√n." });
  const campoSemilla = crearCampoNumerico("semilla", "Semilla", 42, { min: 0, max: 999999999 });
  const campoConfianza = campo({ etiqueta: "Confianza del intervalo", tipo: "select", valor: "0.95", opciones: [["0.90", "90 %"], ["0.95", "95 %"], ["0.99", "99 %"]] });
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Simular", { icono: "reproducir", dataset: { accionPrimaria: "true" } });

  function abrirGrafico({ enfocar = true } = {}) {
    if (!resultado) return;
    const graf = el("div");
    abrirVentana({
      id: "sim-grafico",
      titulo: "Convergencia · Estimación de π",
      tituloCorto: "Convergencia",
      subtitulo: `Intervalo al ${fmtPorcentaje(resultado.confianza ?? 0.95, 0)}`,
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("PNG", { variante: "fantasma", pequeno: true, icono: "imagen", onClick: (e) => exportar(e.currentTarget, "png") }),
      ],
      contenido: graf,
      pie: boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
    });
    dibujar(graf, { ...configConvergencia(resultado.convergencia, Math.PI, "π exacto"), titulo: "Convergencia de la estimación de π" });
  }

  function exportar(nodo, formato) {
    if (!resultado) return Promise.resolve();
    const datos = resultado;
    return exportarSimulacion(nodo, {
      titulo: "Monte Carlo · estimación de π",
      resumen: `π ≈ ${datos.estimacion.valor}\nError absoluto: ${datos.error_absoluto}\nIntervalo: [${datos.estimacion.intervalo[0]}, ${datos.estimacion.intervalo[1]}]`,
      tablas: [{ nombre: "Estimación", columnas: ["Métrica", "Valor"], filas: [["Estimación", datos.estimacion.valor], ["π exacto", Math.PI], ["Error absoluto", datos.error_absoluto], ["Error estándar", datos.estimacion.error_estandar], ["Límite inferior", datos.estimacion.intervalo[0]], ["Límite superior", datos.estimacion.intervalo[1]], ["Simulaciones", datos.estimacion.n]] }],
      figura: { series: [{ nombre: "Estimación", x: datos.convergencia.n, y: datos.convergencia.valor, tipo: "linea" }], xlabel: "Simulaciones", ylabel: "π estimado", titulo: "Convergencia" },
      estado: { tipo: "pi", n: datos.estimacion.n, semilla: campoSemilla.valor() },
    }, formato);
  }

  function abrirResultado({ enfocar = true } = {}) {
    if (!resultado) return;
    const datos = resultado;
    abrirVentana({
      id: "sim-resultados",
      titulo: "Estimación de π",
      tituloCorto: "π ≈ " + fmtNum(datos.estimacion.valor, { decimales: 4 }),
      subtitulo: datos.nota,
      icono: "pi",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
      contenido: el(
        "div",
        { class: "pila" },
        el("div", { class: "numero-grande" }, fmtNum(datos.estimacion.valor, { decimales: 6 })),
        el(
          "div",
          { class: "rejilla rejilla--kpi" },
          kpi({ etiqueta: "Error absoluto", valor: fmtNum(datos.error_absoluto, { decimales: 6 }), detalle: `π = ${fmtNum(Math.PI, { decimales: 6 })}`, tono: datos.error_absoluto < 0.01 ? "ok" : "aviso" }),
          kpi({ etiqueta: "Intervalo", valor: fmtIntervalo(datos.estimacion.intervalo, { decimales: 5 }), detalle: `${fmtPorcentaje(datos.confianza ?? Number(campoConfianza.valor()), 0)} de confianza`, tono: "marca" }),
          kpi({ etiqueta: "Error estándar", valor: fmtNum(datos.estimacion.error_estandar, { decimales: 6 }), detalle: "precisión de la media" })
        ),
        alerta({ tipo: "info", texto: `Cada punto cae dentro del cuarto de círculo con probabilidad π/4. La fracción observada es ${fmtNum(datos.estimacion.valor / 4, { decimales: 6 })}.` })
      ),
      pie: el(
        "div",
        { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
        el("div", { class: "fila", style: { gap: "6px" } },
          boton("Ver convergencia", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() }),
          boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("montecarlo", { alcance: "vista" }) })
        ),
        el("div", { class: "fila", style: { gap: "6px" } },
          boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(`π ≈ ${datos.estimacion.valor}`) }),
          ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) => exportar(nodo, formato), { variante: "fantasma" })
        )
      ),
    });
  }

  function renderBarra() {
    if (!resultado) { barraHost.replaceChildren(); return; }
    barraHost.replaceChildren(
      barraResultados({
        icono: "pi",
        resumen: `π ≈ ${fmtNum(resultado.estimacion.valor, { decimales: 6 })} · error ${fmtNum(resultado.error_absoluto, { decimales: 5 })}`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
          boton("Convergencia", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() }),
        ],
      })
    );
  }

  async function ejecutar() {
    const n = campoN.valor();
    if (typeof n !== "number" || !Number.isInteger(n) || n < 100 || n > 200000) {
      campoN.setError("Usa un entero entre 100 y 200 000.");
      return;
    }
    botonCalcular.cargando(true);
    errorHost.replaceChildren();
    try {
      const datos = await api.post("/api/simulacion", { tipo: "pi", n, semilla: campoSemilla.valor(), confianza: Number(campoConfianza.valor()) });
      resultado = datos;
      renderBarra();
      abrirResultado();
      if (ventanasAbiertas().some((v) => v.id === "sim-grafico")) abrirGrafico({ enfocar: false });
      registrarHistorial({ titulo: "Monte Carlo · π", detalle: `${fmtNum(datos.estimacion.valor, { decimales: 6 })} ± ${fmtNum(datos.estimacion.error_estandar, { decimales: 6 })}`, ruta: "simulacion/pi", tipo: "simulacion", icono: "pi" });
    } catch (error) {
      if (!esCancelacion(error)) mostrarErrorMotor(errorHost, error, "No se pudo simular", { n: campoN, semilla: campoSemilla });
    } finally {
      botonCalcular.cargando(false);
    }
  }

  botonCalcular.addEventListener("click", ejecutar);
  const nodo = panelControles("Estimar π por Monte Carlo", "La precisión mejora con √n: para dividir el error por 10 necesitas 100 veces más puntos.", [campoN, campoSemilla, campoConfianza], el("div", { class: "fila" }, botonCalcular), el("div", { class: "formula-card" }, el("span", { class: "formula-etiqueta" }, "Estimador"), el("p", { class: "formula-texto" }, "π ≈ 4 · (puntos dentro / puntos totales)")));
  return { nodo: el("div", { class: "pila" }, nodo, barraHost, errorHost), ejecutar };
}

/* ================================================================== */
/* Integral                                                           */
/* ================================================================== */

function herramientaIntegral(pendiente) {
  let resultado = null;
  let tabGraf = "funcion";
  const campoFuncion = campo({ etiqueta: "Función", tipo: "select", valor: "cuadrado", opciones: FUNCIONES_INTEGRAL });
  const campoA = campo({ etiqueta: "Límite inferior a", tipo: "numero", valor: "", opcional: true, placeholder: "según función" });
  const campoB = campo({ etiqueta: "Límite superior b", tipo: "numero", valor: "", opcional: true, placeholder: "según función" });
  const campoN = crearCampoNumerico("n", "Simulaciones", pendiente?.n || 10000, { min: 100, max: 200000 });
  const campoSemilla = crearCampoNumerico("semilla", "Semilla", 42, { min: 0, max: 999999999 });
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Integrar", { icono: "reproducir", dataset: { accionPrimaria: "true" } });

  function abrirGraficos({ enfocar = true } = {}) {
    if (!resultado) return;
    const datos = resultado;
    const grafFunc = el("div");
    const grafConv = el("div");
    const pintar = (c) => {
      if (c === "funcion") {
        dibujar(grafFunc, {
          series: [{ nombre: `f(x) = ${datos.etiqueta}`, x: datos.curva.x, y: datos.curva.y, tipo: "linea", relleno: true, color: "var(--grafico-1)" }],
          xlabel: "x",
          ylabel: "f(x)",
          altura: 290,
          ariaLabel: `Función ${datos.etiqueta}`,
        });
      } else {
        dibujar(grafConv, { ...configConvergencia(datos.convergencia, datos.referencia.valor, "Valor exacto"), titulo: "Convergencia de la integral" });
      }
    };
    const tabs = pestanas({
      etiqueta: "Gráficos de integración",
      activa: tabGraf,
      items: [
        { clave: "funcion", titulo: "Función integrada", icono: "integral", contenido: grafFunc },
        { clave: "convergencia", titulo: "Convergencia", icono: "grafico", contenido: grafConv },
      ],
      onCambio: (c) => { tabGraf = c; pintar(c); },
    });

    abrirVentana({
      id: "sim-grafico",
      titulo: `Gráficos · Integral de ${datos.etiqueta}`,
      tituloCorto: "Gráficos",
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("PNG", { variante: "fantasma", pequeno: true, icono: "imagen", onClick: (e) => exportar(e.currentTarget, "png") }),
      ],
      contenido: tabs,
      pie: boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
    });
    pintar(tabGraf);
  }

  function exportar(nodo, formato) {
    if (!resultado) return Promise.resolve();
    const datos = resultado;
    return exportarSimulacion(nodo, {
      titulo: `Integral de ${datos.etiqueta}`,
      resumen: `Estimación: ${datos.estimacion.valor}\nValor exacto: ${datos.referencia.valor}\nError absoluto: ${datos.error_absoluto}`,
      tablas: [{ nombre: "Integral", columnas: ["Métrica", "Valor"], filas: [["Estimación", datos.estimacion.valor], ["Valor exacto", datos.referencia.valor], ["Error absoluto", datos.error_absoluto], ["Error estándar", datos.estimacion.error_estandar], ["Límite inferior", datos.estimacion.intervalo[0]], ["Límite superior", datos.estimacion.intervalo[1]]] }],
      figura: { series: [{ nombre: datos.etiqueta, x: datos.curva.x, y: datos.curva.y, tipo: "linea" }], xlabel: "x", ylabel: "f(x)", titulo: "Función integrada" },
      estado: { tipo: "integral", funcion: campoFuncion.valor(), n: campoN.valor(), semilla: campoSemilla.valor() },
    }, formato);
  }

  function abrirResultado({ enfocar = true } = {}) {
    if (!resultado) return;
    const datos = resultado;
    abrirVentana({
      id: "sim-resultados",
      titulo: `Integral de ${datos.etiqueta}`,
      tituloCorto: "Integral",
      subtitulo: `En ${fmtIntervalo(datos.intervalo_integracion)} · ${datos.nota}`,
      icono: "integral",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
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
      pie: el(
        "div",
        { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
        el("div", { class: "fila", style: { gap: "6px" } },
          boton("Ver gráficos", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGraficos() }),
          boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("montecarlo", { alcance: "vista" }) })
        ),
        el("div", { class: "fila", style: { gap: "6px" } },
          ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) => exportar(nodo, formato), { variante: "fantasma" })
        )
      ),
    });
  }

  function renderBarra() {
    if (!resultado) { barraHost.replaceChildren(); return; }
    barraHost.replaceChildren(
      barraResultados({
        icono: "integral",
        resumen: `∫ ${resultado.etiqueta} ≈ ${fmtNum(resultado.estimacion.valor, { decimales: 5 })} (exacto ${fmtNum(resultado.referencia.valor, { decimales: 5 })})`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
          boton("Gráficos", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGraficos() }),
        ],
      })
    );
  }

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
    errorHost.replaceChildren();
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
      resultado = datos;
      renderBarra();
      abrirResultado();
      if (ventanasAbiertas().some((v) => v.id === "sim-grafico")) abrirGraficos({ enfocar: false });
      registrarHistorial({ titulo: "Monte Carlo · integral", detalle: `${datos.etiqueta}: ${fmtNum(datos.estimacion.valor, { decimales: 5 })}`, ruta: "simulacion/integral", tipo: "simulacion", icono: "sigma" });
    } catch (error) {
      if (!esCancelacion(error)) mostrarErrorMotor(errorHost, error, "No se pudo integrar", { a: campoA, b: campoB, n: campoN, semilla: campoSemilla });
    } finally {
      botonCalcular.cargando(false);
    }
  }

  botonCalcular.addEventListener("click", ejecutar);
  return {
    nodo: el("div", { class: "pila" }, panelControles("Integración Monte Carlo", "Elige una función de referencia. Si dejas a y b vacíos se usan los límites naturales.", [campoFuncion, campoA, campoB, campoN, campoSemilla], el("div", { class: "fila" }, botonCalcular)), barraHost, errorHost),
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
  let ultimoEstado = null;

  const campoModelo = campo({
    etiqueta: "Distribución",
    tipo: "select",
    valor: modelo.clave,
    opciones: distribuciones.map((d) => [d.clave, d.nombre]),
  });
  const campoN = crearCampoNumerico("n", "Tamaño de la muestra", pendiente?.n || 1000, { min: 10, max: 200000 });
  const campoSemilla = crearCampoNumerico("semilla", "Semilla", 42, { min: 0, max: 999999999 });
  const contenedorParametros = el("div", {}, parametros.el);
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Generar muestra", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
  const notaModelo = el("p", { class: "texto-tenue texto-pequeno" });

  function actualizarNota() {
    notaModelo.replaceChildren(
      `${modelo.discreta ? "Discreta" : "Continua"} · ${modelo.dimensionalidad}. `,
      modelo.dimensionalidad !== "univariante" ? "Se analiza la primera componente marginal." : "Se compara el histograma con la densidad teórica."
    );
  }

  campoModelo.control.addEventListener("change", () => {
    modelo = distribuciones.find((d) => d.clave === campoModelo.valor()) || modelo;
    parametros = crearCamposParametros(modelo, { valores: {} });
    contenedorParametros.replaceChildren(parametros.el);
    actualizarNota();
  });
  actualizarNota();

  function exportar(nodo, formato) {
    if (!ultimoEstado) return Promise.resolve();
    const { datos, valores, modelo: mod, semilla } = ultimoEstado;
    return exportarSimulacion(nodo, {
      titulo: `Muestra simulada · ${datos.nombre}`,
      resumen: `${datos.n} observaciones · ${resumenParametros(mod, valores)}`,
      tablas: [
        { nombre: "Resumen", columnas: ["Métrica", "Valor"], filas: [["Media", datos.resumen.media], ["Mediana", datos.resumen.mediana], ["Desviación", datos.resumen.desviacion], ["Mínimo", datos.resumen.minimo], ["Máximo", datos.resumen.maximo], ["Q1", datos.resumen.q1], ["Q3", datos.resumen.q3]] },
        { nombre: "Muestra", columnas: ["#", "Valor"], filas: datos.muestra.map((v, i) => [i + 1, v]) },
      ],
      figura: { series: [{ nombre: "Densidad teórica", x: datos.teorica.x, y: datos.teorica.y, tipo: "linea" }], xlabel: "x", ylabel: "Densidad", titulo: datos.nombre },
      estado: { tipo: "muestra", clave: mod.clave, parametros: valores, n: datos.n, semilla },
    }, formato);
  }

  function abrirGrafico({ enfocar = true } = {}) {
    if (!ultimoEstado) return;
    const { datos } = ultimoEstado;
    const graf = el("div");
    abrirVentana({
      id: "sim-grafico",
      titulo: `Muestra frente a teoría · ${datos.nombre}`,
      tituloCorto: "Gráfico",
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("PNG", { variante: "fantasma", pequeno: true, icono: "imagen", onClick: (e) => exportar(e.currentTarget, "png") }),
      ],
      contenido: graf,
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Observaciones", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: () => abrirTabla() })
      ),
    });
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
      altura: 310,
      yCero: true,
      ariaLabel: `Histograma de la muestra simulada y densidad teórica de ${datos.nombre}`,
    });
  }

  function abrirTabla({ enfocar = true } = {}) {
    if (!ultimoEstado) return;
    const { datos } = ultimoEstado;
    abrirVentana({
      id: "sim-tabla",
      titulo: `Primeras observaciones · ${datos.nombre}`,
      tituloCorto: "Observaciones",
      subtitulo: `Vista previa de ${Math.min(60, datos.muestra.length)} de ${datos.n} valores`,
      icono: "tabla",
      tipo: "tabla",
      alcance: "vista",
      enfocar,
      contenido: tabla({
        columnas: ["#", "Valor"],
        filas: datos.muestra.map((v, i) => [i + 1, v]),
        total: datos.n,
        maximo: 60,
        formatos: { Valor: (v) => fmtNum(v, { decimales: 5 }) },
        nota: "La muestra completa está disponible al exportar a Excel o CSV.",
      }),
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Gráfico", { variante: "fantasma", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() })
      ),
    });
  }

  function abrirResultado({ enfocar = true } = {}) {
    if (!ultimoEstado) return;
    const { datos, valores, modelo: mod } = ultimoEstado;
    abrirVentana({
      id: "sim-resultados",
      titulo: `Muestra de ${datos.nombre}`,
      tituloCorto: datos.nombre,
      subtitulo: `${datos.n} observaciones · ${resumenParametros(mod, valores)}`,
      icono: "distribuciones",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
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
      pie: el(
        "div",
        { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
        el(
          "div",
          { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
          boton("Ver gráfico", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() }),
          boton("Observaciones", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTabla() }),
          boton("Ajustar esta muestra", {
            variante: "secundario",
            pequeno: true,
            icono: "objetivo",
            onClick: () => {
              transito.simulacion = { tipo: "ajuste", clave: mod.clave, datos: datos.muestra };
              navegar("simulacion/ajuste");
            },
          }),
          boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana(mod.clave, { alcance: "vista" }) })
        ),
        el(
          "div",
          { class: "fila", style: { gap: "6px" } },
          ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) => exportar(nodo, formato), { variante: "fantasma" })
        )
      ),
    });
  }

  function renderBarra() {
    if (!ultimoEstado) { barraHost.replaceChildren(); return; }
    const { datos } = ultimoEstado;
    barraHost.replaceChildren(
      barraResultados({
        icono: "distribuciones",
        resumen: `${datos.nombre} (${datos.n} obs.) · media ${fmtNum(datos.resumen.media, { decimales: 3 })}`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
          boton("Gráfico", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() }),
          boton("Observaciones", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTabla() }),
        ],
      })
    );
  }

  async function ejecutar() {
    const validacion = parametros.validar();
    if (!validacion.ok) { toast("Revisa los parámetros de la distribución", { tipo: "error" }); return; }
    const n = campoN.valor();
    if (typeof n !== "number" || !Number.isInteger(n) || n < 10 || n > 200000) {
      campoN.setError("Usa un entero entre 10 y 200 000.");
      return;
    }
    botonCalcular.cargando(true);
    errorHost.replaceChildren();
    const modeloUsado = modelo;
    const semillaUsada = campoSemilla.valor();
    try {
      const datos = await api.post("/api/simulacion", { tipo: "muestra", clave: modeloUsado.clave, parametros: validacion.valores, n, semilla: semillaUsada });
      ultimoEstado = { datos, valores: validacion.valores, modelo: modeloUsado, semilla: semillaUsada };
      renderBarra();
      abrirResultado();
      if (ventanasAbiertas().some((v) => v.id === "sim-grafico")) abrirGrafico({ enfocar: false });
      if (ventanasAbiertas().some((v) => v.id === "sim-tabla")) abrirTabla({ enfocar: false });
      registrarHistorial({ titulo: `Simulación · ${modeloUsado.nombre}`, detalle: `${datos.n} observaciones · ${resumenParametros(modeloUsado, validacion.valores)}`, ruta: "simulacion/muestra", tipo: "simulacion", icono: "distribuciones" });
    } catch (error) {
      if (!esCancelacion(error)) mostrarErrorMotor(errorHost, error, "No se pudo generar la muestra", { ...parametros.campos, n: campoN, semilla: campoSemilla });
    } finally {
      botonCalcular.cargando(false);
    }
  }

  botonCalcular.addEventListener("click", ejecutar);

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
    barraHost,
    errorHost
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
  let resultado = null;
  let tabGraf = "ajuste";

  const campoModelo = campo({ etiqueta: "Modelo candidato", tipo: "select", valor: clave, opciones: MODELOS_AJUSTE.map((c) => [c, metaDatos.distribuciones.find((d) => d.clave === c)?.nombre || c]) });
  const campoDatos = campo({
    etiqueta: "Datos observados",
    tipo: "serie",
    filas: 5,
    valor: pendiente?.datos ? textoDeSerie(pendiente.datos) : EJEMPLO_AJUSTE,
    requerido: true,
    ayuda: "Al menos 5 observaciones. Los parámetros se estiman por máxima verosimilitud.",
  });
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Ajustar", { icono: "reproducir", dataset: { accionPrimaria: "true" } });

  function exportar(nodo, formato) {
    if (!resultado) return Promise.resolve();
    const datos = resultado;
    const filasParametros = Object.entries(datos.parametros || {}).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => fmtNum(x)).join(" · ") : v]);
    return exportarSimulacion(nodo, {
      titulo: `Ajuste de distribución · ${datos.clave}`,
      resumen: `AIC: ${datos.aic}\nKS: ${datos.ks}\np-valor KS: ${datos.p_ks}\n${datos.nota}`,
      tablas: [
        { nombre: "Parámetros", columnas: ["Parámetro", "Valor"], filas: filasParametros },
        { nombre: "Bondad", columnas: ["Métrica", "Valor"], filas: [["AIC", datos.aic], ["KS", datos.ks], ["p-valor KS", datos.p_ks], ["n", datos.n]] },
      ],
      figura: { series: [{ nombre: "Modelo ajustado", x: datos.curva.x, y: datos.curva.y, tipo: "linea" }], xlabel: "x", ylabel: "Densidad", titulo: `Ajuste ${datos.clave}` },
      estado: { tipo: "ajuste", clave: datos.clave, datos: campoDatos.texto() },
    }, formato);
  }

  function abrirGraficos({ enfocar = true } = {}) {
    if (!resultado) return;
    const datos = resultado;
    const grafHist = el("div");
    const grafQQ = el("div");
    const pintar = (c) => {
      if (c === "ajuste") {
        dibujar(grafHist, {
          series: [
            { nombre: "Histograma", x: datos.histograma.centros, y: datos.histograma.densidad, tipo: "barra", anchoDatos: anchoClase(datos.histograma), color: "var(--grafico-2)" },
            { nombre: "Modelo ajustado", x: datos.curva.x, y: datos.curva.y, tipo: "linea", color: "var(--grafico-4)" },
          ],
          zoom: false,
          xlabel: "x",
          ylabel: "Densidad",
          altura: 300,
          yCero: true,
          ariaLabel: "Histograma de los datos y densidad del modelo ajustado",
        });
      } else if (datos.qq) {
        const xs = datos.qq.teoricos;
        const ys = datos.qq.observados;
        const min = Math.min(...xs);
        const max = Math.max(...xs);
        dibujar(grafQQ, {
          series: [
            { nombre: "Cuantiles observados", x: xs, y: ys, tipo: "dispersion", color: "var(--grafico-1)" },
            { nombre: "Referencia", x: [min, max], y: [min, max], tipo: "linea", color: "var(--grafico-4)" },
          ],
          xlabel: "Cuantiles teóricos",
          ylabel: "Cuantiles observados",
          altura: 300,
          ariaLabel: "QQ-plot del modelo ajustado",
        });
      }
    };
    const items = [{ clave: "ajuste", titulo: "Ajuste visual", icono: "grafico", contenido: grafHist }];
    if (datos.qq) items.push({ clave: "qq", titulo: "QQ-plot", icono: "dispersion", contenido: grafQQ });
    else if (tabGraf === "qq") tabGraf = "ajuste";

    const tabs = pestanas({
      etiqueta: "Gráficos de ajuste",
      activa: tabGraf,
      items,
      onCambio: (c) => { tabGraf = c; pintar(c); },
    });

    abrirVentana({
      id: "sim-grafico",
      titulo: `Gráficos · Ajuste ${datos.clave}`,
      tituloCorto: "Gráficos",
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("PNG", { variante: "fantasma", pequeno: true, icono: "imagen", onClick: (e) => exportar(e.currentTarget, "png") }),
      ],
      contenido: tabs,
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Parámetros", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: () => abrirTabla() })
      ),
    });
    pintar(tabGraf);
  }

  function abrirTabla({ enfocar = true } = {}) {
    if (!resultado) return;
    const datos = resultado;
    const filasParametros = Object.entries(datos.parametros || {}).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => fmtNum(x)).join(" · ") : v]);
    abrirVentana({
      id: "sim-tabla",
      titulo: `Parámetros estimados · ${datos.clave}`,
      tituloCorto: "Parámetros",
      icono: "tabla",
      tipo: "tabla",
      alcance: "vista",
      enfocar,
      contenido: tabla({ columnas: ["Parámetro", "Valor"], filas: filasParametros, total: filasParametros.length }),
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Gráficos", { variante: "fantasma", pequeno: true, icono: "grafico", onClick: () => abrirGraficos() })
      ),
    });
  }

  function abrirResultado({ enfocar = true } = {}) {
    if (!resultado) return;
    const datos = resultado;
    abrirVentana({
      id: "sim-resultados",
      titulo: `Ajuste ${datos.clave}`,
      tituloCorto: `Ajuste ${datos.clave}`,
      subtitulo: `${datos.n} observaciones · máxima verosimilitud`,
      icono: "objetivo",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
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
      pie: el(
        "div",
        { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
        el("div", { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
          boton("Ver gráficos", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGraficos() }),
          boton("Parámetros", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTabla() }),
          boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("ajuste_distribuciones", { alcance: "vista" }) })
        ),
        el("div", { class: "fila", style: { gap: "6px" } },
          ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) => exportar(nodo, formato), { variante: "fantasma" })
        )
      ),
    });
  }

  function renderBarra() {
    if (!resultado) { barraHost.replaceChildren(); return; }
    barraHost.replaceChildren(
      barraResultados({
        icono: "objetivo",
        resumen: `Ajuste ${resultado.clave} · AIC ${fmtNum(resultado.aic, { decimales: 2 })} · p(KS) = ${fmtP(resultado.p_ks)}`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
          boton("Gráficos", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGraficos() }),
          boton("Parámetros", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTabla() }),
        ],
      })
    );
  }

  async function ejecutar() {
    const serie = serieValida(campoDatos, 5);
    if (!serie) return;
    botonCalcular.cargando(true);
    errorHost.replaceChildren();
    try {
      const datos = await api.post("/api/simulacion", { tipo: "ajuste", clave: campoModelo.valor(), datos: campoDatos.texto() });
      resultado = datos;
      renderBarra();
      abrirResultado();
      if (ventanasAbiertas().some((v) => v.id === "sim-grafico")) abrirGraficos({ enfocar: false });
      if (ventanasAbiertas().some((v) => v.id === "sim-tabla")) abrirTabla({ enfocar: false });
      registrarHistorial({ titulo: `Ajuste · ${datos.clave}`, detalle: `AIC ${fmtNum(datos.aic, { decimales: 2 })} · KS p = ${fmtP(datos.p_ks)}`, ruta: "simulacion/ajuste", tipo: "simulacion", icono: "objetivo" });
    } catch (error) {
      if (!esCancelacion(error)) mostrarErrorMotor(errorHost, error, "No se pudo ajustar", { datos: campoDatos });
    } finally {
      botonCalcular.cargando(false);
    }
  }

  botonCalcular.addEventListener("click", ejecutar);
  const nodo = el(
    "div",
    { class: "pila" },
    panel({
      titulo: "Ajustar una distribución",
      subtitulo: "Seis familias con soporte para máxima verosimilitud.",
      icono: "objetivo",
      contenido: el("div", { class: "pila" }, campoModelo.envoltura, campoDatos.envoltura, el("div", { class: "fila" }, botonCalcular)),
    }),
    barraHost,
    errorHost
  );

  if (pendiente?.tipo === "ajuste" && pendiente.datos) setTimeout(ejecutar, 80);
  return { nodo, ejecutar };
}

/* ================================================================== */
/* QQ                                                                 */
/* ================================================================== */

function herramientaQQ(pendiente, metaDatos) {
  let modelo = metaDatos.distribuciones.find((d) => d.clave === (pendiente?.clave || "normal")) || metaDatos.distribuciones[0];
  let parametros = crearCamposParametros(modelo);
  let ultimoEstado = null;

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
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Construir QQ-plot", { icono: "reproducir", dataset: { accionPrimaria: "true" } });

  campoModelo.control.addEventListener("change", () => {
    modelo = metaDatos.distribuciones.find((d) => d.clave === campoModelo.valor()) || modelo;
    parametros = crearCamposParametros(modelo);
    contenedorParametros.replaceChildren(parametros.el);
  });

  function exportar(nodo, formato) {
    if (!ultimoEstado) return Promise.resolve();
    const { datos, modelo: mod, parametrosUsados } = ultimoEstado;
    return exportarSimulacion(nodo, {
      titulo: `QQ-plot · ${mod.nombre}`,
      resumen: datos.nota,
      tablas: [{ nombre: "Cuantiles", columnas: ["Teórico", "Observado"], filas: datos.teoricos.map((v, i) => [v, datos.observados[i]]) }],
      figura: { series: [{ nombre: "Cuantiles", x: datos.teoricos, y: datos.observados, tipo: "dispersion" }], xlabel: "Cuantiles teóricos", ylabel: "Cuantiles observados", titulo: "QQ-plot" },
      estado: { tipo: "qq", clave: mod.clave, parametros: parametrosUsados, datos: campoDatos.texto() },
    }, formato);
  }

  function abrirGrafico({ enfocar = true } = {}) {
    if (!ultimoEstado) return;
    const { datos, modelo: mod } = ultimoEstado;
    const hostGraf = el("div");
    const xs = datos.teoricos;
    const ys = datos.observados;
    const min = Math.min(...xs, ...ys);
    const max = Math.max(...xs, ...ys);
    abrirVentana({
      id: "sim-grafico",
      titulo: `QQ-plot · ${mod.nombre}`,
      tituloCorto: "QQ-plot",
      icono: "dispersion",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("PNG", { variante: "fantasma", pequeno: true, icono: "imagen", onClick: (e) => exportar(e.currentTarget, "png") }),
      ],
      contenido: hostGraf,
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Cuantiles", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: () => abrirTabla() })
      ),
    });
    dibujar(hostGraf, {
      series: [
        { nombre: "Cuantiles", x: xs, y: ys, tipo: "dispersion", color: "var(--grafico-1)" },
        { nombre: "Ajuste perfecto", x: [min, max], y: [min, max], tipo: "linea", color: "var(--grafico-4)" },
      ],
      xlabel: "Cuantiles teóricos",
      ylabel: "Cuantiles observados",
      altura: 320,
      ariaLabel: "QQ-plot de cuantiles observados frente a teóricos",
    });
  }

  function abrirTabla({ enfocar = true } = {}) {
    if (!ultimoEstado) return;
    const { datos, modelo: mod } = ultimoEstado;
    abrirVentana({
      id: "sim-tabla",
      titulo: `Cuantiles · ${mod.nombre}`,
      tituloCorto: "Cuantiles",
      icono: "tabla",
      tipo: "tabla",
      alcance: "vista",
      enfocar,
      contenido: tabla({
        columnas: ["Cuantil teórico", "Cuantil observado"],
        filas: datos.teoricos.map((v, i) => [v, datos.observados[i]]),
        total: datos.teoricos.length,
      }),
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("QQ-plot", { variante: "fantasma", pequeno: true, icono: "dispersion", onClick: () => abrirGrafico() })
      ),
    });
  }

  function abrirResultado({ enfocar = true } = {}) {
    if (!ultimoEstado) return;
    const { datos, modelo: mod, parametrosUsados } = ultimoEstado;
    abrirVentana({
      id: "sim-resultados",
      titulo: `QQ-plot · ${mod.nombre}`,
      tituloCorto: "Resultados QQ",
      subtitulo: datos.nota,
      icono: "dispersion",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
      contenido: el(
        "div",
        { class: "pila" },
        el("div", { class: "rejilla rejilla--kpi" },
          kpi({ etiqueta: "n", valor: fmtNum(datos.n, { entero: true }), detalle: "observaciones", tono: "marca" }),
          kpi({ etiqueta: "Parámetros", valor: String(Object.keys(parametrosUsados).length), detalle: resumenParametros(mod, parametrosUsados) })
        ),
        alerta({ tipo: "info", texto: "Una separación en los extremos puede indicar diferencias entre las colas del modelo y las de los datos." })
      ),
      pie: el(
        "div",
        { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
        el("div", { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
          boton("Ver QQ-plot", { variante: "primario", pequeno: true, icono: "dispersion", onClick: () => abrirGrafico() }),
          boton("Cuantiles", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTabla() }),
          boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("qq_plot", { alcance: "vista" }) })
        ),
        el("div", { class: "fila", style: { gap: "6px" } },
          ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) => exportar(nodo, formato), { variante: "fantasma" })
        )
      ),
    });
  }

  function renderBarra() {
    if (!ultimoEstado) { barraHost.replaceChildren(); return; }
    const { datos, modelo: mod } = ultimoEstado;
    barraHost.replaceChildren(
      barraResultados({
        icono: "dispersion",
        resumen: `QQ-plot · ${mod.nombre} (${datos.n} obs.)`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
          boton("QQ-plot", { variante: "secundario", pequeno: true, icono: "dispersion", onClick: () => abrirGrafico() }),
          boton("Cuantiles", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTabla() }),
        ],
      })
    );
  }

  async function ejecutar() {
    const serie = serieValida(campoDatos, 3);
    if (!serie) return;
    const validacion = parametros.validar();
    if (!validacion.ok) { toast("Revisa los parámetros del modelo", { tipo: "error" }); return; }
    botonCalcular.cargando(true);
    errorHost.replaceChildren();
    const modeloUsado = modelo;
    const parametrosUsados = validacion.valores;
    try {
      const datos = await api.post("/api/simulacion", { tipo: "qq", clave: modeloUsado.clave, parametros: parametrosUsados, datos: campoDatos.texto() });
      ultimoEstado = { datos, modelo: modeloUsado, parametrosUsados };
      renderBarra();
      abrirResultado();
      if (ventanasAbiertas().some((v) => v.id === "sim-grafico")) abrirGrafico({ enfocar: false });
      if (ventanasAbiertas().some((v) => v.id === "sim-tabla")) abrirTabla({ enfocar: false });
      registrarHistorial({ titulo: `QQ-plot · ${modeloUsado.nombre}`, detalle: `${datos.n} observaciones`, ruta: "simulacion/qq", tipo: "simulacion", icono: "dispersion" });
    } catch (error) {
      if (!esCancelacion(error)) mostrarErrorMotor(errorHost, error, "No se pudo construir el QQ-plot", { ...parametros.campos, datos: campoDatos });
    } finally {
      botonCalcular.cargando(false);
    }
  }

  botonCalcular.addEventListener("click", ejecutar);
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
      barraHost,
      errorHost
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
              cerrarVentanasPorAlcance("vista");
              activa = h.clave;
              history.replaceState(null, "", `#/simulacion/${h.clave}`);
              renderSelector();
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
          el("p", { class: "vista__subtitulo" }, VISTAS.simulacion.subtitulo)
        ),
        el(
          "div",
          { class: "vista__acciones" },
          boton("Teoría", {
            variante: "secundario",
            icono: "teoria",
            onClick: () => {
              const info = HERRAMIENTAS.find((h) => h.clave === activa);
              abrirTeoriaVentana(info?.teoria || "montecarlo", { alcance: "vista" });
            },
          })
        )
      ),
      selector,
      contenido
    )
  );

  renderSelector();
  contenido.append(constructores[activa]().nodo);
  pendiente = null;

  return null;
}
