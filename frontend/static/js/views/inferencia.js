import {
  el,
  panel,
  boton,
  campo,
  kpi,
  badge,
  tabla,
  alerta,
  estadoVacio,
  toast,
  copiar,
  conCarga,
  fmtNum,
  fmtP,
  fmtPorcentaje,
  segmentado,
  renderMath,
  latex,
  pliegue,
  anunciar,
} from "../ui.js";
import { icono } from "../icons.js";
import { dibujar } from "../chart.js";
import { api, esCancelacion } from "../api.js";
import { cargarMeta, leccion, navegar, registrarHistorial, transito } from "../store.js";

const EJEMPLOS_PRUEBA = {
  t_una: { datos: "12.4 11.8 13.1 12.9 12.2 12.7 12.5 11.9 12.8 12.3", mu0: 12 },
  z_una: { datos: "10.1 9.8 10.4 9.9 10.2 10.3 9.7 10.5", mu0: 10, sigma: 0.6 },
  t_dos: {
    datos: "12 13 11 14 12 13 12.5 11.5 13.5 12.2",
    datos2: "15 16 14 15 17 16 15.5 14.8 16.2 15.1",
  },
  z_dos: {
    datos: "12 13 11 14 12 13 12.5 11.5",
    datos2: "15 16 14 15 17 16 15.5 14.8",
    sigma_a: 1.2,
    sigma_b: 1.4,
  },
  prop_una: { exitos: 48, n: 100, p0: 0.4 },
  prop_dos: { x1: 45, n1: 100, x2: 34, n2: 100 },
  chi_indep: { tabla: "42 28 30\n18 32 40" },
  chi_bondad: { observadas: "18 22 29 31", esperadas: "25 25 25 25", parametros_estimados: 0 },
  anova: { grupos: "10 12 11 13 12\n14 15 13 16 15\n9 11 10 12 10" },
  correlacion: { x: "1 2 3 4 5 6 7 8", y: "2.1 2.9 4.2 4.8 6.1 6.9 8.2 8.8", metodo: "pearson" },
  mann_whitney: { datos: "12 13 11 14 12 13", datos2: "15 16 14 15 17 16" },
  wilcoxon: { datos: "120 118 131 129 122 127", datos2: "115 116 128 125 120 122" },
  kruskal: { grupos: "10 12 11 13 12\n14 15 13 16 15\n9 11 10 12 10" },
};

const GRUPOS = ["Medias", "Proporciones", "Asociación", "No paramétricas"];

