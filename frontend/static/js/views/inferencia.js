import { VISTAS } from "../data.js";
import {
  el,
  panel,
  boton,
  campo,
  kpi,
  badge,
  alerta,
  toast,
  copiar,
  conCarga,
  fmtNum,
  fmtP,
  fmtPreciso,
  fmtIntervalo,
  errorEnCampo,
  textoError,
  fmtPorcentaje,
  segmentado,
  latex,
  anunciar,
  botonesExportar,
  comportamientoScroll,
} from "../ui.js";
import { icono } from "../icons.js";
import { dibujar } from "../chart.js";
import { api, esCancelacion } from "../api.js";
import { fmtEntrada } from "../entrada.js";
import { cargarMeta, leccion, registrarHistorial, transito } from "../store.js";
import { abrirVentana, cerrarVentanasPorAlcance, ventanasAbiertas, barraResultados } from "../ventanas.js";
import { abrirTeoriaVentana } from "../teoria_dialogo.js";

const EJEMPLOS_PRUEBA = {
  t_una: { datos: "12,4 11,8 13,1 12,9 12,2 12,7 12,5 11,9 12,8 12,3", mu0: 12 },
  z_una: { datos: "10,1 9,8 10,4 9,9 10,2 10,3 9,7 10,5", mu0: 10, sigma: 0.6 },
  t_dos: {
    datos: "12 13 11 14 12 13 12,5 11,5 13,5 12,2",
    datos2: "15 16 14 15 17 16 15,5 14,8 16,2 15,1",
  },
  z_dos: {
    datos: "12 13 11 14 12 13 12,5 11,5",
    datos2: "15 16 14 15 17 16 15,5 14,8",
    sigma_a: 1.2,
    sigma_b: 1.4,
  },
  prop_una: { exitos: 48, n: 100, p0: 0.4 },
  prop_dos: { x1: 45, n1: 100, x2: 34, n2: 100 },
  chi_indep: { tabla: "42 28 30\n18 32 40" },
  chi_bondad: { observadas: "18 22 29 31", esperadas: "25 25 25 25", parametros_estimados: 0 },
  anova: { grupos: "10 12 11 13 12\n14 15 13 16 15\n9 11 10 12 10" },
  correlacion: { x: "1 2 3 4 5 6 7 8", y: "2,1 2,9 4,2 4,8 6,1 6,9 8,2 8,8", metodo: "pearson" },
  mann_whitney: { datos: "12 13 11 14 12 13", datos2: "15 16 14 15 17 16" },
  wilcoxon: { datos: "120 118 131 129 122 127", datos2: "115 116 128 125 120 122" },
  kruskal: { grupos: "10 12 11 13 12\n14 15 13 16 15\n9 11 10 12 10" },
};

const GRUPOS = ["Medias", "Proporciones", "Asociación", "No paramétricas"];
const NOMBRES_FAMILIA = { normal: "N(0, 1)", t: "t de Student", chi2: "χ²", f: "F de Snedecor" };

