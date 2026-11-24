import { VISTAS } from "../data.js";
import {
  el,
  panel,
  boton,
  campo,
  kpi,
  badge,
  tabla,
  alerta,
  anunciar,
  toast,
  copiar,
  conCarga,
  fmtNum,
  fmtPorcentaje,
  errorEnCampo,
  textoError,
  avisosMotor,
  pliegue,
  segmentado,
  comportamientoScroll,
} from "../ui.js";
import { icono } from "../icons.js";
import { dibujar } from "../chart.js";
import { crearCamposParametros, resumenParametros } from "../params.js";
import {
  cargarMeta,
  distribucion,
  estadoModelo,
  guardarEstadoModelo,
  recordarModelo,
  ultimoModelo,
  guardarPrefs,
  prefs,
  navegar,
  registrarHistorial,
  transito,
} from "../store.js";
import { api, ErrorApi, esCancelacion } from "../api.js";
import { fmtEntrada, leerSerie } from "../entrada.js";
import { abrirVentana, cerrarVentanasPorAlcance, ventanasAbiertas, barraResultados } from "../ventanas.js";
import { abrirTeoriaVentana, abrirFichaModeloVentana } from "../teoria_dialogo.js";

const VISTAS_GRAFICO = [
  ["funcion", "Función"],
  ["acumulada", "Acumulada"],
  ["cola", "Supervivencia"],
];

