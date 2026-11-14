import { VISTAS, LECCIONES_MUESTREO } from "../data.js";
import {
  el,
  panel,
  boton,
  campo,
  kpi,
  tabla,
  alerta,
  textoError,
  estadoVacio,
  toast,
  copiar,
  conCarga,
  fmtNum,
  fmtPorcentaje,
  latex,
  renderMath,
  segmentado,
  iconoBoton,
  pliegue,
  anunciar,
  botonesExportar,
  comportamientoScroll,
} from "../ui.js";
import { icono } from "../icons.js";
import { dibujar } from "../chart.js";
import { api, esCancelacion } from "../api.js";
import { cargarMeta, navegar, registrarHistorial, transito } from "../store.js";

const TIPOS_TAMANO = [
  { clave: "proporcion", nombre: "Una proporción", descripcion: "¿Qué porcentaje de la población cumple una condición?" },
  { clave: "media", nombre: "Una media", descripcion: "¿Cuál es el valor medio de una variable continua?" },
  { clave: "diferencia_medias", nombre: "Diferencia de medias", descripcion: "Compara dos grupos con variable continua." },
  { clave: "diferencia_proporciones", nombre: "Diferencia de proporciones", descripcion: "Compara dos porcentajes entre grupos." },
];

const ESTRATOS_INICIALES = [
  { nombre: "Norte", N: "400", sigma: "12", costo: "1" },
  { nombre: "Sur", N: "600", sigma: "18", costo: "1.2" },
];

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function etiquetaMetodo(clave) {
  return {
    finito: "Aleatorio simple",
    infinito: "Aleatorio con reemplazo",
    sistematico: "Sistemático",
    proporcional: "Estratificado proporcional",
    neyman: "Asignación de Neyman",
    optimo: "Asignación óptima",
    conglomerados: "Por conglomerados",
  }[clave] || clave;
}