function normalizar(texto) {
  return String(texto || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function valorTexto(valor) {
  if (Array.isArray(valor) && valor.every((v) => typeof v === "number")) return valor.map((v) => fmtEntrada(v)).join(" ");
  if (Array.isArray(valor)) return valor.join("\n");
  if (valor === null || valor === undefined) return "";
  return String(valor);
}

const EFECTOS = [
  ["d_cohen", "d de Cohen", [0.2, 0.5, 0.8], "efecto"],
  ["h_cohen", "h de Cohen", [0.2, 0.5, 0.8], "efecto"],
  ["w_cohen", "w de Cohen", [0.1, 0.3, 0.5], "efecto"],
  ["v_cramer", "V de Cramér", [0.1, 0.3, 0.5], "asociación"],
  ["eta2", "η²", [0.01, 0.06, 0.14], "efecto"],
  ["epsilon2", "ε²", [0.01, 0.06, 0.14], "efecto"],
  ["r_biserial", "r biserial de rangos", [0.1, 0.3, 0.5], "efecto"],
  ["r", "r", [0.1, 0.3, 0.5], "asociación"],
];

function efectoPrincipal(extras) {
  for (const [clave, nombre, cortes, sustantivo] of EFECTOS) {
    const valor = extras?.[clave];
    if (typeof valor !== "number" || !Number.isFinite(valor)) continue;
    const abs = Math.abs(valor);
    const femenino = sustantivo === "asociación";
    const magnitud =
      abs >= cortes[2] ? "grande" : abs >= cortes[1] ? (femenino ? "moderada" : "moderado") : abs >= cortes[0] ? (femenino ? "pequeña" : "pequeño") : "despreciable";
    return { clave, nombre, valor, magnitud, sustantivo };
  }
  return null;
}

function interpretarEfecto(extras) {
  const efecto = efectoPrincipal(extras);
  if (!efecto) return null;
  return `${efecto.nombre} = ${fmtNum(efecto.valor)}: ${efecto.sustantivo} ${efecto.magnitud} según los umbrales orientativos de Cohen.`;
}

function filasExtras(extras) {
  const etiquetas = [
    ["d_cohen", "d de Cohen"],
    ["h_cohen", "h de Cohen"],
    ["w_cohen", "w de Cohen"],
    ["v_cramer", "V de Cramér"],
    ["eta2", "η² (varianza explicada)"],
    ["epsilon2", "ε² (rangos)"],
    ["r_biserial", "r biserial de rangos"],
    ["r", "Correlación r"],
    ["r2", "R²"],
    ["n", "Tamaño de muestra"],
    ["n1", "Tamaño del grupo A"],
    ["n2", "Tamaño del grupo B"],
    ["media_muestral", "Media muestral"],
    ["medias", "Medias de los grupos"],
    ["medianas", "Medianas de los grupos"],
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

function glDobles(datos) {
  const p = datos.curva && datos.curva.parametros;
  return Boolean(p && p.gl1 !== undefined && p.gl1 !== null && p.gl2 !== undefined && p.gl2 !== null);
}

function textoGl(datos, decimales = 2) {
  if (glDobles(datos)) {
    const { gl1, gl2 } = datos.curva.parametros;
    return `${fmtNum(gl1, { decimales })}; ${fmtNum(gl2, { decimales })}`;
  }
  return fmtNum(datos.gl, { decimales });
}

function nombreNula(curva) {
  const p = curva.parametros || {};
  if (curva.familia === "t") return `t(${fmtNum(p.gl, { decimales: 2 })})`;
  if (curva.familia === "chi2") return `χ²(${fmtNum(p.gl, { decimales: 2 })})`;
  if (curva.familia === "f") return `F(${fmtNum(p.gl1 ?? p.gl, { decimales: 2 })}; ${fmtNum(p.gl2, { decimales: 2 })})`;
  return NOMBRES_FAMILIA[curva.familia] || curva.familia;
}

export async function montar(host, parametro) {
  let metaDatos;
  try {
    metaDatos = await cargarMeta();
  } catch (error) {
    host.append(alerta({ tipo: "error", titulo: "No se pudo cargar el catálogo", texto: textoError(error) }));
    return null;
  }

  const pruebas = metaDatos.pruebas;
  let prueba = pruebas.find((p) => p.clave === parametro)?.clave
    || (transito.inferencia?.prueba && pruebas.some((p) => p.clave === transito.inferencia.prueba) ? transito.inferencia.prueba : "t_una");
  let resultado = null;
  let specActual = pruebas.find((p) => p.clave === prueba);
  let campos = {};
  let alfa = 0.05;
  let alternativa = "two-sided";
  let controlador = null;
  let campoAlfa = null;
  let botonEjecutar = null;

  const buscador = el("div", { class: "lista-busqueda" });
  const entradaBusqueda = el("input", { type: "search", placeholder: "Buscar prueba…", "aria-label": "Buscar prueba estadística" });
  buscador.append(icono("buscar", { tamano: 15 }), entradaBusqueda);
  const lista = el("div", { class: "lista-modelos", role: "group", "aria-label": "Pruebas estadísticas" });
  const panelPruebas = panel({
    titulo: "Pruebas",
    subtitulo: `${pruebas.length} métodos disponibles`,
    icono: "inferencia",
    contenido: el("div", {}, buscador, lista),
    sinRelleno: true,
    clase: "panel--plano",
  });
  panelPruebas.cuerpo.classList.add("panel__cuerpo--estrecho");

  const formHost = el("div");
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
  const contenido = el("div", { class: "pila", "aria-live": "polite" }, formHost, barraHost, errorHost);

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
          el("p", { class: "vista__subtitulo" }, VISTAS.inferencia.subtitulo)
        ),
        el(
          "div",
          { class: "vista__acciones" },
          boton("Teoría", {
            variante: "secundario",
            icono: "teoria",
            onClick: () => abrirTeoriaVentana(specActual?.teoria || "intervalos_confianza", { alcance: "vista" }),
          })
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
      nombre: spec.id,
      onInput,
    };
    if (spec.tipo === "serie") return campo({ ...comun, tipo: "serie", filas: 4, ayuda: "" });
    if (spec.tipo === "matriz") return campo({ ...comun, tipo: "matriz", filas: 5, ayuda: "Una fila por línea." });
    if (spec.tipo === "grupos") return campo({ ...comun, tipo: "matriz", filas: 5, ayuda: "Una línea por grupo." });
    if (spec.tipo === "entero") return campo({ ...comun, tipo: "numero", min: spec.min ?? null, max: spec.max ?? null });
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
      ayuda: "Probabilidad de rechazar H₀ cuando es cierta (habitual: 0,05).",
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

    const admiteAlternativa = spec.admite_alternativa !== false;
    const h1Vivo = el("strong", {}, admiteAlternativa ? spec.h1_alternativas?.[alternativa] || spec.h1 : spec.h1);
    const hipotesisVivas = el(
      "div",
      { class: "hipotesis-vivas", "aria-live": "polite" },
      el("span", {}, "H₀: ", el("strong", {}, spec.h0)),
      el("span", {}, "H₁: ", h1Vivo)
    );
    const selectorAlternativa = admiteAlternativa
      ? segmentado({
          etiqueta: "Hipótesis alternativa",
          valor: alternativa,
          opciones: [
            ["two-sided", "Bilateral ≠"],
            ["less", "Menor <"],
            ["greater", "Mayor >"],
          ],
          onCambio: (valor) => {
            alternativa = valor;
            h1Vivo.textContent = spec.h1_alternativas?.[valor] || spec.h1;
          },
        })
      : el("p", { class: "campo__ayuda" }, "Prueba ómnibus sin versión unilateral.");

    botonEjecutar = boton("Ejecutar prueba", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
    const botonLimpiar = boton("Limpiar", {
      variante: "fantasma",
      icono: "limpiar",
      onClick: () => {
        controlador?.abort();
        for (const definicion of spec.campos) {
          campos[definicion.id].setValor("");
          campos[definicion.id].limpiarError();
        }
        resultado = null;
        errorHost.replaceChildren();
        renderBarra(spec);
        cerrarVentanasPorAlcance("vista");
      },
    });
    const botonEjemplo = boton("Cargar ejemplo", {
      variante: "secundario",
      icono: "ejemplo",
      onClick: () => {
        for (const [nombre, valor] of Object.entries(ejemplo)) {
          campos[nombre]?.setValor(valorTexto(valor));
          campos[nombre]?.limpiarError();
        }
        toast("Ejemplo cargado", { tipo: "ok" });
      },
    });

    botonEjecutar.addEventListener("click", ejecutar);

    return panel({
      titulo: spec.nombre,
      subtitulo: spec.descripcion,
      icono: "inferencia",
      acciones: [
        badge(spec.grupo, "marca"),
        spec.teoria
          ? boton("Teoría", {
              variante: "fantasma",
              pequeno: true,
              icono: "teoria",
              onClick: () => abrirTeoriaVentana(spec.teoria, { alcance: "vista" }),
            })
          : null,
      ].filter(Boolean),
      contenido: el(
        "div",
        { class: "pila" },
        hipotesisVivas,
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
        el("div", { class: "fila" }, botonEjecutar, botonEjemplo, botonLimpiar)
      ),
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
      if (["serie", "matriz", "grupos"].includes(definicion.tipo)) {
        if (!c.validar()) {
          ok = false;
          continue;
        }
        const lectura = c.lectura();
        if (definicion.tipo === "serie" && lectura.valores.length < 2) {
          c.setError("Introduce al menos dos observaciones.");
          ok = false;
        } else if (definicion.tipo === "matriz" && (lectura.filas.length < 2 || lectura.filas.some((f) => f.length < 2))) {
          c.setError("La tabla necesita al menos 2 filas y 2 columnas.");
          ok = false;
        } else if (definicion.tipo === "grupos" && (lectura.filas.length < 2 || lectura.filas.some((f) => f.length < 2))) {
          c.setError("Hacen falta al menos 2 grupos con 2 observaciones cada uno.");
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
        } else if (!c.validar()) {
          ok = false;
        } else if (definicion.incluir_minimo === false && definicion.min != null && valor <= definicion.min) {
          c.setError(`Debe ser mayor que ${fmtNum(definicion.min)}.`);
          ok = false;
        } else if (definicion.incluir_maximo === false && definicion.max != null && valor >= definicion.max) {
          c.setError(`Debe ser menor que ${fmtNum(definicion.max)}.`);
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
    const datos = { prueba: spec.clave, alfa: campoAlfa.valor(), alternativa: spec.admite_alternativa === false ? "two-sided" : alternativa };
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
    errorHost.replaceChildren();
    try {
      const datos = await api.post("/api/inferencia", payload, { senal: controlador.signal });
      resultado = datos;
      specActual = spec;
      renderBarra(spec);
      abrirResultadosVentana(spec, datos);
      if (ventanasAbiertas().some((v) => v.id === "inf-grafico")) abrirGraficoVentana(spec, datos, { enfocar: false });
      if (ventanasAbiertas().some((v) => v.id === "inf-tabla")) abrirDetalleVentana(spec, datos, { enfocar: false });
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
        const enCampo = errorEnCampo(error, { ...campos, alfa: campoAlfa });
        errorHost.replaceChildren(
          alerta({
            tipo: "error",
            titulo: error.tipo === "timeout" ? "El cálculo tardó demasiado" : enCampo ? "Revisa el campo marcado" : "Revisa los datos",
            texto: textoError(error),
            acciones: [boton("Reintentar", { variante: "secundario", pequeno: true, icono: "actualizar", onClick: ejecutar })],
          })
        );
        anunciar(`Error: ${error.message}`);
      }
    } finally {
      botonEjecutar.cargando(false);
    }
  }

  /* ------------------------- ventanas emergentes ------------------------- */

  function configGrafico(datos) {
    if (!datos.curva) return null;
    const curva = datos.curva;
    const xs = curva.x.map(Number).filter(Number.isFinite);
    if (!xs.length) return null;
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);
    const regiones = [];
    const bajo = curva.critico_bajo === null || curva.critico_bajo === undefined ? null : Number(curva.critico_bajo);
    const alto = curva.critico_alto === null || curva.critico_alto === undefined ? null : Number(curva.critico_alto);
    if (curva.region === "izquierda" && bajo !== null) regiones.push({ desde: xmin, hasta: bajo, etiqueta: "rechazo (α)" });
    else if (curva.region === "derecha" && alto !== null) regiones.push({ desde: alto, hasta: xmax, etiqueta: "rechazo (α)" });
    else if (curva.region === "bilateral" && bajo !== null && alto !== null) {
      regiones.push({ desde: xmin, hasta: bajo, etiqueta: "α/2" });
      regiones.push({ desde: alto, hasta: xmax, etiqueta: "α/2" });
    }
    const estadistico = Number(curva.estadistico ?? datos.estadistico);
    const dentro = Number.isFinite(estadistico) && estadistico >= xmin && estadistico <= xmax;
    const simbolo = curva.etiqueta || datos.simbolo || "estadístico";
    return {
      series: [{ nombre: `Distribución nula: ${nombreNula(curva)}${curva.aproximada ? " (aproximación)" : ""}`, x: curva.x, y: curva.y, color: "var(--grafico-2)", relleno: true, trazo: "" }],
      regiones,
      marcador: dentro ? { x: estadistico, etiqueta: `${simbolo} = ${fmtNum(estadistico)}` } : null,
      fueraDeRango: Number.isFinite(estadistico) && !dentro ? estadistico : null,
      xlabel: `Estadístico de prueba (${simbolo})`,
      ylabel: "Densidad bajo H₀",
      altura: 320,
      yCero: true,
      ariaLabel: `Distribución ${nombreNula(curva)} del estadístico bajo la hipótesis nula, con la región de rechazo sombreada`,
      descripcion: `Estadístico observado ${simbolo} = ${fmtNum(estadistico)}. ${datos.rechaza ? "Cae en la región de rechazo." : "No cae en la región de rechazo."}`,
    };
  }

  function etiquetaIntervalo(datos) {
    const nivel = fmtPorcentaje(datos.intervalo_nivel ?? 1 - datos.alfa);
    const tipo = datos.alternativa && datos.alternativa !== "two-sided" ? "cota unilateral" : "intervalo";
    return `${tipo} al ${nivel}${datos.intervalo_de ? ` para ${datos.intervalo_de}` : ""}`;
  }

  function resumenTexto(spec, datos) {
    const simbolo = datos.simbolo || "Estadístico";
    return [
      `${spec.nombre} (${datos.metodo})`,
      datos.hipotesis ? `H₀: ${datos.hipotesis.h0}   H₁: ${datos.hipotesis.h1}` : "",
      `${simbolo} = ${fmtPreciso(datos.estadistico)}`,
      `p-valor = ${fmtP(datos.p_valor)}${datos.exacta ? " (prueba exacta)" : ""}`,
      `α = ${fmtNum(datos.alfa)}`,
      datos.gl !== null && datos.gl !== undefined ? `Grados de libertad: ${textoGl(datos, 4)}` : "",
      datos.intervalo ? `${etiquetaIntervalo(datos)}: ${fmtIntervalo(datos.intervalo)}` : "",
      `Conclusión: ${datos.conclusion}`,
      interpretarEfecto(datos.extras) || "",
      ...(datos.avisos || []).map((a) => `Aviso: ${a}`),
    ].filter(Boolean).join("\n");
  }

  function abrirGraficoVentana(spec, datos, { enfocar = true } = {}) {
    const hostGrafico = el("div");
    const cfg = configGrafico(datos);
    abrirVentana({
      id: "inf-grafico",
      titulo: `Distribución nula · ${spec.nombre}`,
      tituloCorto: "Distribución nula",
      subtitulo: cfg
        ? `Referencia: ${nombreNula(datos.curva)}${datos.curva.aproximada ? " (aproximación)" : ""}`
        : "Prueba exacta o sin distribución continua",
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      accionesCabecera: cfg
        ? [boton("PNG", { variante: "fantasma", pequeno: true, icono: "imagen", onClick: (e) => exportar(spec, datos, "png", e.currentTarget) })]
        : null,
      contenido: hostGrafico,
      pie: el(
        "div",
        { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana(spec, datos) }),
        boton("Detalle numérico", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: () => abrirDetalleVentana(spec, datos) })
      ),
    });

    if (cfg) {
      dibujar(hostGrafico, cfg);
      if (cfg.fueraDeRango !== null) {
        const lado = cfg.fueraDeRango < Number(datos.curva.x[0]) ? "a la izquierda" : "a la derecha";
        hostGrafico.append(
          el("p", { class: "texto-tenue texto-pequeno" },
            `El estadístico observado (${fmtNum(cfg.fueraDeRango)}) queda fuera del rango dibujado, ${lado}: ` +
            (datos.rechaza ? "muy dentro de la región de rechazo." : "en la cola opuesta a la región de rechazo."))
        );
      }
    } else {
      hostGrafico.append(
        alerta({
          tipo: "info",
          texto: datos.exacta
            ? "Esta prueba es exacta: el p-valor se obtiene enumerando la distribución discreta del estadístico, sin curva continua de referencia."
            : "Esta prueba no tiene una distribución nula continua que dibujar; la decisión se basa en el p-valor.",
        })
      );
    }
  }

  function abrirDetalleVentana(spec, datos, { enfocar = true } = {}) {
    const formula = leccion(spec.teoria)?.formula;
    const formulaNodo = el("div", { class: "formula-card" }, el("span", { class: "formula-etiqueta" }, "Estadístico de referencia"));
    const destinoFormula = el("div");
    formulaNodo.append(destinoFormula);
    if (formula) latex(destinoFormula, formula, { display: true });
    else destinoFormula.textContent = spec.h0;

    const extras = filasExtras(datos.extras);
    const cuerpo = el(
      "div",
      { class: "pila" },
      el(
        "dl",
        { class: "lista-definicion" },
        el("div", {}, el("dt", {}, datos.simbolo ? `Estadístico ${datos.simbolo}` : "Estadístico"), el("dd", {}, fmtPreciso(datos.estadistico))),
        el("div", {}, el("dt", {}, datos.exacta ? "p-valor (prueba exacta)" : "p-valor sin redondear"), el("dd", {}, fmtPreciso(datos.p_valor))),
        el("div", {}, el("dt", {}, "α"), el("dd", {}, fmtNum(datos.alfa, { decimales: 4 }))),
        datos.gl !== null && datos.gl !== undefined ? el("div", {}, el("dt", {}, "Grados de libertad"), el("dd", {}, textoGl(datos, 4))) : null,
        datos.intervalo ? el("div", {}, el("dt", {}, etiquetaIntervalo(datos)), el("dd", {}, fmtIntervalo(datos.intervalo, { decimales: 6 }))) : null,
        extras.map(([etiqueta, valor]) => el("div", {}, el("dt", {}, etiqueta), el("dd", {}, valor)))
      ),
      formulaNodo,
      el(
        "div",
        { class: "pila pila--sm" },
        el("strong", {}, "Supuestos y buenas prácticas"),
        el("p", { class: "texto-articulo" }, spec.supuestos || "Revisa independencia, escala y tamaño de muestra antes de interpretar."),
        el("p", { class: "texto-tenue texto-pequeno" }, "El p-valor es la probabilidad de observar un estadístico al menos tan extremo si H₀ fuese cierta. Rechazar H₀ no implica necesariamente un efecto grande.")
      )
    );

    abrirVentana({
      id: "inf-tabla",
      titulo: `Detalle numérico · ${spec.nombre}`,
      tituloCorto: "Detalle",
      subtitulo: "Precisión completa, tamaños de efecto, fórmula y supuestos",
      icono: "tabla",
      tipo: "tabla",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(resumenTexto(spec, datos)) }),
      ],
      contenido: cuerpo,
      pie: el(
        "div",
        { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana(spec, datos) }),
        boton("Gráfico nula", { variante: "fantasma", pequeno: true, icono: "grafico", onClick: () => abrirGraficoVentana(spec, datos) }),
        spec.teoria ? boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana(spec.teoria, { alcance: "vista" }) }) : null
      ),
    });
  }

  function abrirResultadosVentana(spec, datos, { enfocar = true } = {}) {
    const verdicto = el(
      "div",
      { class: `veredicto ${datos.rechaza ? "veredicto--rechaza" : "veredicto--conserva"}` },
      el("span", { class: "veredicto__icono" }, icono(datos.rechaza ? "circulo-check" : "info", { tamano: 20 })),
      el(
        "div",
        { class: "veredicto__cuerpo" },
        el("p", { class: "veredicto__titulo" }, datos.rechaza ? "Se rechaza H₀" : "No se rechaza H₀"),
        el("p", { class: "veredicto__texto" }, datos.conclusion),
        el("p", { class: "veredicto__p" }, `p = ${fmtP(datos.p_valor)} · α = ${fmtNum(datos.alfa, { decimales: 3 })} · ${datos.metodo}${datos.alternativa_texto ? ` · contraste ${datos.alternativa_texto}` : ""}`)
      )
    );

    const kpis = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: datos.simbolo ? `Estadístico ${datos.simbolo}` : "Estadístico", valor: fmtNum(datos.estadistico, { decimales: 5 }), detalle: datos.metodo }),
      kpi({ etiqueta: "p-valor", valor: fmtP(datos.p_valor), detalle: datos.exacta ? "prueba exacta" : "evidencia frente a H₀", tono: datos.rechaza ? "marca" : "" }),
      kpi({ etiqueta: "Grados de libertad", valor: datos.gl !== null ? textoGl(datos, 2) : "—", detalle: datos.gl === null ? "no aplica" : glDobles(datos) ? "numerador; denominador" : "distribución de referencia" }),
      datos.intervalo
        ? kpi({ etiqueta: datos.intervalo_de ? `Intervalo para ${datos.intervalo_de}` : "Intervalo", valor: fmtIntervalo(datos.intervalo, { decimales: 4 }), detalle: etiquetaIntervalo(datos) })
        : kpi({ etiqueta: "Intervalo", valor: "—", detalle: "esta prueba no lo calcula" }),
      efectoPrincipal(datos.extras)
        ? kpi({ etiqueta: "Tamaño del efecto", valor: fmtNum(efectoPrincipal(datos.extras).valor, { decimales: 4 }), detalle: interpretarEfecto(datos.extras) })
        : null
    );

    const cuerpo = el(
      "div",
      { class: "pila" },
      verdicto,
      kpis,
      el("div", { class: "chips" },
        el("span", { class: "chip chip--marca" }, `H₀: ${datos.hipotesis?.h0 || spec.h0}`),
        el("span", { class: "chip" }, `H₁: ${datos.hipotesis?.h1 || spec.h1}`)
      ),
      datos.avisos?.length
        ? el("div", { class: "pila pila--sm" }, datos.avisos.map((aviso) => alerta({ tipo: "aviso", texto: aviso })))
        : alerta({ tipo: "ok", texto: "Sin advertencias automáticas. Revisa el diseño y la independencia de las observaciones." })
    );

    const pie = el(
      "div",
      { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
      el(
        "div",
        { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
        boton("Ver gráfico", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGraficoVentana(spec, datos) }),
        boton("Detalle numérico", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirDetalleVentana(spec, datos) }),
        spec.teoria
          ? boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana(spec.teoria, { alcance: "vista" }) })
          : null
      ),
      el(
        "div",
        { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
        boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(resumenTexto(spec, datos)) }),
        ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) => exportar(spec, datos, formato, nodo), { variante: "fantasma" })
      )
    );

    abrirVentana({
      id: "inf-resultados",
      titulo: "Resultado",
      tituloCorto: spec.nombre,
      subtitulo: `${spec.nombre} · p = ${fmtP(datos.p_valor)}`,
      icono: "objetivo",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
      contenido: cuerpo,
      pie,
    });
  }

  function renderBarra(spec) {
    if (!resultado) {
      barraHost.replaceChildren();
      return;
    }
    barraHost.replaceChildren(
      barraResultados({
        icono: "inferencia",
        resumen: `${spec.nombre} · p = ${fmtP(resultado.p_valor)} · ${resultado.rechaza ? "Se rechaza H₀" : "No se rechaza H₀"}`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana(spec, resultado) }),
          boton("Gráfico nula", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGraficoVentana(spec, resultado) }),
          boton("Detalle numérico", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirDetalleVentana(spec, resultado) }),
        ],
      })
    );
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
          ["Grados de libertad", datos.gl === null || datos.gl === undefined ? "—" : glDobles(datos) ? textoGl(datos, 4) : datos.gl],
          ["Hipótesis nula", datos.hipotesis?.h0 ?? spec.h0],
          ["Hipótesis alternativa", datos.hipotesis?.h1 ?? spec.h1],
          ["Método", `${datos.metodo}${datos.exacta ? " (exacta)" : ""}`],
          ["Intervalo inferior", datos.intervalo?.[0] ?? "—"],
          ["Intervalo superior", datos.intervalo?.[1] ?? "—"],
          ["Conclusión", datos.conclusion],
        ],
      },
    ];
    const extras = filasExtras(datos.extras);
    if (extras.length) tablas.push({ nombre: "Tamaños de efecto", columnas: ["Métrica", "Valor"], filas: extras });
    if (formato === "png" && !cfg) {
      toast("Esta prueba no tiene una distribución nula que exportar como imagen.", { tipo: "aviso" });
      return;
    }
    await conCarga(botonNodo, async () => {
      try {
        await api.exportar({
          formato,
          titulo: `${spec.nombre} · AmPu 3.2`,
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
        if (!esCancelacion(error)) toast(textoError(error), { tipo: "error" });
      }
    });
  }

  /* ------------------------- selección ------------------------- */

  function seleccionar(clave, { inicial = false } = {}) {
    controlador?.abort();
    if (!inicial) cerrarVentanasPorAlcance("vista");
    prueba = clave;
    resultado = null;
    history.replaceState(null, "", `#/inferencia/${clave}`);
    const spec = pruebas.find((p) => p.clave === clave);
    specActual = spec;
    renderLista();
    formHost.replaceChildren(construirFormulario(spec));
    barraHost.replaceChildren();
    errorHost.replaceChildren();
    anunciar(`Prueba ${spec.nombre} seleccionada.`);
    if (!inicial) window.scrollTo({ top: 0, behavior: comportamientoScroll() });
  }

  renderLista();
  seleccionar(prueba, { inicial: true });

  if (transito.inferencia?.campos) {
    for (const [nombre, valor] of Object.entries(transito.inferencia.campos)) {
      campos[nombre]?.setValor(valorTexto(valor));
    }
    transito.inferencia = null;
    ejecutar();
  } else if (transito.inferencia?.prueba) {
    transito.inferencia = null;
  }

  return () => {
    if (controlador) controlador.abort();
  };
}