function normalizar(texto) {
  return String(texto || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function dimensionEsperada(modelo) {
  if (modelo.dimensionalidad === "bivariante") return 2;
  const vector = modelo.parametros.find((p) => p.tipo?.startsWith("vector"));
  return vector?.default?.length || 2;
}

function formatearValorX(valor) {
  if (Array.isArray(valor)) return `(${valor.map((v) => fmtNum(v)).join("; ")})`;
  if (typeof valor === "number") return fmtNum(valor);
  return valor ?? "";
}

function textoCampoX(valor) {
  if (Array.isArray(valor)) return valor.map((v) => (typeof v === "number" ? fmtEntrada(v) : String(v))).join(" ");
  return valor ?? "";
}

function soporteTexto(modelo) {
  if (!modelo.soporte_sugerido) return "";
  const [a, b] = modelo.soporte_sugerido;
  return `Soporte para los parámetros por defecto: [${a}, ${b}]`;
}

function crearEstado(modelo) {
  const guardado = estadoModelo(modelo.clave);
  const parametros = {};
  for (const p of modelo.parametros) {
    const guardadoParam = guardado?.parametros?.[p.nombre];
    parametros[p.nombre] = guardadoParam !== undefined && guardadoParam !== null ? guardadoParam : p.default;
  }
  return {
    parametros,
    x: guardado?.x ?? modelo.x_sugerido ?? (modelo.dimensionalidad === "univariante" ? 0 : []),
    q: guardado?.q ?? 0.5,
    puntos: guardado?.puntos ?? 161,
    intervalo: guardado?.intervalo ?? { a: "", b: "" },
  };
}

export async function montar(host, parametro) {
  let datos;
  try {
    datos = await cargarMeta();
  } catch (error) {
    host.append(
      el(
        "div",
        { class: "vista" },
        alerta({
          tipo: "error",
          titulo: "No se pudieron cargar los modelos",
          texto: textoError(error),
          acciones: [boton("Reintentar", { icono: "actualizar", onClick: () => montar(host, parametro) })],
        })
      )
    );
    return null;
  }

  const distribuciones = datos.distribuciones;
  let clave = distribuciones.some((d) => d.clave === parametro) ? parametro : ultimoModelo();
  if (!distribuciones.some((d) => d.clave === clave)) clave = "normal";
  let modelo = distribucion(clave);
  let estado = crearEstado(modelo);
  let resultado = null;
  let campos = null;
  let campoX = null;
  let campoQ = null;
  let campoA = null;
  let campoB = null;
  let campoPuntos = null;
  let campoSemilla = null;
  let vistaGrafico = "funcion";
  let controlador = null;
  const controladoresExport = new Set();
  let temporizadorAuto = null;
  let autoActivo = prefs.calculo_automatico;
  let haCalculado = false;

  /* --------------------------- Estructura simplificada --------------------------- */

  const buscador = el("div", { class: "lista-busqueda" });
  const entradaBusqueda = el("input", {
    type: "search",
    placeholder: "Buscar modelo…",
    "aria-label": "Buscar modelo de distribución",
  });
  buscador.append(icono("buscar", { tamano: 15 }), entradaBusqueda);

  let filtro = "todas";
  const filtroNodo = segmentado({
    etiqueta: "Filtrar modelos",
    valor: filtro,
    opciones: [
      ["todas", "Todas"],
      ["discretas", "Discretas"],
      ["continuas", "Continuas"],
      ["multivariadas", "Múltiples"],
    ],
    onCambio: (nuevo) => {
      filtro = nuevo;
      renderLista();
    },
  });

  const lista = el("div", { class: "lista-modelos", role: "group", "aria-label": "Modelos de distribución" });
  const panelModelos = panel({
    titulo: "Catálogo",
    subtitulo: `${distribuciones.length} modelos disponibles`,
    icono: "distribuciones",
    contenido: el("div", {}, buscador, filtroNodo, lista),
    sinRelleno: true,
    clase: "panel--plano",
  });
  panelModelos.cuerpo.classList.add("panel__cuerpo--estrecho");

  const formHost = el("div");
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });

  const botonTeoriaCabecera = boton("Ver teoría", {
    variante: "secundario",
    icono: "teoria",
    onClick: () => modelo.teoria && abrirTeoriaVentana(modelo.teoria, { alcance: "vista" }),
  });

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
          el("span", { class: "ceja" }, "Explorar · Distribuciones"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("distribuciones", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Laboratorio de distribuciones")
          ),
          el("p", { class: "vista__subtitulo" }, VISTAS.distribuciones.subtitulo)
        ),
        el("div", { class: "vista__acciones" }, botonTeoriaCabecera)
      ),
      el("div", { class: "dividido" }, panelModelos, el("div", { class: "pila" }, formHost, barraHost, errorHost))
    )
  );

  /* --------------------------- Lista --------------------------- */

  function renderLista() {
    lista.replaceChildren();
    const consulta = normalizar(entradaBusqueda.value);
    let filtradas = distribuciones.filter((d) => {
      if (!consulta) return true;
      return normalizar(`${d.nombre} ${d.clave} ${d.resumen}`).includes(consulta);
    });
    if (filtro === "discretas") filtradas = filtradas.filter((d) => d.discreta);
    else if (filtro === "continuas") filtradas = filtradas.filter((d) => !d.discreta);
    else if (filtro === "multivariadas") filtradas = filtradas.filter((d) => d.dimensionalidad !== "univariante");

    if (!filtradas.length) {
      lista.append(el("p", { class: "tabla-vacia" }, "Ningún modelo coincide con la búsqueda."));
      return;
    }
    const grupos = [
      { titulo: "Discretas", items: filtradas.filter((d) => d.discreta) },
      { titulo: "Continuas", items: filtradas.filter((d) => !d.discreta) },
    ];
    for (const grupo of grupos) {
      if (!grupo.items.length) continue;
      lista.append(el("p", { class: "modelo-grupo__titulo" }, grupo.titulo));
      for (const d of grupo.items) {
        lista.append(
          el(
            "button",
            {
              class: "modelo-item",
              type: "button",
              "aria-pressed": String(d.clave === clave),
              onClick: () => seleccionar(d.clave),
              title: `${d.nombre} · ${d.clave}`,
            },
            el("span", { class: "modelo-item__nombre" }, d.nombre),
            d.dimensionalidad !== "univariante" ? badge("M", "multivariante") : null,
            el("span", { class: "modelo-item__tipo" }, d.discreta ? "D" : "C")
          )
        );
      }
    }
  }

  entradaBusqueda.addEventListener("input", renderLista);

  /* --------------------------- Ficha en ventana --------------------------- */

  function abrirFicha() {
    abrirFichaModeloVentana(modelo, {
      alcance: "vista",
      alAbrirTeoria: (teoriaClave) => abrirTeoriaVentana(teoriaClave, { alcance: "vista" }),
      alSimular: () => {
        transito.simulacion = {
          tipo: "muestra",
          clave: modelo.clave,
          parametros: campos ? campos.valores() : estado.parametros,
          n: 1000,
        };
        navegar("simulacion/muestra");
      },
    });
  }

  /* --------------------------- Formulario directo --------------------------- */

  function renderFormulario() {
    campos = crearCamposParametros(modelo, {
      valores: estado.parametros,
      onInput: programarAuto,
    });

    const esMultiple = modelo.dimensionalidad !== "univariante";
    campoX = campo({
      etiqueta: "Valor a evaluar",
      codigo: "x",
      tipo: esMultiple ? "serie" : "numero",
      filas: 1,
      nombre: "x",
      valor: textoCampoX(estado.x),
      ayuda: esMultiple
        ? `Introduce ${dimensionEsperada(modelo)} valores separados por espacios.`
        : soporteTexto(modelo) || "Introduce un valor dentro o fuera del soporte.",
      requerido: true,
      onInput: programarAuto,
    });

    campoQ = campo({
      etiqueta: "Cuantil q",
      codigo: "q",
      tipo: "numero",
      valor: estado.q,
      min: 0,
      max: 1,
      ayuda: "Probabilidad entre 0 y 1 (0,5 = mediana).",
      onInput: () => {
        const v = campoQ.valor();
        if (typeof v === "number" && v >= 0 && v <= 1) rangoQ.value = String(v);
        programarAuto();
      },
    });

    const rangoQ = el("input", {
      type: "range",
      min: "0",
      max: "1",
      step: "0.01",
      value: String(estado.q ?? 0.5),
      "aria-label": "Ajustar el cuantil q",
    });

    campoA = campo({
      etiqueta: "Intervalo desde a",
      codigo: "a",
      tipo: "numero",
      valor: estado.intervalo?.a ?? "",
      opcional: true,
      ayuda: "Opcional. Rellena a y b para obtener P(a ≤ X ≤ b).",
      onInput: programarAuto,
    });
    campoB = campo({
      etiqueta: "Intervalo hasta b",
      codigo: "b",
      tipo: "numero",
      valor: estado.intervalo?.b ?? "",
      opcional: true,
      onInput: programarAuto,
    });

    campoPuntos = campo({
      etiqueta: "Resolución del gráfico",
      tipo: "select",
      valor: String(estado.puntos ?? 161),
      opciones: [["81", "81 puntos"], ["161", "161 puntos"], ["241", "241 puntos"], ["401", "401 puntos"]],
      onCambio: programarAuto,
    });

    campoSemilla = campo({
      etiqueta: "Semilla de simulación",
      codigo: "seed",
      tipo: "entero",
      valor: 42,
      min: 0,
      ayuda: "Para la marginal en modelos multivariantes.",
      onInput: programarAuto,
    });

    const casillaAuto = el("input", { type: "checkbox", id: "auto-calculo", checked: autoActivo });
    casillaAuto.addEventListener("change", () => {
      autoActivo = casillaAuto.checked;
      guardarPrefs({ calculo_automatico: autoActivo });
      if (autoActivo && haCalculado) programarAuto(80);
    });

    const botonCalcular = boton("Calcular", {
      icono: "reproducir",
      tipo: "submit",
      dataset: { accionPrimaria: "true" },
    });
    const botonReset = boton("Restablecer", {
      variante: "fantasma",
      icono: "restablecer",
      onClick: () => {
        guardarEstadoModelo(modelo.clave, {});
        estado = crearEstado(modelo);
        renderFormulario();
        if (haCalculado) calcular({ forzar: true });
        toast("Parámetros restablecidos", { tipo: "info", duracion: 2200 });
      },
    });

    const formulario = el("form", { id: `form-dist-${modelo.clave}`, novalidate: "true" });

    const consulta = el(
      "div",
      { class: "columnas-formulario" },
      campoX.envoltura,
      campoQ.envoltura,
      campoPuntos.envoltura
    );
    const rango = el(
      "div",
      { class: "rango-fila", style: { marginTop: "-4px" } },
      rangoQ,
      el("span", { class: "rango-valor" }, fmtNum(estado.q ?? 0.5, { decimales: 2 }))
    );
    rangoQ.addEventListener("input", () => {
      campoQ.setValor(rangoQ.value);
      rango.lastElementChild.textContent = fmtNum(rangoQ.value, { decimales: 2 });
      programarAuto();
    });

    formulario.append(
      el(
        "div",
        { class: "pila" },
        el("div", { class: "pila pila--sm" }, campos.el),
        consulta,
        rango,
        modelo.dimensionalidad === "univariante"
          ? pliegue({
              titulo: "Probabilidad de un intervalo (opcional)",
              icono: "sigma",
              contenido: el("div", { class: "columnas-formulario" }, campoA.envoltura, campoB.envoltura),
            })
          : null,
        pliegue({
          titulo: "Opciones avanzadas",
          icono: "ajustes",
          contenido: el("div", { class: "columnas-formulario" }, campoSemilla.envoltura),
        }),
        el(
          "div",
          { class: "fila fila--entre", style: { marginTop: "4px" } },
          el(
            "div",
            { class: "fila", style: { gap: "12px" } },
            botonCalcular,
            botonReset,
            el("span", { class: "calculando", id: "estado-calculo", role: "status", "aria-live": "polite" })
          ),
          el(
            "label",
            { class: "casilla", for: "auto-calculo" },
            casillaAuto,
            el("span", {}, el("strong", {}, "Calcular al cambiar"))
          )
        )
      )
    );

    formulario.addEventListener("submit", (evento) => {
      evento.preventDefault();
      calcular({ forzar: true });
    });

    const accionesCabecera = [
      badge(modelo.discreta ? "Discreta" : "Continua", modelo.discreta ? "discreta" : "continua"),
      boton("Fórmula y ejemplo", {
        variante: "secundario",
        pequeno: true,
        icono: "ejemplo",
        onClick: abrirFicha,
      }),
      modelo.teoria
        ? boton("Teoría", {
            variante: "fantasma",
            pequeno: true,
            icono: "teoria",
            onClick: () => abrirTeoriaVentana(modelo.teoria, { alcance: "vista" }),
          })
        : null,
    ].filter(Boolean);

    const nodo = panel({
      titulo: modelo.nombre,
      subtitulo: modelo.soporte_sugerido
        ? `Soporte: [${modelo.soporte_sugerido[0]}, ${modelo.soporte_sugerido[1]}]`
        : "Introduce los parámetros y pulsa Calcular para ver los resultados en una ventana emergente.",
      icono: "distribuciones",
      acciones: accionesCabecera,
      contenido: formulario,
    });
    formHost.replaceChildren(nodo);
  }

  /* --------------------------- Estado y cálculo --------------------------- */

  function programarAuto(espera = 420) {
    clearTimeout(temporizadorAuto);
    persistir();
    if (!autoActivo || !haCalculado) return;
    temporizadorAuto = setTimeout(() => {
      calcular({ auto: true });
    }, espera);
  }

  function persistir() {
    if (!campos) return;
    guardarEstadoModelo(clave, {
      parametros: campos.valores(),
      x: campoX.texto(),
      q: campoQ.valor(),
      puntos: Number(campoPuntos.valor()),
      intervalo: { a: campoA.texto(), b: campoB.texto() },
    });
  }

  function leerConsulta() {
    const revision = campos.validar();
    if (!revision.ok) return { ok: false };

    let x;
    if (modelo.dimensionalidad === "univariante") {
      const valor = campoX.valor();
      if (valor === null || valor === "" || typeof valor !== "number") {
        campoX.setError("Introduce un valor numérico para x.");
        campoX.enfocar();
        return { ok: false };
      }
      x = valor;
    } else {
      const lectura = leerSerie(campoX.texto());
      const esperado = dimensionEsperada(modelo);
      if (lectura.error) {
        campoX.setError(lectura.error.mensaje);
        campoX.enfocar();
        return { ok: false };
      }
      if (lectura.valores.length !== esperado) {
        campoX.setError(`Hacen falta ${esperado} valores separados por espacios (se han leído ${lectura.valores.length}).`);
        campoX.enfocar();
        return { ok: false };
      }
      x = lectura.valores;
    }

    const q = campoQ.valor();
    if (typeof q !== "number" || q < 0 || q > 1) {
      campoQ.setError("El cuantil q debe estar entre 0 y 1.");
      campoQ.enfocar();
      return { ok: false };
    }

    const aTexto = campoA.texto();
    const bTexto = campoB.texto();
    let intervalo = null;
    if (aTexto || bTexto) {
      if (!aTexto || !bTexto) {
        (aTexto ? campoB : campoA).setError("Completa ambos extremos o deja los dos vacíos.");
        (aTexto ? campoB : campoA).enfocar();
        return { ok: false };
      }
      const a = campoA.valor();
      const b = campoB.valor();
      if (typeof a !== "number" || typeof b !== "number" || a > b) {
        campoA.setError("Necesito dos números con a ≤ b.");
        campoA.enfocar();
        return { ok: false };
      }
      intervalo = { a, b };
    }

    return {
      ok: true,
      payload: {
        clave: modelo.clave,
        parametros: revision.valores,
        x,
        q,
        puntos: Number(campoPuntos.valor()) || 161,
        semilla: Number.isInteger(campoSemilla.valor()) ? campoSemilla.valor() : 42,
        intervalo,
      },
    };
  }

  async function calcular({ auto = false, forzar = false } = {}) {
    const consulta = leerConsulta();
    if (!consulta.ok) return;
    if (controlador) controlador.abort();
    controlador = new AbortController();
    const estadoNodo = host.querySelector("#estado-calculo");
    if (estadoNodo) {
      estadoNodo.replaceChildren(el("span", { class: "pulso" }), "Calculando…");
    }
    let estadoFinal = "ok";

    try {
      const datosResultado = await api.post("/api/distribucion/calcular", consulta.payload, { senal: controlador.signal });
      resultado = datosResultado;
      haCalculado = true;
      errorHost.replaceChildren();
      renderBarraResultados();
      abrirResultadosVentana({ enfocar: !auto });
      if (ventanasAbiertas().some((v) => v.id === "dist-grafico")) abrirGraficoVentana({ enfocar: false });
      if (ventanasAbiertas().some((v) => v.id === "dist-tabla")) abrirTablaVentana({ enfocar: false });
      persistir();
      registrarHistorial({
        titulo: `${modelo.nombre} · x = ${formatearValorX(consulta.payload.x)}`,
        detalle: `${datosResultado.resumen.densidad.etiqueta} = ${fmtNum(datosResultado.resumen.densidad.valor, { decimales: 6 })} · q = ${fmtNum(consulta.payload.q, { decimales: 2 })}`,
        ruta: `distribuciones/${modelo.clave}`,
        tipo: "distribucion",
        icono: "distribuciones",
      });
      anunciar(`Resultado actualizado para ${modelo.nombre}.`);
    } catch (error) {
      if (esCancelacion(error)) {
        estadoFinal = "cancelado";
        return;
      }
      estadoFinal = "error";
      mostrarError(error, { silencioso: auto });
    } finally {
      const nodo = host.querySelector("#estado-calculo");
      if (nodo && estadoFinal === "ok") {
        nodo.replaceChildren(
          el("span", { class: "pulso" }),
          `Actualizado ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
        );
      } else if (nodo && estadoFinal === "error") {
        nodo.replaceChildren(icono("alerta", { tamano: 13 }), resultado ? "Sin actualizar" : "No se pudo calcular");
      } else if (nodo) {
        nodo.replaceChildren();
      }
    }
  }

  function mostrarError(error, { silencioso = false } = {}) {
    const mensaje = error instanceof ErrorApi ? textoError(error) : "No se pudo completar el cálculo.";
    const enCampo =
      error instanceof ErrorApi &&
      errorEnCampo(error, { ...(campos?.campos || {}), x: campoX, q: campoQ, a: campoA, b: campoB, intervalo: campoA, semilla: campoSemilla, puntos: campoPuntos });
    const titulo = error?.tipo === "timeout" ? "El cálculo tardó demasiado" : enCampo ? "Revisa el campo marcado" : "Revisa los datos";
    errorHost.replaceChildren(
      alerta({
        tipo: "error",
        titulo,
        texto: mensaje,
        acciones: [
          boton("Reintentar", {
            variante: "secundario",
            pequeno: true,
            icono: "actualizar",
            onClick: () => calcular({ forzar: true }),
          }),
        ],
      })
    );
    if (silencioso) anunciar(`Error: ${error.message}`);
    else toast(mensaje, { tipo: "error" });
  }

  /* --------------------------- Ventanas de resultados --------------------------- */

  function resumenTexto(resultadoActual = resultado) {
    if (!resultadoActual) return "";
    const r = resultadoActual.resumen;
    const p = r.densidad;
    const partes = [
      `${modelo.nombre}`,
      `Parámetros: ${resumenParametros(modelo, resultadoActual.parametros)}`,
      `x = ${formatearValorX(resultadoActual.x)}`,
      `${p.etiqueta} = ${fmtNum(p.valor, { decimales: 8 })}`,
      `P(X ≤ x) = ${fmtNum(r.acumulada.valor, { decimales: 8 })}`,
      r.cola ? `P(X ≥ x) = ${fmtNum(r.cola.valor, { decimales: 8 })}` : "",
      `Cuantil q=${fmtNum(resultadoActual.q, { decimales: 3 })}: ${fmtNum(r.cuantil.valor, { decimales: 8 })}`,
      `Media = ${fmtNum(r.media, { decimales: 8 })}`,
      `Varianza = ${fmtNum(r.varianza, { decimales: 8 })}`,
      `Desviación = ${fmtNum(r.desviacion, { decimales: 8 })}`,
      resultadoActual.intervalo ? `${resultadoActual.intervalo.etiqueta} = ${fmtNum(resultadoActual.intervalo.probabilidad, { decimales: 8 })}` : "",
    ];
    return partes.filter(Boolean).join("\n");
  }

  function configuracionGrafico() {
    if (!resultado) return null;
    const curva = resultado.curva;
    const esDiscreta = resultado.discreta;
    const multiple = resultado.marginal;
    let serie;
    let ylabel;
    let yDomain = null;

    if (vistaGrafico === "acumulada") {
      serie = { nombre: "P(X ≤ x)", x: curva.x, y: curva.acumulada, color: "var(--grafico-2)", escalon: esDiscreta, trazo: "" };
      ylabel = "Probabilidad acumulada";
      yDomain = [0, 1];
    } else if (vistaGrafico === "cola") {
      serie = { nombre: "P(X ≥ x)", x: curva.x, y: curva.cola, color: "var(--grafico-3)", escalon: esDiscreta, trazo: "" };
      ylabel = "Probabilidad de cola";
      yDomain = [0, 1];
    } else {
      const nombre = esDiscreta ? "P(X = x)" : "f(x)";
      serie = {
        nombre: multiple ? "Marginal simulada" : nombre,
        x: curva.x,
        y: curva.y,
        color: "var(--grafico-1)",
        tipo: esDiscreta ? "barra" : "linea",
        relleno: !esDiscreta,
        trazo: "",
      };
      ylabel = nombre;
    }

    return {
      series: [serie],
      marcador:
        modelo.dimensionalidad === "univariante" && vistaGrafico === "funcion"
          ? { x: Number(resultado.x), etiqueta: `x = ${fmtNum(resultado.x, { decimales: 4 })}` }
          : modelo.dimensionalidad === "univariante" && vistaGrafico === "acumulada"
            ? { x: Number(resultado.x), etiqueta: `F(x) = ${fmtNum(resultado.resumen.acumulada.valor, { decimales: 4 })}` }
            : null,
      xlabel: "x",
      ylabel,
      titulo: `${modelo.nombre} · ${vistaGrafico === "funcion" ? (esDiscreta ? "masa" : "densidad") : vistaGrafico}`,
      altura: 340,
      yCero: vistaGrafico === "funcion",
      dominioY: yDomain,
      ariaLabel: `Gráfico de ${vistaGrafico} de la distribución ${modelo.nombre}`,
    };
  }

  function tablaResultado() {
    if (!resultado) return { columnas: [], filas: [] };
    const original = resultado.tabla;
    const permitidas = original.columnas.filter((c) => c === "x" || c.includes("P(X") || c === "f(x)");
    const indices = permitidas.map((c) => original.columnas.indexOf(c));
    return {
      columnas: permitidas,
      filas: original.filas.map((fila) => indices.map((i) => fila[i])),
      total: original.total,
      truncada: original.truncada,
    };
  }

  async function exportar(formato, botonNodo = null) {
    if (!resultado) return;
    const cfg = configuracionGrafico();
    const tablaActual = tablaResultado();
    const controladorLocal = new AbortController();
    controladoresExport.add(controladorLocal);
    const tarea = async () => {
      try {
        await api.exportar(
          {
            formato,
            titulo: `${modelo.nombre} · AmPu 3.2`,
            resumen: `${resumenTexto()}\n\n${resultado.nota || ""}`,
            tablas: [{ nombre: "Resultado", ...tablaActual }],
            figura: cfg
              ? {
                  series: cfg.series.map((s) => ({ nombre: s.nombre, x: s.x, y: s.y, tipo: s.tipo === "barra" ? "barra" : "linea", relleno: s.relleno })),
                  marcador: cfg.marcador?.x ?? null,
                  xlabel: cfg.xlabel,
                  ylabel: cfg.ylabel,
                  titulo: cfg.titulo,
                }
              : null,
            formula: modelo.formula,
            vista: "distribuciones",
            estado: { clave: modelo.clave, parametros: resultado.parametros, x: resultado.x, q: resultado.q },
          },
          { senal: controladorLocal.signal }
        );
        toast(`Archivo ${formato.toUpperCase()} generado`, { tipo: "ok" });
      } catch (error) {
        if (!esCancelacion(error)) toast(textoError(error), { tipo: "error" });
      } finally {
        controladoresExport.delete(controladorLocal);
      }
    };
    if (botonNodo) await conCarga(botonNodo, tarea);
    else await tarea();
  }

  function abrirGraficoVentana({ enfocar = true } = {}) {
    if (!resultado) return;
    const hostGrafico = el("div");
    const controlVista = segmentado({
      etiqueta: "Vista del gráfico",
      valor: vistaGrafico,
      opciones: VISTAS_GRAFICO,
      onCambio: (nuevo) => {
        vistaGrafico = nuevo;
        const cfg = configuracionGrafico();
        if (cfg) dibujar(hostGrafico, cfg);
      },
    });
    const nota = el(
      "p",
      { class: "texto-tenue texto-pequeno" },
      modelo.discreta
        ? "Barras: masa P(X = x). Línea: acumulada o supervivencia."
        : "Área y línea: densidad f(x). La probabilidad se obtiene integrando."
    );

    abrirVentana({
      id: "dist-grafico",
      titulo: `Gráfico · ${modelo.nombre}`,
      tituloCorto: "Gráfico",
      subtitulo: "Pasa el cursor o usa las flechas del teclado para leer valores exactos",
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("PNG", { variante: "fantasma", pequeno: true, icono: "imagen", onClick: (e) => exportar("png", e.currentTarget) }),
      ],
      contenido: el("div", { class: "pila" }, controlVista, hostGrafico, nota),
      pie: el(
        "div",
        { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
        el(
          "div",
          { class: "fila", style: { gap: "6px" } },
          boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana() }),
          boton("Tabla", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: () => abrirTablaVentana() })
        ),
        boton("Simular muestra", {
          variante: "secundario",
          pequeno: true,
          icono: "simulacion",
          onClick: () => {
            transito.simulacion = { tipo: "muestra", clave: modelo.clave, parametros: resultado.parametros, n: 1000 };
            navegar("simulacion/muestra");
          },
        })
      ),
    });

    const cfg = configuracionGrafico();
    if (cfg) dibujar(hostGrafico, cfg);
  }

  function abrirTablaVentana({ enfocar = true } = {}) {
    if (!resultado) return;
    const tablaActual = tablaResultado();
    abrirVentana({
      id: "dist-tabla",
      titulo: `Tabla · ${modelo.nombre}`,
      tituloCorto: "Tabla",
      subtitulo: "Puntos evaluados de la distribución",
      icono: "tabla",
      tipo: "tabla",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("CSV", { variante: "fantasma", pequeno: true, icono: "descargar", onClick: (e) => exportar("csv", e.currentTarget) }),
        boton("Excel", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: (e) => exportar("xlsx", e.currentTarget) }),
      ],
      contenido: tabla({
        ...tablaActual,
        titulo: `${modelo.nombre} · tabla`,
        maximo: 420,
        altura: "alta",
      }),
      pie: el(
        "div",
        { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana() }),
        boton("Gráfico", { variante: "fantasma", pequeno: true, icono: "grafico", onClick: () => abrirGraficoVentana() })
      ),
    });
  }

  function abrirResultadosVentana({ enfocar = true } = {}) {
    if (!resultado) return;
    const r = resultado.resumen;
    const p = r.densidad;
    const interpretacion = r.percentil !== null && typeof r.percentil === "number"
      ? `El valor x = ${formatearValorX(resultado.x)} deja por debajo el ${fmtPorcentaje(r.percentil)} de la distribución.`
      : "El valor x se evalúa directamente en el modelo; revisa el soporte si la probabilidad es cero.";

    const kpis = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: p.etiqueta, valor: fmtNum(p.valor, { decimales: 6 }), detalle: "valor puntual", tono: "marca", icono: "distribuciones" }),
      kpi({ etiqueta: "P(X ≤ x)", valor: fmtNum(r.acumulada.valor, { decimales: 6 }), detalle: "función acumulada", icono: "grafico" }),
      r.cola ? kpi({ etiqueta: "P(X ≥ x)", valor: fmtNum(r.cola.valor, { decimales: 6 }), detalle: "cola superior", icono: "sigma" }) : null,
      kpi({ etiqueta: `Cuantil q = ${fmtNum(resultado.q, { decimales: 2 })}`, valor: fmtNum(r.cuantil.valor, { decimales: 6 }), detalle: "inversa de la CDF", icono: "flecha-derecha" })
    );

    const momentos = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: "Media", valor: fmtNum(r.media, { decimales: 5 }), detalle: "E[X]" }),
      kpi({ etiqueta: "Varianza", valor: fmtNum(r.varianza, { decimales: 5 }), detalle: "Var(X)" }),
      kpi({ etiqueta: "Desviación", valor: fmtNum(r.desviacion, { decimales: 5 }), detalle: "σ" }),
      resultado.intervalo
        ? kpi({
            etiqueta: resultado.intervalo.etiqueta,
            valor: fmtNum(resultado.intervalo.probabilidad, { decimales: 6 }),
            detalle: `${fmtPorcentaje(resultado.intervalo.probabilidad, 2)} · a = ${fmtNum(resultado.intervalo.a)}, b = ${fmtNum(resultado.intervalo.b)}`,
            tono: "ok",
          })
        : kpi({ etiqueta: "Intervalo", valor: "—", detalle: "Rellena a y b para calcularlo" })
    );

    const cuerpo = el(
      "div",
      { class: "pila" },
      alerta({ tipo: "info", texto: interpretacion }),
      kpis,
      momentos,
      avisosMotor(resultado.avisos),
      resultado.nota ? el("p", { class: "aviso-mini" }, icono("info", { tamano: 13 }), resultado.nota) : null
    );

    const pie = el(
      "div",
      { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
      el(
        "div",
        { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
        boton("Ver gráfico", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGraficoVentana() }),
        boton("Ver tabla", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTablaVentana() }),
        boton("Fórmula y ejemplo", { variante: "secundario", pequeno: true, icono: "ejemplo", onClick: abrirFicha }),
        modelo.teoria
          ? boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana(modelo.teoria, { alcance: "vista" }) })
          : null
      ),
      el(
        "div",
        { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
        boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(resumenTexto()) }),
        boton("PNG", { variante: "fantasma", pequeno: true, icono: "imagen", onClick: (e) => exportar("png", e.currentTarget) }),
        boton("PDF", { variante: "fantasma", pequeno: true, icono: "documento", onClick: (e) => exportar("pdf", e.currentTarget) }),
        boton("Excel", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: (e) => exportar("xlsx", e.currentTarget) })
      )
    );

    abrirVentana({
      id: "dist-resultados",
      titulo: `Resultado · ${modelo.nombre}`,
      tituloCorto: `Resultado · ${modelo.nombre}`,
      subtitulo: resumenParametros(modelo, resultado.parametros),
      icono: "objetivo",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
      contenido: cuerpo,
      pie,
    });
  }

  function renderBarraResultados() {
    if (!resultado) {
      barraHost.replaceChildren();
      return;
    }
    const p = resultado.resumen.densidad;
    barraHost.replaceChildren(
      barraResultados({
        icono: "objetivo",
        resumen: `${modelo.nombre} · ${p.etiqueta} = ${fmtNum(p.valor, { decimales: 4 })} · P(X ≤ x) = ${fmtNum(resultado.resumen.acumulada.valor, { decimales: 4 })}`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana() }),
          boton("Gráfico", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGraficoVentana() }),
          boton("Tabla", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTablaVentana() }),
          boton("Fórmula y ejemplo", { variante: "fantasma", pequeno: true, icono: "ejemplo", onClick: abrirFicha }),
        ],
      })
    );
  }

  /* --------------------------- Selección --------------------------- */

  async function seleccionar(nuevaClave, { inicial = false } = {}) {
    if (controlador) controlador.abort();
    if (!inicial) cerrarVentanasPorAlcance("vista");
    persistir();
    clave = nuevaClave;
    modelo = distribucion(clave);
    estado = crearEstado(modelo);
    resultado = null;
    vistaGrafico = "funcion";
    haCalculado = false;
    botonTeoriaCabecera.disabled = !modelo.teoria;
    recordarModelo(clave);
    history.replaceState(null, "", `#/distribuciones/${clave}`);
    errorHost.replaceChildren();
    renderLista();
    renderFormulario();
    renderBarraResultados();
    anunciar(`Modelo ${modelo.nombre} seleccionado.`);
    if (!inicial) window.scrollTo({ top: 0, behavior: comportamientoScroll() });
  }

  renderLista();
  await seleccionar(clave, { inicial: true });

  return () => {
    if (controlador) controlador.abort();
    controladoresExport.forEach((c) => c.abort());
    clearTimeout(temporizadorAuto);
  };
}
