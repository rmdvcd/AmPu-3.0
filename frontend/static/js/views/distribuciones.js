import {
  el,
  panel,
  boton,
  campo,
  kpi,
  badge,
  latex,
  textoMatematico,
  tabla,
  alerta,
  estadoVacio,
  esqueletoPanel,
  anunciar,
  toast,
  copiar,
  conCarga,
  fmtNum,
  fmtPorcentaje,
  renderMath,
  pliegue,
  segmentado,
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

function separarVector(texto) {
  return String(texto || "")
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((v) => Number(v.replace(",", ".")));
}

function formatearValorX(valor) {
  if (Array.isArray(valor)) return valor.join(", ");
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
          texto: error.message,
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

  /* --------------------------- Estructura --------------------------- */

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

  const lista = el("div", { class: "lista-modelos", role: "list" });
  const panelModelos = panel({
    titulo: "Catálogo",
    subtitulo: `${distribuciones.length} modelos disponibles`,
    icono: "distribuciones",
    contenido: el("div", {}, buscador, filtroNodo, lista),
    sinRelleno: true,
    clase: "panel--plano",
  });
  panelModelos.cuerpo.classList.add("panel__cuerpo--estrecho");

  const fichaHost = el("div");
  const formHost = el("div");
  const resultadoHost = el("div", { class: "resultado", "aria-live": "polite" });

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
          el(
            "p",
            { class: "vista__subtitulo" },
            "Elige un modelo, ajusta sus parámetros y lee a la vez la masa o densidad, la acumulada, la cola y los cuantiles. Todo se recalcula al cambiar un dato."
          )
        ),
        el(
          "div",
          { class: "vista__acciones" },
          boton("Ver teoría", {
            variante: "secundario",
            icono: "teoria",
            onClick: () => modelo.teoria && navegar(`teoria/${modelo.teoria}`),
          })
        )
      ),
      el("div", { class: "dividido" }, panelModelos, el("div", { class: "pila" }, fichaHost, formHost, resultadoHost))
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
              role: "listitem",
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

  /* --------------------------- Ficha --------------------------- */

  function renderFicha() {
    const formula = el("div", { class: "formula-card" });
    const etiquetaFormula = modelo.discreta ? "Función de masa (PMF)" : "Función de densidad (PDF)";
    if (modelo.formula) {
      formula.append(el("span", { class: "formula-etiqueta" }, etiquetaFormula));
      const mate = el("div");
      formula.append(mate);
      latex(mate, modelo.formula, { display: true });
    } else {
      formula.append(el("p", { class: "texto-tenue" }, "La lección de este modelo no incluye una fórmula en bloque."));
    }

    const detalles = el("div", { class: "pila pila--sm" });
    if (modelo.ejemplo) {
      detalles.append(
        pliegue({
          titulo: "Ejemplo resuelto",
          icono: "documento",
          contenido: textoMatematico(modelo.ejemplo),
        })
      );
    }
    if (modelo.propiedades) {
      detalles.append(
        pliegue({
          titulo: "Propiedades y casos especiales",
          icono: "info",
          contenido: textoMatematico(modelo.propiedades),
        })
      );
    }

    const nodo = panel({
      titulo: null,
      sinCabecera: true,
      contenido: el(
        "div",
        { class: "modelo-ficha" },
        el(
          "div",
          { class: "modelo-ficha__titulo" },
          el("h2", {}, modelo.nombre),
          badge(modelo.discreta ? "Discreta" : "Continua", modelo.discreta ? "discreta" : "continua"),
          modelo.dimensionalidad !== "univariante"
            ? badge(modelo.dimensionalidad === "bivariante" ? "Bivariante" : "Multivariante", "multivariante")
            : null,
          badge(`${modelo.parametros.length} parámetro${modelo.parametros.length === 1 ? "" : "s"}`)
        ),
        el(
          "div",
          { class: "ficha-acciones" },
          boton("Ver lección", {
            variante: "fantasma",
            pequeno: true,
            icono: "teoria",
            onClick: () => modelo.teoria && navegar(`teoria/${modelo.teoria}`),
            deshabilitado: !modelo.teoria,
          }),
          boton("Copiar enlace", {
            variante: "fantasma",
            pequeno: true,
            icono: "enlace",
            onClick: () => copiar(`${location.origin}${location.pathname}#/distribuciones/${modelo.clave}`),
          }),
          boton("Simular muestra", {
            variante: "fantasma",
            pequeno: true,
            icono: "simulacion",
            onClick: () => {
              transito.simulacion = {
                tipo: "muestra",
                clave: modelo.clave,
                parametros: campos ? campos.valores() : estado.parametros,
                n: 1000,
              };
              navegar("simulacion/muestra");
            },
          })
        ),
        modelo.resumen ? textoMatematico(modelo.resumen) : null,
        formula,
        modelo.dimensionalidad !== "univariante"
          ? alerta({
              tipo: "aviso",
              titulo: "Modelo multivariante",
              texto: "La curva y la tabla resumen la primera marginal. La masa o densidad conjunta se evalúa con el vector completo de x; los momentos son por componente.",
            })
          : null,
        el(
          "div",
          { class: "chips" },
          el("span", { class: "chip" }, `Clave: ${modelo.clave}`),
          modelo.soporte_sugerido
            ? el("span", { class: "chip" }, `Soporte: [${modelo.soporte_sugerido[0]}, ${modelo.soporte_sugerido[1]}]`)
            : null,
          el("span", { class: "chip" }, modelo.discreta ? "PMF / CDF" : "PDF / CDF")
        ),
        detalles
      ),
    });
    fichaHost.replaceChildren(nodo);
    renderMath(nodo);
  }

  /* --------------------------- Formulario --------------------------- */

  function renderFormulario() {
    campos = crearCamposParametros(modelo, {
      valores: estado.parametros,
      onInput: programarAuto,
    });

    const esMultiple = modelo.dimensionalidad !== "univariante";
    campoX = campo({
      etiqueta: "Valor a evaluar",
      codigo: "x",
      tipo: esMultiple ? "texto" : "numero",
      valor: formatearValorX(estado.x),
      ayuda: esMultiple
        ? `Introduce ${dimensionEsperada(modelo)} valores separados por comas.`
        : soporteTexto(modelo) || "Introduce un valor dentro o fuera del soporte; fuera de él la probabilidad es 0.",
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
      ayuda: "Probabilidad entre 0 y 1. q = 0,5 devuelve la mediana.",
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
    rangoQ.addEventListener("input", () => {
      campoQ.setValor(rangoQ.value);
      programarAuto();
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
      ayuda: "Más puntos muestran mejor las colas; el cálculo es igual de exacto.",
      onCambio: programarAuto,
    });

    campoSemilla = campo({
      etiqueta: "Semilla de simulación",
      codigo: "seed",
      tipo: "entero",
      valor: 42,
      min: 0,
      ayuda: "Sólo se usa para dibujar la marginal de modelos multivariantes.",
      onInput: programarAuto,
    });

    const casillaAuto = el("input", { type: "checkbox", id: "auto-calculo", checked: autoActivo });
    casillaAuto.addEventListener("change", () => {
      autoActivo = casillaAuto.checked;
      guardarPrefs({ calculo_automatico: autoActivo });
      if (autoActivo) programarAuto(80);
    });

    const botonCalcular = boton("Calcular", {
      icono: "reproducir",
      tipo: "submit",
      dataset: { accionPrimaria: "true" },
    });
    const botonReset = boton("Restablecer", {
      variante: "fantasma",
      icono: "actualizar",
      onClick: () => {
        guardarEstadoModelo(modelo.clave, {});
        estado = crearEstado(modelo);
        renderFormulario();
        calcular({ forzar: true });
        toast("Parámetros restablecidos", { tipo: "info", duracion: 2200 });
      },
    });

    const identificadorForm = `form-dist-${modelo.clave}`;
    const formulario = el("form", { id: identificadorForm, novalidate: "true" });

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
      rango.lastElementChild.textContent = fmtNum(rangoQ.value, { decimales: 2 });
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
            el("span", {}, el("strong", {}, "Calcular al cambiar"), " los valores")
          )
        )
      )
    );

    formulario.addEventListener("submit", (evento) => {
      evento.preventDefault();
      calcular({ forzar: true });
    });

    const nodo = panel({
      titulo: "Parámetros y consulta",
      subtitulo: modelo.parametros.length
        ? "Los rangos y tipos provienen de la validación del motor."
        : "Este modelo usa la forma estándar, sin parámetros.",
      icono: "ajustes",
      contenido: formulario,
    });
    formHost.replaceChildren(nodo);
  }

  /* --------------------------- Estado y cálculo --------------------------- */

  function programarAuto(espera = 420) {
    clearTimeout(temporizadorAuto);
    if (!autoActivo) {
      persistir();
      return;
    }
    persistir();
    temporizadorAuto = setTimeout(() => {
      // Antes del primer cálculo no validamos en cada tecla: evita errores prematuros.
      if (haCalculado) calcular({ auto: true });
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
      const partes = separarVector(campoX.texto());
      const esperado = dimensionEsperada(modelo);
      if (partes.length !== esperado || partes.some((v) => !Number.isFinite(v))) {
        campoX.setError(`Introduce ${esperado} valores numéricos separados por comas.`);
        campoX.enfocar();
        return { ok: false };
      }
      x = partes;
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
        semilla: Number(campoSemilla.valor()) || 42,
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
    resultadoHost.setAttribute("aria-busy", "true");
    if (!resultado && resultadoHost.childElementCount === 0) esqueletoPanel(resultadoHost, 1);

    try {
      const datosResultado = await api.post("/api/distribucion/calcular", consulta.payload, { senal: controlador.signal });
      resultado = datosResultado;
      haCalculado = true;
      renderResultado();
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
      if (esCancelacion(error)) return;
      if (auto) {
        if (!resultado) renderInicial();
        return;
      }
      mostrarError(error);
    } finally {
      resultadoHost.setAttribute("aria-busy", "false");
      const nodo = host.querySelector("#estado-calculo");
      if (nodo) {
        nodo.replaceChildren(
          el("span", { class: "pulso" }),
          `Actualizado ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
        );
      }
    }
  }

  function mostrarError(error) {
    const mensaje = error instanceof ErrorApi ? error.message : "No se pudo completar el cálculo.";
    const bloque = panel({
      titulo: "No se pudo calcular",
      icono: "alerta",
      contenido: alerta({
        tipo: "error",
        titulo: "Revisa los datos",
        texto: mensaje,
        acciones: [
          boton("Reintentar", {
            variante: "secundario",
            pequeno: true,
            icono: "actualizar",
            onClick: () => calcular({ forzar: true }),
          }),
        ],
      }),
    });
    if (!resultado) resultadoHost.replaceChildren(bloque);
    else {
      const previo = resultadoHost.querySelector(".alerta--error");
      if (previo) previo.remove();
      resultadoHost.prepend(alerta({ tipo: "error", titulo: "El último cálculo falló", texto: mensaje }));
    }
    toast(mensaje, { tipo: "error" });
  }

  /* --------------------------- Resultados --------------------------- */

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
      serie = { nombre: "P(X ≤ x)", x: curva.x, y: curva.acumulada, color: "var(--grafico-2)" };
      ylabel = "Probabilidad acumulada";
      yDomain = [0, 1];
    } else if (vistaGrafico === "cola") {
      serie = { nombre: "P(X ≥ x)", x: curva.x, y: curva.cola, color: "var(--grafico-3)" };
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
      altura: 320,
      yCero: vistaGrafico === "funcion",
      dominioY: yDomain,
      ariaLabel: `Gráfico de ${vistaGrafico} de la distribución ${modelo.nombre}`,
    };
  }

  function renderGrafico(hostGrafico) {
    const cfg = configuracionGrafico();
    if (!cfg) return;
    dibujar(hostGrafico, cfg);
    hostGrafico._cfgActual = cfg;
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
            titulo: `${modelo.nombre} · AmPu 3.1`,
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
        if (!esCancelacion(error)) toast(error.message, { tipo: "error" });
      } finally {
        controladoresExport.delete(controladorLocal);
      }
    };
    if (botonNodo) await conCarga(botonNodo, tarea);
    else await tarea();
  }

  function renderResultado() {
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
            valor: fmtPorcentaje(resultado.intervalo.probabilidad, 2),
            detalle: `a = ${fmtNum(resultado.intervalo.a)}, b = ${fmtNum(resultado.intervalo.b)}`,
            tono: "ok",
          })
        : kpi({
            etiqueta: "Probabilidad de intervalo",
            valor: "—",
            detalle: "Rellena a y b para calcularla",
          })
    );

    const accionesExportar = [
      boton("PNG", { variante: "secundario", pequeno: true, icono: "descargar", onClick: (e) => exportar("png", e.currentTarget) }),
      boton("PDF", { variante: "secundario", pequeno: true, icono: "documento", onClick: (e) => exportar("pdf", e.currentTarget) }),
      boton("Excel", { variante: "secundario", pequeno: true, icono: "tabla", onClick: (e) => exportar("xlsx", e.currentTarget) }),
    ];

    const cabeceraResultado = el(
      "header",
      { class: "panel__cabecera" },
      el(
        "div",
        {},
        el("h2", { class: "panel__titulo" }, icono("objetivo", { tamano: 16 }), "Resultado"),
        el("p", { class: "panel__subtitulo" }, interpretacion)
      ),
      el(
        "div",
        { class: "panel__acciones" },
        boton("Copiar resumen", {
          variante: "fantasma",
          pequeno: true,
          icono: "copiar",
          onClick: () => copiar(resumenTexto()),
        }),
        ...accionesExportar
      )
    );

    const panelResultado = el(
      "section",
      { class: "panel panel--resultado" },
      cabeceraResultado,
      el("div", { class: "panel__cuerpo" }, el("div", { class: "pila" }, kpis, momentos, resultado.nota ? el("p", { class: "aviso-mini" }, icono("info", { tamano: 13 }), resultado.nota) : null))
    );

    const hostGrafico = el("div");
    const controlVista = segmentado({
      etiqueta: "Vista del gráfico",
      valor: vistaGrafico,
      opciones: VISTAS_GRAFICO,
      onCambio: (nuevo) => {
        vistaGrafico = nuevo;
        renderGrafico(hostGrafico);
      },
    });

    const panelGrafico = panel({
      titulo: "Forma de la distribución",
      subtitulo: "Pasa el cursor o usa las flechas del teclado para leer valores exactos.",
      icono: "grafico",
      acciones: controlVista,
      contenido: el("div", {}, hostGrafico),
      pie: el(
        "div",
        { class: "fila fila--entre", style: { width: "100%" } },
        el("span", {}, modelo.discreta ? "Barras: masa P(X = x). Línea: acumulada o cola." : "Área y línea: densidad f(x). La probabilidad se obtiene integrando."),
        el(
          "div",
          { class: "grupo-botones" },
          boton("Enviar a simulación", {
            variante: "fantasma",
            pequeno: true,
            icono: "simulacion",
            onClick: () => {
              transito.simulacion = { tipo: "muestra", clave: modelo.clave, parametros: resultado.parametros, n: 1000 };
              navegar("simulacion/muestra");
            },
          })
        )
      ),
    });

    const tablaActual = tablaResultado();
    const panelTabla = panel({
      titulo: "Datos del cálculo",
      subtitulo: "La tabla completa permite verificar cada punto de la curva.",
      icono: "tabla",
      acciones: [
        boton("CSV", {
          variante: "fantasma",
          pequeno: true,
          icono: "descargar",
          onClick: (e) => exportar("csv", e.currentTarget),
        }),
      ],
      contenido: tabla({
        ...tablaActual,
        titulo: `${modelo.nombre} · tabla`,
        maximo: 420,
        altura: "alta",
      }),
    });

    resultadoHost.replaceChildren(
      el("div", { class: "pila" }, panelResultado, panelGrafico, panelTabla)
    );
    renderGrafico(hostGrafico);
    renderMath(resultadoHost);
  }

  function renderInicial() {
    resultadoHost.replaceChildren(
      panel({
        titulo: "Listo para calcular",
        icono: "chispa",
        contenido: estadoVacio({
          icono: "distribuciones",
          titulo: "Configura el modelo y pulsa Calcular",
          texto: autoActivo
            ? "Con el cálculo automático activo, el resultado aparecerá en cuanto los valores sean válidos."
            : "El cálculo automático está desactivado: pulsa Calcular o usa Ctrl + Enter cuando quieras actualizar.",
        }),
      })
    );
  }

  /* --------------------------- Selección --------------------------- */

  async function seleccionar(nuevaClave, { inicial = false } = {}) {
    if (controlador) controlador.abort();
    persistir();
    clave = nuevaClave;
    modelo = distribucion(clave);
    estado = crearEstado(modelo);
    resultado = null;
    vistaGrafico = "funcion";
    haCalculado = false;
    recordarModelo(clave);
    history.replaceState(null, "", `#/distribuciones/${clave}`);
    renderLista();
    renderFicha();
    renderFormulario();
    renderInicial();
    anunciar(`Modelo ${modelo.nombre} seleccionado.`);
    if (autoActivo) {
      if (inicial) calcular({ auto: true });
      else calcular({ auto: true, forzar: true });
    }
    if (!inicial) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderLista();
  await seleccionar(clave, { inicial: true });

  return () => {
    if (controlador) controlador.abort();
    controladoresExport.forEach((c) => c.abort());
    clearTimeout(temporizadorAuto);
    if (resultadoHost.querySelector(".grafico")) {
      const grafico = resultadoHost.querySelector(".grafico");
      if (grafico?._observadorGrafico) grafico._observadorGrafico.disconnect();
    }
  };
}