export async function montar(host, parametro) {
  let metaDatos;
  try {
    metaDatos = await cargarMeta();
  } catch (error) {
    host.append(alerta({ tipo: "error", titulo: "El motor no responde", texto: textoError(error) }));
    return null;
  }

  const metodos = metaDatos.muestreo;
  let metodo = metodos.some((m) => m.clave === parametro) ? parametro : "finito";
  let tipoTamano = transito.muestreo?.tipoTamano || "proporcion";
  let resultadoTamano = null;
  let resultadoMuestra = null;
  let controladorTamano = null;
  let controladorMuestra = null;
  let auto = false;
  let estratos = ESTRATOS_INICIALES.map((e) => ({ ...e }));
  let nSugerido = null;

  /* =========================== 1. Tamaño =========================== */

  const contenedorTipo = el("div", { class: "rejilla rejilla--herramientas" });
  const contenedorCamposTamano = el("div", { class: "pila" });
  const resultadoTamanoHost = el("div", { "aria-live": "polite" });
  let camposTamano = {};
  const campoConfianzaTamano = campo({
    etiqueta: "Nivel de confianza",
    tipo: "select",
    valor: "0.95",
    opciones: [["0.90", "90 %"], ["0.95", "95 %"], ["0.99", "99 %"]],
  });
  const campoError = campo({
    etiqueta: "Margen de error absoluto",
    codigo: "e",
    tipo: "numero",
    valor: 0.05,
    min: 0.0001,
    ayuda: "En proporción: 0,05 = ±5 puntos porcentuales. En medias, en unidades de la variable.",
  });
  const campoPoblacionTamano = campo({
    etiqueta: "Tamaño de la población N",
    codigo: "N",
    tipo: "entero",
    valor: "",
    min: 1,
    opcional: true,
    ayuda: "Opcional. Si la población es finita, el cálculo aplica corrección por población finita.",
  });
  const botonTamano = boton("Calcular n", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
  const estadoTamano = el("span", { class: "calculando" });

  function construirCamposTamano() {
    contenedorCamposTamano.replaceChildren();
    camposTamano = {};
    const definiciones = [];
    if (tipoTamano === "proporcion") {
      definiciones.push({
        id: "p",
        etiqueta: "Proporción esperada p",
        valor: 0.5,
        min: 0.0001,
        max: 0.9999,
        ayuda: "Si no tienes una estimación previa, usa 0,5 (escenario más conservador).",
      });
    } else if (tipoTamano === "media") {
      definiciones.push({ id: "sigma", etiqueta: "Desviación estándar σ", valor: 10, min: 0.0001 });
    } else if (tipoTamano === "diferencia_medias") {
      definiciones.push({ id: "sigma1", etiqueta: "Desviación del grupo 1", valor: 10, min: 0.0001 });
      definiciones.push({ id: "sigma2", etiqueta: "Desviación del grupo 2", valor: 10, min: 0.0001 });
    } else {
      definiciones.push({ id: "p1", etiqueta: "Proporción del grupo 1", valor: 0.5, min: 0.0001, max: 0.9999 });
      definiciones.push({ id: "p2", etiqueta: "Proporción del grupo 2", valor: 0.4, min: 0.0001, max: 0.9999 });
    }
    const nodos = definiciones.map((def) => {
      const c = campo({ ...def, tipo: "numero", codigo: def.id, requerido: true });
      camposTamano[def.id] = c;
      return c.envoltura;
    });
    contenedorCamposTamano.append(
      el("div", { class: "columnas-formulario" }, nodos.length ? nodos : []),
      el(
        "div",
        { class: "rejilla rejilla--2", style: { alignItems: "end" } },
        campoConfianzaTamano.envoltura,
        campoError.envoltura
      ),
      campoPoblacionTamano.envoltura
    );
    campoPoblacionTamano.envoltura.hidden = tipoTamano.startsWith("diferencia_");
  }

  function renderTiposTamano() {
    contenedorTipo.replaceChildren();
    for (const tipo of TIPOS_TAMANO) {
      contenedorTipo.append(
        el(
          "button",
          {
            type: "button",
            class: `tarjeta-herramienta ${tipo.clave === tipoTamano ? "tarjeta-herramienta--activa" : ""}`,
            "aria-pressed": String(tipo.clave === tipoTamano),
            onClick: () => {
              tipoTamano = tipo.clave;
              resultadoTamano = null;
              resultadoTamanoHost.replaceChildren();
              renderTiposTamano();
              construirCamposTamano();
            },
          },
          el("span", { class: "tarjeta-herramienta__titulo" }, tipo.nombre),
          el("span", { class: "tarjeta-herramienta__texto" }, tipo.descripcion)
        )
      );
    }
  }

  function validarTamano() {
    let ok = true;
    for (const [id, c] of Object.entries(camposTamano)) {
      c.limpiarError();
      const valor = c.valor();
      const min = id === "p" || id.startsWith("p") ? 0 : 0.0000001;
      if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= min) {
        c.setError(id === "p" || id.startsWith("p") ? "Debe estar estrictamente entre 0 y 1." : "Debe ser mayor que cero.");
        ok = false;
      }
      if ((id === "p" || id.startsWith("p")) && valor >= 1) {
        c.setError("Debe estar estrictamente entre 0 y 1.");
        ok = false;
      }
    }
    campoError.limpiarError();
    campoPoblacionTamano.limpiarError();
    const error = campoError.valor();
    const proporcion = tipoTamano.includes("proporcion");
    if (typeof error !== "number" || !Number.isFinite(error) || error <= 0 || (proporcion && error >= 1)) {
      campoError.setError(proporcion ? "El margen debe estar entre 0 y 1 (por ejemplo, 0,05)." : "El margen debe ser mayor que cero, en unidades de la variable.");
      ok = false;
    }
    const N = tipoTamano.startsWith("diferencia_") ? null : campoPoblacionTamano.valor();
    if (N !== null && (typeof N !== "number" || !Number.isInteger(N) || N < 1)) {
      campoPoblacionTamano.setError("N debe ser un entero positivo.");
      ok = false;
    }
    return ok;
  }

  async function calcularTamano() {
    if (!validarTamano()) {
      toast("Revisa los parámetros del tamaño muestral", { tipo: "error" });
      return;
    }
    if (controladorTamano) controladorTamano.abort();
    controladorTamano = new AbortController();
    botonTamano.cargando(true);
    estadoTamano.replaceChildren(el("span", { class: "pulso" }), "Calculando…");
    const N = tipoTamano.startsWith("diferencia_") ? null : campoPoblacionTamano.valor();
    const payload = {
      tipo: tipoTamano,
      confianza: Number(campoConfianzaTamano.valor()),
      error: campoError.valor(),
      N: N ?? null,
    };
    for (const [id, c] of Object.entries(camposTamano)) payload[id] = c.valor();
    try {
      const datos = await api.post("/api/muestreo/tamano", payload, { senal: controladorTamano.signal });
      resultadoTamano = datos;
      nSugerido = datos.n;
      renderResultadoTamano(payload, datos);
      estadoTamano.replaceChildren("Calculado");
      anunciar(`Tamaño muestral recomendado: ${datos.n}.`);
    } catch (error) {
      if (!esCancelacion(error)) {
        resultadoTamanoHost.replaceChildren(alerta({ tipo: "error", titulo: "No se pudo calcular n", texto: textoError(error) }));
      }
      estadoTamano.replaceChildren("");
    } finally {
      botonTamano.cargando(false);
    }
  }

  function renderResultadoTamano(payload, datos) {
    const nodoFormula = el("div", { class: "formula-card" }, el("span", { class: "formula-etiqueta" }, "Expresión del tamaño"));
    const destino = el("div");
    nodoFormula.append(destino);
    latex(destino, datos.formula, { display: true });
    const conPoblacion = payload.N !== null && payload.N !== undefined;
    const porGrupo = payload.tipo.startsWith("diferencia_");
    resultadoTamanoHost.replaceChildren(
      panel({
        titulo: "Muestra recomendada",
        subtitulo: porGrupo ? "Tamaño por grupo para dos muestras independientes." : conPoblacion ? "Con corrección por población finita." : "Población infinita o muy grande.",
        icono: "objetivo",
        acciones: [
          boton("Usar este n", {
            variante: "secundario",
            pequeno: true,
            icono: "descargar",
            onClick: () => {
              // n cuenta unidades: no trasladarlo como cantidad de conglomerados.
              if (metodo === "conglomerados") {
                metodo = "finito";
                history.replaceState(null, "", "#/muestreo/finito");
                construirFormularioMuestra();
              }
              fijarNAutomatico(false);
              camposMuestra.n.setValor(datos.n);
              camposMuestra.n.limpiarError();
              if (conPoblacion && !camposMuestra.N.control.disabled) camposMuestra.N.setValor(payload.N);
              resultadoMuestra = null;
              renderResultadoMuestraVacio();
              estadoMuestra.replaceChildren();
              actualizarResumen();
              toast(`n = ${datos.n} trasladado al diseño de selección.`, { tipo: "ok" });
              document.querySelector(".seccion-seleccion")?.scrollIntoView({ behavior: comportamientoScroll(), block: "start" });
            },
          }),
        ],
        contenido: el(
          "div",
          { class: "pila" },
          el("div", { class: "numero-grande" }, fmtNum(datos.n, { entero: true })),
          el("p", { class: "texto-tenue texto-pequeno" }, porGrupo ? "unidades necesarias en cada grupo." : "unidades necesarias para el margen y la confianza solicitados."),
          kpi({ etiqueta: "Confianza", valor: fmtPorcentaje(datos.confianza), detalle: "nivel elegido" }),
          nodoFormula,
          alerta({ tipo: "info", texto: `Con ${fmtPorcentaje(datos.confianza)} de confianza y un margen de ${fmtNum(datos.error, { decimales: 3 })}, necesitas al menos ${datos.n} unidades${porGrupo ? " en cada grupo" : ""}. Redondea siempre hacia arriba y ajusta por no respuesta si procede.` })
        ),
      })
    );
    renderMath(resultadoTamanoHost);
  }

  botonTamano.addEventListener("click", calcularTamano);

  const panelTamano = panel({
    titulo: "1 · ¿Cuántas unidades necesito?",
    subtitulo: "Dimensiona la muestra antes de seleccionarla. El margen y la confianza determinan el esfuerzo de campo.",
    icono: "calculadora",
    contenido: el(
      "div",
      { class: "pila" },
      contenedorTipo,
      contenedorCamposTamano,
      el("div", { class: "fila" }, botonTamano, estadoTamano),
      resultadoTamanoHost,
      pliegue({
        titulo: "Supuestos del cálculo",
        contenido: el(
          "div",
          { class: "pila pila--sm" },
          el("p", { class: "texto-articulo" }, "Fórmula normal aproximada para proporciones o medias. Para proporciones se usa el escenario más desfavorable si no hay estimación previa. El resultado no incluye ajustes por no respuesta ni por diseño complejo."),
          boton("Teoría del tamaño muestral", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => navegar(`teoria/${tipoTamano === "media" ? "tamano_media" : tipoTamano === "proporcion" ? "tamano_proporcion" : "tamano_diferencia"}`) })
        ),
      })
    ),
  });

  /* =========================== 2. Selección =========================== */

  const selectorMetodos = el("div", { class: "rejilla rejilla--herramientas" });
  const camposMetodo = el("div", { class: "pila" });
  const resultadoMuestraHost = el("div", { "aria-live": "polite" });
  const resumenDiseno = el("div", { class: "barra-suma" });
  let camposMuestra = {};
  let campoNAuto = null;
  const tablaEstratos = el("div", { class: "tabla-datos-editor" });
  const contadorEstratos = el("span", { class: "chip" }, "0 grupos");
  const botonMuestra = boton("Sortear muestra", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
  const estadoMuestra = el("span", { class: "calculando" });

  function renderMetodos() {
    selectorMetodos.replaceChildren();
    for (const m of metodos) {
      selectorMetodos.append(
        el(
          "button",
          {
            type: "button",
            class: `tarjeta-herramienta ${m.clave === metodo ? "tarjeta-herramienta--activa" : ""}`,
            "aria-pressed": String(m.clave === metodo),
            onClick: () => {
              metodo = m.clave;
              resultadoMuestra = null;
              resultadoMuestraHost.replaceChildren();
              history.replaceState(null, "", `#/muestreo/${m.clave}`);
              construirFormularioMuestra();
            },
          },
          el("span", { class: "tarjeta-herramienta__titulo" }, m.nombre),
          el("span", { class: "tarjeta-herramienta__texto" }, m.descripcion)
        )
      );
    }
  }

  function totalEstratos() {
    return estratos.reduce((acc, e) => acc + (Number(e.N) || 0), 0);
  }

  function renderTablaEstratos() {
    const esConglomerado = metodo === "conglomerados";
    tablaEstratos.replaceChildren(
      el(
        "div",
        { class: "fila-estrato fila-estrato--cabecera" },
        el("span", {}, esConglomerado ? "Conglomerado" : "Estrato"),
        el("span", {}, esConglomerado ? "Unidades" : "Tamaño N"),
        el("span", {}, "σ"),
        esConglomerado ? el("span") : el("span", {}, "Coste"),
        el("span")
      )
    );
    const celda = (control, etiqueta) => el("label", { class: "celda-estrato" },
      el("span", { class: "celda-estrato__etiqueta" }, etiqueta), control
    );
    estratos.forEach((estrato, indice) => {
      const nombre = el("input", {
        type: "text",
        value: estrato.nombre,
        "aria-label": `Nombre del ${esConglomerado ? "conglomerado" : "estrato"} ${indice + 1}`,
        onInput: (e) => {
          estrato.nombre = e.target.value;
          actualizarResumen();
        },
      });
      const tamano = el("input", {
        type: "text",
        inputMode: "numeric",
        value: estrato.N,
        "aria-label": `Tamaño del grupo ${indice + 1}`,
        onInput: (e) => {
          estrato.N = e.target.value;
          actualizarResumen();
        },
      });
      const sigma = el("input", {
        type: "text",
        inputMode: "decimal",
        value: estrato.sigma,
        "aria-label": `Desviación del grupo ${indice + 1}`,
        onInput: (e) => {
          estrato.sigma = e.target.value;
        },
      });
      const costo = el("input", {
        type: "text",
        inputMode: "decimal",
        value: estrato.costo,
        "aria-label": `Coste del grupo ${indice + 1}`,
        onInput: (e) => {
          estrato.costo = e.target.value;
        },
      });
      const quitar = iconoBoton("basura", {
        etiqueta: `Eliminar ${estrato.nombre || "grupo"}`,
        onClick: () => {
          if (estratos.length <= 1) {
            toast("Necesitas al menos un grupo.", { tipo: "aviso" });
            return;
          }
          estratos.splice(indice, 1);
          renderTablaEstratos();
          actualizarResumen();
        },
      });
      tablaEstratos.append(
        el("div", { class: "fila-estrato" },
          celda(nombre, esConglomerado ? "Conglomerado" : "Estrato"), celda(tamano, "Tamaño N"),
          esConglomerado ? el("span", { class: "celda-estrato--vacia" }) : celda(sigma, "Desviación σ"),
          esConglomerado ? el("span", { class: "celda-estrato--vacia" }) : celda(costo, "Coste"), quitar
        )
      );
    });
    contadorEstratos.textContent = `${estratos.length} ${esConglomerado ? "conglomerados" : "estratos"}`;
  }

  function construirFormularioMuestra() {
    const semillaAnterior = camposMuestra.semilla?.valor() ?? transito.muestreo?.semilla ?? 42;
    renderMetodos();
    const spec = metodos.find((m) => m.clave === metodo);
    camposMuestra = {};
    const esEstratificado = ["proporcional", "neyman", "optimo", "conglomerados"].includes(metodo);
    const esConglomerado = metodo === "conglomerados";
    if (esConglomerado) auto = false;
    const N = campo({
      etiqueta: "Población N",
      codigo: "N",
      tipo: "entero",
      valor: esEstratificado ? String(totalEstratos()) : "1000",
      min: 1,
      max: 1000000,
      requerido: true,
      deshabilitado: esEstratificado,
      ayuda: esEstratificado ? "Se calcula sumando los grupos." : "Universo del que se extrae la muestra.",
    });
    const n = campo({
      etiqueta: esConglomerado ? "Conglomerados a elegir" : spec.campo_n || "Unidades a extraer",
      codigo: "n",
      tipo: "entero",
      valor: esConglomerado ? String(Math.min(estratos.length, 2)) : nSugerido ? String(nSugerido) : "100",
      min: 1,
      max: 999999,
      requerido: !auto,
      deshabilitado: auto,
      ayuda: "Introduce n o usa el tamaño del paso 1.",
    });
    const semilla = campo({
      etiqueta: "Semilla aleatoria",
      codigo: "semilla",
      tipo: "entero",
      valor: semillaAnterior,
      min: 0,
      max: 999999999,
      ayuda: "La misma semilla y los mismos parámetros reproducen exactamente la muestra.",
    });
    camposMuestra = { N, n, semilla };

    campoNAuto = campo({
      etiqueta: "Calcular n automáticamente",
      tipo: "checkbox",
      valor: auto,
      ayuda: "Usa p = 0,5, margen ±5 puntos porcentuales y confianza del 95 %. Para otros valores, usa el paso 1.",
    });
    campoNAuto.control.addEventListener("change", () => fijarNAutomatico(campoNAuto.valor()));
    fijarNAutomatico(auto);

    const campoPorGrupo = esConglomerado
      ? campo({
          etiqueta: "Unidades por conglomerado (opcional)",
          codigo: "n_por_grupo",
          tipo: "entero",
          valor: "",
          min: 1,
          opcional: true,
          ayuda: "Vacío = encuestar todas las unidades del conglomerado. Con valor = muestreo en dos etapas.",
        })
      : null;
    if (campoPorGrupo) camposMuestra.n_por_grupo = campoPorGrupo;

    camposMetodo.replaceChildren();
    if (esEstratificado) {
      renderTablaEstratos();
      camposMetodo.append(
        el("div", { class: "pila" }, el("div", { class: "fila fila--entre" }, el("span", { class: "campo__etiqueta" }, esConglomerado ? "Conglomerados" : "Estratos"), contadorEstratos), tablaEstratos, boton("Añadir grupo", { variante: "fantasma", pequeno: true, icono: "mas", onClick: () => {
          estratos.push({ nombre: `Grupo ${estratos.length + 1}`, N: "200", sigma: "10", costo: "1" });
          renderTablaEstratos();
          actualizarResumen();
        } })),
        el("div", { class: "rejilla rejilla--2" }, N.envoltura, n.envoltura)
      );
    } else {
      camposMetodo.append(el("div", { class: "columnas-formulario" }, N.envoltura, n.envoltura));
    }
    if (!esConglomerado) camposMetodo.append(campoNAuto.envoltura);
    if (campoPorGrupo) camposMetodo.append(el("div", { class: "columnas-formulario" }, campoPorGrupo.envoltura));
    camposMetodo.append(
      el("div", { class: "columnas-formulario" }, semilla.envoltura),
      el("div", { class: "fila fila--entre" }, el("div", { class: "fila" }, botonMuestra, boton("Nueva semilla", { variante: "secundario", icono: "actualizar", onClick: () => {
        semilla.setValor(String(Math.floor(Math.random() * 999999)));
        if (resultadoMuestra) ejecutarMuestra();
      } })), estadoMuestra),
      resumenDiseno
    );
    N.control.addEventListener("input", actualizarResumen);
    n.control.addEventListener("input", actualizarResumen);
    actualizarResumen();
    renderResultadoMuestraVacio();
  }

  function fijarNAutomatico(valor) {
    auto = Boolean(valor) && metodo !== "conglomerados";
    campoNAuto?.setValor(auto);
    camposMuestra.n.control.disabled = auto;
    camposMuestra.n.control.setAttribute("aria-required", String(!auto));
    camposMuestra.n.envoltura.classList.toggle("campo--deshabilitado", auto);
    actualizarResumen();
  }

  function actualizarResumen() {
    const N = numero(camposMuestra.N?.texto()) ?? totalEstratos();
    const n = auto && metodo !== "conglomerados" ? null : numero(camposMuestra.n?.texto());
    const esEstratificado = ["proporcional", "neyman", "optimo", "conglomerados"].includes(metodo);
    if (camposMuestra.N && esEstratificado) {
      camposMuestra.N.setValor(String(totalEstratos()));
    }
    const poblacion = esEstratificado ? totalEstratos() : N;
    resumenDiseno.replaceChildren(
      el("span", {}, "Población"),
      el("strong", {}, fmtNum(poblacion, { entero: true })),
      el("span", {}, "Muestra"),
      el("strong", {}, n ? fmtNum(n, { entero: true }) : "automática"),
      el("span", {}, n && poblacion ? `tasa ${fmtPorcentaje(n / poblacion, 1)}` : "define el diseño")
    );
    resumenDiseno.dataset.valido = String(Boolean(poblacion) && (Boolean(n) || auto));
  }

  function validarMuestra() {
    const esEstratificado = ["proporcional", "neyman", "optimo", "conglomerados"].includes(metodo);
    if (esEstratificado) {
      if (!estratos.length) {
        toast("Añade al menos un grupo.", { tipo: "error" });
        return false;
      }
      const nombres = new Set();
      for (let i = 0; i < estratos.length; i++) {
        const e = estratos[i];
        if (!e.nombre.trim()) {
          toast(`El grupo ${i + 1} necesita un nombre.`, { tipo: "error" });
          return false;
        }
        if (nombres.has(e.nombre.trim().toLocaleLowerCase("es"))) {
          toast("Los nombres de los grupos deben ser únicos.", { tipo: "error" });
          return false;
        }
        nombres.add(e.nombre.trim().toLocaleLowerCase("es"));
        const tam = numero(e.N);
        if (tam === null || !Number.isInteger(tam) || tam < 1) {
          toast(`El tamaño de «${e.nombre}» debe ser un entero positivo.`, { tipo: "error" });
          return false;
        }
        if (metodo !== "conglomerados" && (numero(e.sigma) === null || numero(e.sigma) <= 0)) {
          toast(`La desviación de «${e.nombre}» debe ser mayor que cero.`, { tipo: "error" });
          return false;
        }
        if (metodo === "optimo" && (numero(e.costo) === null || numero(e.costo) <= 0)) {
          toast(`El coste de «${e.nombre}» debe ser mayor que cero.`, { tipo: "error" });
          return false;
        }
      }
    }
    let ok = true;
    for (const [id, c] of Object.entries(camposMuestra)) {
      c.limpiarError();
      if (id === "n" && auto) continue;
      const texto = c.texto();
      if (!texto && (id === "n_por_grupo")) continue;
      const valor = c.valor();
      const minimo = id === "semilla" ? 0 : 1;
      if (typeof valor !== "number" || !Number.isInteger(valor) || valor < minimo) {
        c.setError(minimo === 0 ? "Introduce un entero no negativo." : "Introduce un entero mayor o igual que 1.");
        ok = false;
      }
    }
    if (!ok) return false;
    const N = esEstratificado ? totalEstratos() : numero(camposMuestra.N.texto());
    const n = auto ? null : numero(camposMuestra.n.texto());
    if (["finito", "sistematico"].includes(metodo) && n !== null && N !== null && n > N) {
      camposMuestra.n.setError(`n no puede superar N (${N}).`);
      return false;
    }
    if (metodo === "conglomerados" && n !== null && n > estratos.length) {
      camposMuestra.n.setError(`Solo hay ${estratos.length} conglomerados; elige como máximo esa cantidad.`);
      return false;
    }
    return true;
  }

  async function ejecutarMuestra() {
    if (!validarMuestra()) {
      toast("Revisa el diseño de la muestra", { tipo: "error" });
      return;
    }
    if (controladorMuestra) controladorMuestra.abort();
    controladorMuestra = new AbortController();
    botonMuestra.cargando(true);
    estadoMuestra.replaceChildren(el("span", { class: "pulso" }), "Sorteando…");
    const esEstratificado = ["proporcional", "neyman", "optimo", "conglomerados"].includes(metodo);
    const payload = {
      metodo,
      N: esEstratificado ? totalEstratos() : numero(camposMuestra.N.texto()),
      n: auto ? 100 : numero(camposMuestra.n.texto()),
      semilla: numero(camposMuestra.semilla.texto()),
      auto: Boolean(auto && metodo !== "conglomerados"),
      p: 0.5,
      error: 0.05,
      confianza: 0.95,
      estratos: esEstratificado
        ? estratos.map((e) => ({
            nombre: e.nombre.trim(),
            N: numero(e.N),
            sigma: metodo === "conglomerados" ? 1 : numero(e.sigma),
            costo: numero(e.costo) || 1,
          }))
        : [],
      n_por_grupo: metodo === "conglomerados" && camposMuestra.n_por_grupo?.texto() ? numero(camposMuestra.n_por_grupo.texto()) : null,
    };
    try {
      const datos = await api.post("/api/muestreo", payload, { senal: controladorMuestra.signal });
      resultadoMuestra = datos;
      renderResultadoMuestra(datos);
      estadoMuestra.replaceChildren("Sorteada");
      registrarHistorial({
        titulo: `Muestreo · ${etiquetaMetodo(metodo)}`,
        detalle: `${datos.total_muestra} de ${datos.total_poblacion} · semilla ${datos.semilla}`,
        ruta: `muestreo/${metodo}`,
        tipo: "muestreo",
        icono: "muestreo",
      });
      anunciar(`Muestra de ${datos.total_muestra} unidades generada.`);
    } catch (error) {
      if (!esCancelacion(error)) {
        resultadoMuestraHost.replaceChildren(alerta({ tipo: "error", titulo: "No se pudo generar la muestra", texto: textoError(error) }));
      }
      estadoMuestra.replaceChildren("");
    } finally {
      botonMuestra.cargando(false);
    }
  }

  botonMuestra.addEventListener("click", ejecutarMuestra);

  function renderResultadoMuestraVacio() {
    if (resultadoMuestra) return;
    resultadoMuestraHost.replaceChildren(
      panel({
        titulo: "Sin muestra todavía",
        icono: "info",
        contenido: estadoVacio({
          icono: "muestreo",
          titulo: "Define el diseño y sortea",
          texto: "Configura la población, el tamaño y la semilla. La vista mostrará la asignación por grupo, las unidades seleccionadas y la tasa de muestreo.",
        }),
      })
    );
  }

  function renderResultadoMuestra(datos) {
    const hostGrafico = el("div");
    setTimeout(() => {
      dibujar(hostGrafico, {
        tipo: "barras",
        categorias: datos.etiquetas,
        series: [
          { nombre: "Población", x: datos.etiquetas.map((_, i) => i), y: datos.poblacion, tipo: "barra", color: "var(--grafico-2)" },
          { nombre: "Selección", x: datos.etiquetas.map((_, i) => i), y: datos.seleccion, tipo: "barra", color: "var(--grafico-1)" },
        ],
        ylabel: "Unidades",
        altura: 270,
        yCero: true,
        ariaLabel: "Población y muestra por grupo",
      });
    }, 0);

    const kpis = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: "Población", valor: fmtNum(datos.total_poblacion, { entero: true }), detalle: `${datos.etiquetas.length} grupo${datos.etiquetas.length === 1 ? "" : "s"}`, tono: "marca" }),
      kpi({ etiqueta: "Muestra", valor: fmtNum(datos.total_muestra, { entero: true }), detalle: "unidades extraídas" }),
      kpi({ etiqueta: "Tasa", valor: fmtPorcentaje(datos.total_muestra / datos.total_poblacion, 2), detalle: "fracción de muestreo" }),
      kpi({ etiqueta: "Semilla", valor: String(datos.semilla), detalle: "reproducible" })
    );

    const nombresTablas = Object.keys(datos.tablas || {});
    let tablaActiva = nombresTablas[0];
    const hostTabla = el("div");
    const selectorTablas = nombresTablas.length > 1 ? segmentado({
      etiqueta: "Tabla",
      valor: tablaActiva,
      opciones: nombresTablas.map((n) => [n, n]),
      onCambio: (valor) => {
        tablaActiva = valor;
        pintarTabla();
      },
    }) : null;

    function pintarTabla() {
      const t = datos.tablas[tablaActiva];
      if (!t) {
        hostTabla.replaceChildren(el("p", { class: "tabla-vacia" }, "Sin tabla para este diseño."));
        return;
      }
      hostTabla.replaceChildren(
        tabla({
          columnas: t.columnas,
          filas: t.filas,
          total: t.total ?? t.filas.length,
          truncada: t.truncada,
          maximo: 300,
          nota: `Tabla «${tablaActiva}». Exporta a Excel para ver todas las filas.`,
        })
      );
    }
    pintarTabla();

    const panelResumen = panel({
      titulo: "Diseño ejecutado",
      subtitulo: datos.resumen,
      icono: "muestreo",
      acciones: [
        boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(`${datos.resumen}\nSemilla: ${datos.semilla}`) }),
        ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) => exportarMuestra(datos, formato, nodo)),
      ],
      contenido: el("div", { class: "pila" }, kpis, alerta({ tipo: "info", texto: "La semilla hace reproducible la selección. Guárdala junto al informe para poder auditar el sorteo." })),
    });

    resultadoMuestraHost.replaceChildren(
      el(
        "div",
        { class: "pila" },
        panelResumen,
        el(
          "div",
          { class: "rejilla rejilla--2" },
          panel({ titulo: "Composición de la muestra", icono: "grafico", contenido: hostGrafico }),
          panel({ titulo: "Unidades seleccionadas", icono: "tabla", contenido: el("div", { class: "pila" }, selectorTablas, hostTabla) })
        )
      )
    );
  }

  async function exportarMuestra(datos, formato, botonNodo) {
    const tablas = Object.entries(datos.tablas || {}).map(([nombre, t]) => ({ nombre, columnas: t.columnas, filas: t.filas }));
    await conCarga(botonNodo, async () => {
      try {
        await api.exportar({
          formato,
          titulo: `Muestreo · ${etiquetaMetodo(metodo)}`,
          resumen: `${datos.resumen}\nSemilla: ${datos.semilla}\nPoblación: ${datos.total_poblacion}\nMuestra: ${datos.total_muestra}`,
          tablas,
          figura: {
            series: [
              { nombre: "Población", x: datos.etiquetas.map((_, i) => i), y: datos.poblacion, tipo: "barra" },
              { nombre: "Selección", x: datos.etiquetas.map((_, i) => i), y: datos.seleccion, tipo: "barra" },
            ],
            categorias: datos.etiquetas,
            titulo: "Población y muestra",
            ylabel: "Unidades",
          },
          vista: "muestreo",
          estado: { metodo, N: datos.total_poblacion, n: datos.total_muestra, semilla: datos.semilla, estratos },
        });
        toast(`Archivo ${formato.toUpperCase()} generado`, { tipo: "ok" });
      } catch (error) {
        if (!esCancelacion(error)) toast(textoError(error), { tipo: "error" });
      }
    });
  }

  /* =========================== montaje =========================== */

  const panelSeleccion = panel({
    titulo: "2 · Selecciona la muestra",
    icono: "muestreo",
    clase: "seccion-seleccion",
    contenido: el("div", { class: "pila" }, selectorMetodos, camposMetodo, resultadoMuestraHost),
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
          el("span", { class: "ceja" }, "Diseñar · Muestreo"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("muestreo", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Diseño y selección de muestras")
          ),
          el(
            "p",
            { class: "vista__subtitulo" },
            VISTAS.muestreo.subtitulo
          )
        ),
        el(
          "div",
          { class: "vista__acciones" },
          boton("Repasar muestreo", { variante: "secundario", icono: "teoria", onClick: () => navegar(`teoria/${LECCIONES_MUESTREO[metodo]}`) })
        )
      ),
      panelTamano,
      panelSeleccion
    )
  );

  renderTiposTamano();
  construirCamposTamano();
  construirFormularioMuestra();

  return () => {
    if (controladorTamano) controladorTamano.abort();
    if (controladorMuestra) controladorMuestra.abort();
  };
}