function normalizar(texto) {
  return String(texto || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function valorTexto(valor) {
  if (Array.isArray(valor)) return valor.join("\n");
  if (valor === null || valor === undefined) return "";
  return String(valor);
}

function interpretarEfecto(extras) {
  if (extras.d_cohen !== undefined && extras.d_cohen !== null) {
    const d = Math.abs(extras.d_cohen);
    const magnitud = d >= 0.8 ? "grande" : d >= 0.5 ? "moderado" : d >= 0.2 ? "pequeño" : "despreciable";
    return `d de Cohen = ${fmtNum(extras.d_cohen)}: efecto ${magnitud}.`;
  }
  if (extras.eta2 !== undefined && extras.eta2 !== null) {
    const e = extras.eta2;
    const magnitud = e >= 0.14 ? "grande" : e >= 0.06 ? "moderado" : "pequeño";
    return `η² = ${fmtNum(e)}: proporción de variabilidad explicada ${magnitud}.`;
  }
  if (extras.r !== undefined && extras.r !== null) {
    const r = Math.abs(extras.r);
    const magnitud = r >= 0.7 ? "fuerte" : r >= 0.4 ? "moderada" : r >= 0.2 ? "débil" : "muy débil";
    return `r = ${fmtNum(extras.r)}: asociación lineal ${magnitud}.`;
  }
  return null;
}

function filasExtras(extras) {
  const etiquetas = [
    ["d_cohen", "d de Cohen"],
    ["eta2", "η² (varianza explicada)"],
    ["r", "Correlación r"],
    ["r2", "R²"],
    ["n", "Tamaño de muestra"],
    ["n1", "Tamaño del grupo 1"],
    ["n2", "Tamaño del grupo 2"],
    ["media_muestral", "Media muestral"],
    ["medias", "Medias de los grupos"],
    ["proporcion", "Proporción observada"],
    ["proporciones", "Proporciones observadas"],
    ["k", "Número de grupos"],
  ];
  const filas = [];
  for (const [clave, etiqueta] of etiquetas) {
    if (extras[clave] === undefined || extras[clave] === null) continue;
    let valor = extras[clave];
    if (Array.isArray(valor)) valor = valor.map((v) => fmtNum(v)).join(" · ");
    filas.push([etiqueta, valor]);
  }
  return filas;
}

export async function montar(host, parametro) {
  let metaDatos;
  try {
    metaDatos = await cargarMeta();
  } catch (error) {
    host.append(alerta({ tipo: "error", titulo: "No se pudo cargar el catálogo", texto: error.message }));
    return null;
  }

  const pruebas = metaDatos.pruebas;
  let prueba = pruebas.find((p) => p.clave === parametro)?.clave
    || (transito.inferencia?.prueba && pruebas.some((p) => p.clave === transito.inferencia.prueba) ? transito.inferencia.prueba : "t_una");
  let resultado = null;
  let campos = {};
  let alfa = 0.05;
  let alternativa = "two-sided";
  let controlador = null;
  let campoAlfa = null;
  let botonEjecutar = null;

  const buscador = el("div", { class: "lista-busqueda" });
  const entradaBusqueda = el("input", { type: "search", placeholder: "Buscar prueba…", "aria-label": "Buscar prueba estadística" });
  buscador.append(icono("buscar", { tamano: 15 }), entradaBusqueda);
  const lista = el("div", { class: "lista-modelos", role: "list" });
  const panelPruebas = panel({
    titulo: "Pruebas",
    subtitulo: `${pruebas.length} métodos disponibles`,
    icono: "inferencia",
    contenido: el("div", {}, buscador, lista),
    sinRelleno: true,
    clase: "panel--plano",
  });
  panelPruebas.cuerpo.classList.add("panel__cuerpo--estrecho");

  const contenido = el("div", { class: "pila", "aria-live": "polite" });

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
          el("span", { class: "ceja" }, "Inferir · Contraste de hipótesis"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("inferencia", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Inferencia estadística")
          ),
          el(
            "p",
            { class: "vista__subtitulo" },
            "Trece pruebas con estadístico, p-valor, grados de libertad, intervalo y tamaño del efecto. La interfaz explica los supuestos y evita conclusiones que los datos no sostienen."
          )
        ),
        el(
          "div",
          { class: "vista__acciones" },
          boton("Intervalos y error", { variante: "secundario", icono: "teoria", onClick: () => navegar("teoria/intervalos_confianza") })
        )
      ),
      el("div", { class: "dividido" }, panelPruebas, contenido)
    )
  );

  function renderLista() {
    const consulta = normalizar(entradaBusqueda.value);
    lista.replaceChildren();
    let visibles = 0;
    for (const grupo of GRUPOS) {
      const items = pruebas.filter((p) => p.grupo === grupo && (!consulta || normalizar(`${p.nombre} ${p.descripcion}`).includes(consulta)));
      if (!items.length) continue;
      lista.append(el("p", { class: "modelo-grupo__titulo" }, grupo));
      for (const p of items) {
        visibles++;
        lista.append(
          el(
            "button",
            {
              class: "modelo-item",
              type: "button",
              role: "listitem",
              "aria-pressed": String(p.clave === prueba),
              onClick: () => seleccionar(p.clave),
            },
            el("span", { class: "modelo-item__nombre" }, p.nombre)
          )
        );
      }
    }
    if (!visibles) lista.append(el("p", { class: "tabla-vacia" }, "Ninguna prueba coincide."));
  }

  entradaBusqueda.addEventListener("input", renderLista);

  /* ------------------------- campos ------------------------- */

  function crearCampo(spec, valorInicial, onInput) {
    const comun = {
      etiqueta: spec.etiqueta,
     codigo: spec.id,
      ayuda: spec.ayuda || "",
      requerido: true,
      valor: valorTexto(valorInicial ?? spec.default ?? ""),
      placeholder: spec.ejemplo || "",
      onInput,
    };
    if (spec.tipo === "serie") {
      return campo({ ...comun, tipo: "serie", filas: 4, ayuda: spec.ayuda || "Separa las observaciones con espacios, comas o saltos de línea." });
    }
    if (spec.tipo === "matriz") {
      return campo({ ...comun, tipo: "matriz", filas: 5, ayuda: spec.ayuda || "Una fila por línea; separa columnas con espacios o tabuladores." });
    }
    if (spec.tipo === "grupos") {
      return campo({ ...comun, tipo: "matriz", filas: 5, ayuda: spec.ayuda || "Una línea por grupo; separa observaciones con espacios o comas." });
    }
    if (spec.tipo === "entero") {
      return campo({ ...comun, tipo: "numero", min: spec.min ?? null, max: spec.max ?? null });
    }
    if (spec.tipo === "opcion") {
      return campo({
        etiqueta: spec.etiqueta,
        codigo: spec.id,
        tipo: "select",
        valor: valorInicial ?? spec.default ?? (spec.opciones?.[0]?.[0] || ""),
        opciones: spec.opciones || [],
      });
    }
    return campo({ ...comun, tipo: "numero", min: spec.min ?? null, max: spec.max ?? null, step: spec.step ?? "any" });
  }

  function construirFormulario(spec) {
    const ejemplo = EJEMPLOS_PRUEBA[spec.clave] || {};
    const iniciales = { ...ejemplo, ...(transito.inferencia?.prueba === spec.clave ? transito.inferencia.campos : {}) };
    campos = {};
    const bloquesDatos = [];
    const numericos = [];

    for (const definicion of spec.campos) {
      const c = crearCampo(definicion, iniciales[definicion.id]);
      campos[definicion.id] = c;
      if (["serie", "matriz", "grupos"].includes(definicion.tipo)) bloquesDatos.push(c);
      else numericos.push(c);
    }

    campoAlfa = campo({
      etiqueta: "Nivel de significación α",
      codigo: "alfa",
      tipo: "numero",
      valor: alfa,
      min: 0.0001,
      max: 0.9999,
      ayuda: "Probabilidad de rechazar H₀ cuando es cierta. Lo habitual es 0,05.",
    });
    const chipsAlfa = el(
      "div",
      { class: "chips" },
      [0.01, 0.05, 0.1].map((valor) =>
        el(
          "button",
          {
            class: "chip",
            type: "button",
            onClick: () => {
              campoAlfa.setValor(valor);
              alfa = valor;
            },
          },
          `α = ${fmtNum(valor, { decimales: 2 })}`
        )
      )
    );

    const selectorAlternativa = segmentado({
      etiqueta: "Hipótesis alternativa",
      valor: alternativa,
      opciones: [
        ["two-sided", "Bilateral ≠"],
        ["less", "Menor <"],
        ["greater", "Mayor >"],
      ],
      onCambio: (valor) => {
        alternativa = valor;
      },
    });

    botonEjecutar = boton("Ejecutar prueba", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
    const botonLimpiar = boton("Limpiar", {
      variante: "fantasma",
      icono: "basura",
      onClick: () => {
        for (const definicion of spec.campos) {
          campos[definicion.id].setValor("");
          campos[definicion.id].limpiarError();
        }
        resultado = null;
        contenido.replaceChildren(renderInicial(spec));
      },
    });
    const botonEjemplo = boton("Cargar ejemplo", {
      variante: "secundario",
      icono: "chispa",
      onClick: () => {
        for (const [nombre, valor] of Object.entries(ejemplo)) {
          campos[nombre]?.setValor(valorTexto(valor));
          campos[nombre]?.limpiarError();
        }
        toast("Ejemplo cargado", { tipo: "ok" });
      },
    });

    botonEjecutar.addEventListener("click", ejecutar);

    const nodo = panel({
      titulo: spec.nombre,
      subtitulo: spec.descripcion,
      icono: "inferencia",
      acciones: [badge(spec.grupo, "marca")],
      contenido: el(
        "div",
        { class: "pila" },
        el(
          "div",
          { class: "chips" },
          el("span", { class: "chip chip--marca" }, `H₀: ${spec.h0}`),
          el("span", { class: "chip" }, `H₁: ${spec.h1}`)
        ),
        bloquesDatos.length
          ? el("div", { class: bloquesDatos.length > 1 ? "rejilla rejilla--2" : "" }, bloquesDatos.map((c) => c.envoltura))
          : null,
        numericos.length ? el("div", { class: "columnas-formulario" }, numericos.map((c) => c.envoltura)) : null,
        el(
          "div",
          { class: "rejilla rejilla--2", style: { alignItems: "end" } },
          el("div", { class: "pila pila--sm" }, campoAlfa.envoltura, chipsAlfa),
          el("div", { class: "campo" }, el("span", { class: "campo__etiqueta" }, "Contraste"), selectorAlternativa)
        ),
        pliegue({
          titulo: "Supuestos y buenas prácticas",
          icono: "escudo",
          contenido: el(
            "div",
            { class: "pila pila--sm" },
            el("p", {}, spec.supuestos || "Revisa independencia, escala y tamaño de muestra antes de interpretar."),
            boton("Ver la lección", {
              variante: "fantasma",
              pequeno: true,
              icono: "teoria",
              onClick: () => spec.teoria && navegar(`teoria/${spec.teoria}`),
            })
          ),
        }),
        el("div", { class: "fila fila--entre" }, el("div", { class: "fila" }, botonEjecutar, botonEjemplo, botonLimpiar))
      ),
    });
    return nodo;
  }

  function renderInicial(spec) {
    return panel({
      titulo: "Listo para ejecutar",
      icono: "chispa",
      contenido: estadoVacio({
        icono: "inferencia",
        titulo: "Completa los datos y ejecuta la prueba",
        texto: `Se calcularán el estadístico, el p-valor, el intervalo y el tamaño del efecto de «${spec.nombre}». Si prefieres empezar con datos reales, pulsa Cargar ejemplo.`,
        acciones: [
          boton("Ejecutar con el ejemplo", {
            icono: "reproducir",
            onClick: () => {
              const ejemplo = EJEMPLOS_PRUEBA[spec.clave] || {};
              for (const [nombre, valor] of Object.entries(ejemplo)) {
                campos[nombre]?.setValor(valorTexto(valor));
              }
              ejecutar();
            },
          }),
        ],
      }),
    });
  }

  /* ------------------------- ejecución ------------------------- */

  function validarCampos(spec) {
    let ok = true;
    for (const definicion of spec.campos) {
      const c = campos[definicion.id];
      c.limpiarError();
      const texto = c.texto();
      if (!texto) {
        c.setError("Este campo es obligatorio.");
        ok = false;
        continue;
      }
      if (definicion.tipo === "serie") {
        const tokens = texto.split(/[\s,;]+/).filter(Boolean);
        if (tokens.length < 2) {
          c.setError("Introduce al menos dos observaciones numéricas.");
          ok = false;
        } else if (tokens.some((t) => !Number.isFinite(Number(t.replace(",", "."))))) {
          c.setError("Hay valores no numéricos. Usa punto decimal.");
          ok = false;
        }
      } else if (definicion.tipo === "matriz") {
        const filas = texto.split(/\r?\n/).filter((l) => l.trim());
        if (filas.length < 2 || filas.some((l) => l.trim().split(/[\s,;]+/).filter(Boolean).length < 2)) {
          c.setError("La tabla necesita al menos 2 filas y 2 columnas numéricas.");
          ok = false;
        }
      } else if (definicion.tipo === "grupos") {
        const filas = texto.split(/\r?\n/).filter((l) => l.trim());
        if (filas.length < 2 || filas.some((l) => l.trim().split(/[\s,;]+/).filter(Boolean).length < 2)) {
          c.setError("Cada grupo necesita al menos 2 observaciones y debe haber 2 grupos.");
          ok = false;
        }
      } else if (definicion.tipo === "numero" || definicion.tipo === "entero") {
        const valor = c.valor();
        if (typeof valor !== "number" || !Number.isFinite(valor)) {
          c.setError("Introduce un número válido.");
          ok = false;
        } else if (definicion.tipo === "entero" && !Number.isInteger(valor)) {
          c.setError("Debe ser un número entero.");
          ok = false;
        }
      }
    }
    const a = campoAlfa.valor();
    if (typeof a !== "number" || a <= 0 || a >= 1) {
      campoAlfa.setError("α debe estar entre 0 y 1.");
      ok = false;
    }
    if (!ok) {
      const primerError = Object.values(campos).find((c) => c.control.getAttribute("aria-invalid") === "true") || campoAlfa;
      primerError.enfocar();
    }
    return ok;
  }

  function construirPayload(spec) {
    const datos = { prueba: spec.clave, alfa: campoAlfa.valor(), alternativa };
    for (const definicion of spec.campos) {
      const c = campos[definicion.id];
      if (definicion.tipo === "serie" || definicion.tipo === "matriz" || definicion.tipo === "grupos") {
        datos[definicion.id] = c.texto();
      } else {
        datos[definicion.id] = c.valor();
      }
    }
    return datos;
  }

  async function ejecutar() {
    const spec = pruebas.find((p) => p.clave === prueba);
    if (!validarCampos(spec)) {
      toast("Revisa los campos marcados", { tipo: "error" });
      return;
    }
    alfa = campoAlfa.valor();
    const payload = construirPayload(spec);
    if (controlador) controlador.abort();
    controlador = new AbortController();
    botonEjecutar.cargando(true);
    const anterior = contenido.querySelector(".resultado-prueba");
    contenido.querySelector(".resultado-prueba")?.setAttribute("aria-busy", "true");
    try {
      const datos = await api.post("/api/inferencia", payload, { senal: controlador.signal });
      resultado = datos;
      renderResultado(spec, datos);
      registrarHistorial({
        titulo: `${spec.nombre}`,
        detalle: `p = ${fmtP(datos.p_valor)} · ${datos.rechaza ? "se rechaza H₀" : "no se rechaza H₀"}`,
        ruta: `inferencia/${spec.clave}`,
        tipo: "inferencia",
        icono: "inferencia",
      });
      anunciar(datos.rechaza ? "Se rechaza la hipótesis nula." : "No se rechaza la hipótesis nula.");
    } catch (error) {
      if (!esCancelacion(error)) {
        resultado = null;
        contenido.querySelector(".resultado-prueba")?.remove();
        contenido.append(
          panel({
            titulo: "No se pudo ejecutar la prueba",
            icono: "alerta",
            contenido: alerta({
              tipo: "error",
              titulo: "Revisa los datos",
              texto: error.message,
              acciones: [boton("Reintentar", { variante: "secundario", pequeno: true, icono: "actualizar", onClick: ejecutar })],
            }),
          })
        );
        toast(error.message, { tipo: "error" });
      }
    } finally {
      botonEjecutar.cargando(false);
      contenido.querySelector(".resultado-prueba")?.setAttribute("aria-busy", "false");
    }
  }

  /* ------------------------- resultado ------------------------- */

  function configGrafico(datos) {
    if (!datos.curva) return null;
    const curva = datos.curva;
    const xs = curva.x.map(Number).filter(Number.isFinite);
    if (!xs.length) return null;
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);
    const regiones = [];
    const etiquetaRegion = datos.alternativa === "two-sided" ? "α/2" : "α";
    if (datos.alternativa === "less" && curva.critico_bajo !== null) {
      regiones.push({ desde: xmin, hasta: Number(curva.critico_bajo), etiqueta: "rechazo" });
    } else if (datos.alternativa === "greater" || curva.region === "derecha") {
      if (curva.critico_alto !== null) regiones.push({ desde: Number(curva.critico_alto), hasta: xmax, etiqueta: "rechazo" });
    } else if (curva.critico_bajo !== null && curva.critico_alto !== null) {
      regiones.push({ desde: xmin, hasta: Number(curva.critico_bajo), etiqueta: etiquetaRegion });
      regiones.push({ desde: Number(curva.critico_alto), hasta: xmax, etiqueta: etiquetaRegion });
    }
    const estadistico = Number(datos.estadistico);
    const dentro = Number.isFinite(estadistico) && estadistico >= xmin && estadistico <= xmax;
    return {
      series: [{ nombre: `Distribución nula (${curva.familia})`, x: curva.x, y: curva.y, color: "var(--grafico-2)", relleno: true }],
      regiones,
      marcador: dentro ? { x: estadistico, etiqueta: `estadístico = ${fmtNum(estadistico)}` } : null,
      xlabel: "Estadístico de prueba",
      ylabel: "Densidad bajo H₀",
      altura: 280,
      yCero: true,
      ariaLabel: "Distribución del estadístico bajo la hipótesis nula con la región de rechazo",
    };
  }

  function resumenTexto(spec, datos) {
    return [
      `${spec.nombre}`,
      `Estadístico: ${fmtNum(datos.estadistico)}`,
      `p-valor: ${datos.p_valor}`,
      `α: ${datos.alfa}`,
      datos.gl !== null ? `Grados de libertad: ${fmtNum(datos.gl)}` : "",
      datos.intervalo ? `Intervalo: [${fmtNum(datos.intervalo[0])}, ${fmtNum(datos.intervalo[1])}]` : "",
      `Conclusión: ${datos.conclusion}`,
      interpretarEfecto(datos.extras) || "",
    ].filter(Boolean).join("\n");
  }

  function renderResultado(spec, datos) {
    const verdicto = el(
      "div",
      { class: `veredicto ${datos.rechaza ? "veredicto--rechaza" : "veredicto--conserva"}` },
      el("span", { class: "veredicto__icono" }, icono(datos.rechaza ? "circulo-check" : "info", { tamano: 20 })),
      el(
        "div",
        { class: "veredicto__cuerpo" },
        el("p", { class: "veredicto__titulo" }, datos.rechaza ? "Se rechaza H₀" : "No se rechaza H₀"),
        el("p", { class: "veredicto__texto" }, datos.conclusion),
        el("p", { class: "veredicto__p" }, `p = ${fmtP(datos.p_valor)} · α = ${fmtNum(datos.alfa, { decimales: 3 })} · ${datos.metodo}`)
      )
    );

    const kpis = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: "Estadístico", valor: fmtNum(datos.estadistico, { decimales: 5 }), detalle: datos.metodo }),
      kpi({ etiqueta: "p-valor", valor: fmtP(datos.p_valor), detalle: "evidencia frente a H₀", tono: datos.rechaza ? "marca" : "" }),
      kpi({ etiqueta: "Grados de libertad", valor: datos.gl !== null ? fmtNum(datos.gl, { decimales: 2 }) : "—", detalle: datos.gl !== null ? "distribución de referencia" : "no aplica" }),
      datos.intervalo
        ? kpi({ etiqueta: "Intervalo", valor: `[${fmtNum(datos.intervalo[0], { decimales: 4 })}, ${fmtNum(datos.intervalo[1], { decimales: 4 })}]`, detalle: `${fmtPorcentaje(1 - datos.alfa)} de confianza` })
        : kpi({ etiqueta: "Intervalo", valor: "—", detalle: "esta prueba no lo calcula" }),
      interpretarEfecto(datos.extras)
        ? kpi({ etiqueta: "Tamaño del efecto", valor: fmtNum(datos.extras.d_cohen ?? datos.extras.eta2 ?? datos.extras.r, { decimales: 4 }), detalle: interpretarEfecto(datos.extras) })
        : null
    );

    const hostGrafico = el("div");
    const cfg = configGrafico(datos);
    setTimeout(() => {
      if (cfg) dibujar(hostGrafico, cfg);
      else hostGrafico.append(el("p", { class: "texto-tenue texto-pequeno" }, "Esta prueba no tiene una distribución nula paramétrica simple; la decisión se basa en el p-valor."));
    }, 0);

    const formula = leccion(spec.teoria)?.formula;
    const formulaNodo = el("div", { class: "formula-card" }, el("span", { class: "formula-etiqueta" }, "Estadístico de referencia"));
    const destinoFormula = el("div");
    formulaNodo.append(destinoFormula);
    if (formula) latex(destinoFormula, formula, { display: true });
    else destinoFormula.textContent = spec.h0;

    const extras = filasExtras(datos.extras);
    const detallesPanel = panel({
      titulo: "Detalle numérico",
      icono: "tabla",
      contenido: el(
        "div",
        { class: "pila" },
        el(
          "dl",
          { class: "lista-definicion" },
          el("div", {}, el("dt", {}, "Estadístico"), el("dd", {}, fmtNum(datos.estadistico, { decimales: 8 }))),
          el("div", {}, el("dt", {}, "p-valor exacto"), el("dd", {}, String(datos.p_valor))),
          el("div", {}, el("dt", {}, "α"), el("dd", {}, fmtNum(datos.alfa, { decimales: 4 }))),
          datos.gl !== null ? el("div", {}, el("dt", {}, "Grados de libertad"), el("dd", {}, fmtNum(datos.gl, { decimales: 4 }))) : null,
          datos.intervalo ? el("div", {}, el("dt", {}, "Intervalo"), el("dd", {}, `[${fmtNum(datos.intervalo[0], { decimales: 6 })}, ${fmtNum(datos.intervalo[1], { decimales: 6 })}]`)) : null,
          extras.map(([etiqueta, valor]) => el("div", {}, el("dt", {}, etiqueta), el("dd", {}, valor)))
        ),
        formulaNodo
      ),
    });

    const panelHipotesis = panel({
      titulo: "Hipótesis y supuestos",
      icono: "escudo",
      contenido: el(
        "div",
        { class: "pila pila--sm" },
        el("div", { class: "chips" }, el("span", { class: "chip chip--marca" }, `H₀: ${spec.h0}`), el("span", { class: "chip" }, `H₁: ${spec.h1}`)),
        el("p", { class: "texto-articulo" }, spec.supuestos || "Revisa los supuestos antes de comunicar el resultado."),
        datos.avisos?.length
          ? el("div", { class: "pila pila--sm" }, datos.avisos.map((aviso) => alerta({ tipo: "aviso", texto: aviso })))
          : alerta({ tipo: "ok", texto: "No se detectaron advertencias automáticas. Aun así, revisa el diseño y la independencia de las observaciones." })
      ),
    });

    const panelInterpretacion = panel({
      titulo: "Cómo leer este resultado",
      icono: "info",
      contenido: el(
        "div",
        { class: "pila pila--sm" },
        el("p", { class: "texto-articulo" }, "El p-valor es la probabilidad de observar un estadístico al menos tan extremo como el calculado si H₀ fuese cierta. No es la probabilidad de que H₀ sea verdadera."),
        el("p", { class: "texto-articulo" }, "Rechazar H₀ indica evidencia estadística de un efecto, no que el efecto sea grande o importante. Por eso se informa el intervalo y el tamaño del efecto."),
        interpretarEfecto(datos.extras) ? el("p", { class: "texto-articulo" }, interpretarEfecto(datos.extras)) : null,
        boton("Ver la lección completa", { variante: "secundario", pequeno: true, icono: "teoria", onClick: () => spec.teoria && navegar(`teoria/${spec.teoria}`) })
      ),
    });

    const panelGrafico = panel({
      titulo: "Distribución nula y región de rechazo",
      subtitulo: cfg
        ? "La zona sombreada es la región crítica para el α elegido; la línea marca el estadístico observado."
        : "No disponible para este método.",
      icono: "grafico",
      contenido: hostGrafico,
    });

    const acciones = el(
      "div",
      { class: "panel__acciones" },
      boton("Copiar interpretación", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(resumenTexto(spec, datos)) }),
      boton("PDF", { variante: "secundario", pequeno: true, icono: "documento", onClick: (e) => exportar(spec, datos, "pdf", e.currentTarget) }),
      boton("Excel", { variante: "secundario", pequeno: true, icono: "tabla", onClick: (e) => exportar(spec, datos, "xlsx", e.currentTarget) })
    );

    const bloque = el(
      "div",
      { class: "pila resultado-prueba" },
      panel({ titulo: "Resultado", icono: "objetivo", acciones, contenido: el("div", { class: "pila" }, verdicto, kpis) }),
      el("div", { class: "rejilla rejilla--2" }, panelGrafico, panelHipotesis),
      el("div", { class: "rejilla rejilla--2" }, panelInterpretacion, detallesPanel)
    );

    const anterior = contenido.querySelector(".resultado-prueba");
    if (anterior) anterior.remove();
    contenido.append(bloque);
    renderMath(bloque);
    bloque.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function exportar(spec, datos, formato, botonNodo) {
    const cfg = configGrafico(datos);
    const resumen = resumenTexto(spec, datos);
    const tablas = [
      {
        nombre: "Resultado",
        columnas: ["Métrica", "Valor"],
        filas: [
          ["Prueba", spec.nombre],
          ["Estadístico", datos.estadistico],
          ["p-valor", datos.p_valor],
          ["α", datos.alfa],
          ["Grados de libertad", datos.gl ?? "—"],
          ["Intervalo inferior", datos.intervalo?.[0] ?? "—"],
          ["Intervalo superior", datos.intervalo?.[1] ?? "—"],
          ["Conclusión", datos.conclusion],
        ],
      },
    ];
    const extras = filasExtras(datos.extras);
    if (extras.length) tablas.push({ nombre: "Tamaños de efecto", columnas: ["Métrica", "Valor"], filas: extras });
    await conCarga(botonNodo, async () => {
      try {
        await api.exportar({
          formato,
          titulo: `${spec.nombre} · AmPu 3.1`,
          resumen,
          tablas,
          figura: cfg
            ? {
                series: [{ nombre: "Distribución nula", x: cfg.series[0].x, y: cfg.series[0].y, tipo: "linea", relleno: true }],
                marcador: cfg.marcador?.x ?? null,
                xlabel: cfg.xlabel,
                ylabel: cfg.ylabel,
                titulo: spec.nombre,
              }
            : null,
          formula: leccion(spec.teoria)?.formula,
          vista: "inferencia",
          estado: { prueba: spec.clave, campos: Object.fromEntries(Object.entries(campos).map(([k, c]) => [k, c.texto()])), alfa: datos.alfa, alternativa },
        });
        toast(`Archivo ${formato.toUpperCase()} generado`, { tipo: "ok" });
      } catch (error) {
        if (!esCancelacion(error)) toast(error.message, { tipo: "error" });
      }
    });
  }

  /* ------------------------- selección ------------------------- */

  function seleccionar(clave) {
    prueba = clave;
    resultado = null;
    history.replaceState(null, "", `#/inferencia/${clave}`);
    const spec = pruebas.find((p) => p.clave === clave);
    renderLista();
    contenido.replaceChildren(
      construirFormulario(spec),
      renderInicial(spec)
    );
    anunciar(`Prueba ${spec.nombre} seleccionada.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderLista();
  seleccionar(prueba);

  // Flujo cruzado desde descriptiva: rellenar y ejecutar una vez.
  if (transito.inferencia?.campos) {
    const spec = pruebas.find((p) => p.clave === prueba);
    for (const [nombre, valor] of Object.entries(transito.inferencia.campos)) {
      campos[nombre]?.setValor(valorTexto(valor));
    }
    transito.inferencia = null;
    setTimeout(ejecutar, 60);
  } else if (transito.inferencia?.prueba) {
    transito.inferencia = null;
  }

  return () => {
    if (controlador) controlador.abort();
  };
}
