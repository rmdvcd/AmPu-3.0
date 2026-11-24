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
  toast,
  copiar,
  conCarga,
  fmtNum,
  fmtPorcentaje,
  fmtEnteroGrande,
  errorEnCampo,
  textoError,
  avisosMotor,
  latex,
  segmentado,
  iconoBoton,
  anunciar,
  botonesExportar,
} from "../ui.js";
import { icono } from "../icons.js";
import { dibujar } from "../chart.js";
import { api, esCancelacion } from "../api.js";
import { leerNumero, leerSerie } from "../entrada.js";
import { cargarMeta, registrarHistorial } from "../store.js";
import { abrirVentana, cerrarVentanasPorAlcance, ventanasAbiertas, barraResultados } from "../ventanas.js";
import { abrirTeoriaVentana } from "../teoria_dialogo.js";

const HERRAMIENTAS = [
  { clave: "combinatoria", nombre: "Combinatoria", descripcion: "Factoriales, permutaciones y combinaciones exactas.", icono: "calculadora", teoria: "combinatoria" },
  { clave: "condicional", nombre: "Condicional", descripcion: "P(A|B), independencia y probabilidad conjunta.", icono: "condicional", teoria: "bayes" },
  { clave: "bayes", nombre: "Teorema de Bayes", descripcion: "Actualiza hipótesis con evidencia nueva.", icono: "objetivo", teoria: "bayes" },
  { clave: "variable", nombre: "Variable discreta", descripcion: "Esperanza, varianza y momentos de una PMF.", icono: "distribuciones", teoria: "uniforme_discreta" },
];

async function exportarProbabilidad(botonNodo, payload, formato = "pdf") {
  await conCarga(botonNodo, async () => {
    try {
      await api.exportar({ formato, vista: "probabilidad", ...payload });
      toast(`Archivo ${formato.toUpperCase()} generado`, { tipo: "ok" });
    } catch (error) {
      if (!esCancelacion(error)) toast(textoError(error), { tipo: "error" });
    }
  });
}

const SUPER = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const superindice = (n) => String(n).replace(/[-\d]/g, (c) => SUPER[c]);

function conExacto(valor, exacto, opciones = { decimales: 6 }) {
  const texto = fmtNum(valor, opciones);
  if (!exacto || !String(exacto).includes("/")) return texto;
  return el("span", {}, texto, " ", el("span", { class: "valor-exacto" }, `= ${exacto}`));
}

function zonaErrores() {
  const nodo = el("p", { class: "campo__error", role: "alert" });
  let marcada = null;
  return {
    nodo,
    limpiar() {
      nodo.textContent = "";
      if (marcada) {
        marcada.removeAttribute("aria-invalid");
        marcada.removeAttribute("aria-describedby");
        marcada = null;
      }
    },
    mostrar(mensaje, entrada = null) {
      this.limpiar();
      nodo.textContent = mensaje;
      if (!nodo.id) nodo.id = `error-tabla-${Math.random().toString(36).slice(2, 8)}`;
      if (entrada) {
        marcada = entrada;
        entrada.setAttribute("aria-invalid", "true");
        entrada.setAttribute("aria-describedby", nodo.id);
        entrada.focus();
      }
      anunciar(`Error: ${mensaje}`);
    },
  };
}

function leerProbabilidad(texto) {
  const lectura = leerNumero(texto, { fraccion: true });
  if (lectura.vacio) return { valor: null, error: "Falta este valor." };
  if (lectura.error) return { valor: null, error: `${lectura.error.mensaje} ${lectura.error.sugerencia || ""}`.trim() };
  if (lectura.valor < 0 || lectura.valor > 1) return { valor: lectura.valor, error: "Una probabilidad debe estar entre 0 y 1." };
  return { valor: lectura.valor, error: null };
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const lectura = leerNumero(valor, { fraccion: true });
  return lectura.error || lectura.vacio ? null : lectura.valor;
}

function bloqueFormula(latexTexto, etiqueta = "Fórmula") {
  const nodo = el("div", { class: "formula-card" }, el("span", { class: "formula-etiqueta" }, etiqueta));
  const destino = el("div");
  nodo.append(destino);
  latex(destino, latexTexto, { display: true });
  return nodo;
}

/* ================================================================== */
/* Combinatoria                                                       */
/* ================================================================== */

function herramientaCombinatoria() {
  let tipo = "combinaciones";
  let resultado = null;

  const campoN = campo({ etiqueta: "Número total n", codigo: "n", tipo: "entero", valor: 49, min: 0, requerido: true });
  const campoK = campo({ etiqueta: "Elementos elegidos k", codigo: "k", tipo: "entero", valor: 6, min: 0, requerido: true });
  const campoConteos = campo({
    etiqueta: "Conteos por grupo",
    codigo: "conteos",
    tipo: "serie",
    filas: 1,
    nombre: "conteos",
    valor: "2 2 1",
    ayuda: "Enteros separados por espacios. La suma es el total.",
  });
  const filaConteos = el("div", { class: "campo" }, campoConteos.envoltura);
  const filaK = el("div", {}, campoK.envoltura);

  const selector = segmentado({
    etiqueta: "Tipo de cálculo",
    valor: tipo,
    opciones: [
      ["factorial", "Factorial n!"],
      ["permutaciones", "Permutaciones"],
      ["combinaciones", "Combinaciones"],
      ["permutaciones_repetidas", "Con repetición"],
    ],
    onCambio: (valor) => {
      tipo = valor;
      actualizarVisibilidad();
      resultado = null;
      errorHost.replaceChildren();
      barraHost.replaceChildren();
    },
  });

  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Calcular", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
  const estado = el("span", { class: "calculando" });

  const formulario = panel({
    titulo: "Combinatoria exacta",
    subtitulo: "Enteros exactos hasta 10 000 cifras o mantisa y orden de magnitud.",
    icono: "calculadora",
    acciones: [badge("Enteros exactos", "ok")],
    contenido: el(
      "div",
      { class: "pila" },
      selector,
      el("div", { class: "columnas-formulario" }, campoN.envoltura, filaK, filaConteos),
      el("div", { class: "fila" }, botonCalcular, estado)
    ),
  });

  function actualizarVisibilidad() {
    filaK.classList.toggle("oculto", tipo === "factorial" || tipo === "permutaciones_repetidas");
    filaConteos.classList.toggle("oculto", tipo !== "permutaciones_repetidas");
    campoN.envoltura.classList.toggle("oculto", tipo === "permutaciones_repetidas");
  }
  actualizarVisibilidad();

  async function calcular() {
    const n = campoN.valor();
    const k = campoK.valor();
    for (const c of [campoN, campoK, campoConteos]) c.limpiarError();
    errorHost.replaceChildren();
    if (tipo !== "permutaciones_repetidas" && (n === null || typeof n !== "number" || n < 0 || !Number.isInteger(n))) {
      campoN.setError("Introduce un entero no negativo.");
      campoN.enfocar();
      return;
    }
    if ((tipo === "permutaciones" || tipo === "combinaciones") && (typeof k !== "number" || k < 0 || !Number.isInteger(k))) {
      campoK.setError("Introduce un entero no negativo.");
      campoK.enfocar();
      return;
    }
    if ((tipo === "permutaciones" || tipo === "combinaciones") && n !== null && k > n) {
      campoK.setError("k no puede ser mayor que n.");
      campoK.enfocar();
      return;
    }
    let conteos = [];
    if (tipo === "permutaciones_repetidas") {
      const lectura = leerSerie(campoConteos.texto());
      if (lectura.error) {
        campoConteos.setError(lectura.error.mensaje);
        campoConteos.enfocar();
        return;
      }
      conteos = lectura.valores;
      if (conteos.length < 1 || conteos.some((v) => !Number.isInteger(v) || v < 0)) {
        campoConteos.setError("Indica conteos enteros no negativos separados por espacios.");
        campoConteos.enfocar();
        return;
      }
    }
    botonCalcular.cargando(true);
    estado.replaceChildren(el("span", { class: "pulso" }), "Calculando…");
    try {
      const datos = await api.post("/api/probabilidad/combinatoria", { tipo, n, k, conteos });
      resultado = datos;
      abrirResultado();
      renderBarra();
      anunciar(datos.exacto === false ? `Resultado aproximado de ${datos.digitos} cifras.` : `Resultado combinatorio de ${datos.digitos} cifras.`);
      registrarHistorial({
        titulo: `Combinatoria · ${datos.etiqueta}`,
        detalle: `${fmtNum(datos.digitos, { entero: true })} cifras${datos.exacto === false ? " (aprox.)" : ""}`,
        ruta: `probabilidad/${tipo}`,
        tipo: "probabilidad",
        icono: "calculadora",
      });
      estado.replaceChildren("Calculado");
    } catch (error) {
      if (!esCancelacion(error)) {
        const enCampo = errorEnCampo(error, { n: campoN, k: campoK, conteos: campoConteos });
        errorHost.replaceChildren(alerta({ tipo: "error", titulo: enCampo ? "Revisa el campo marcado" : "No se pudo calcular", texto: textoError(error) }));
      }
      estado.replaceChildren("");
    } finally {
      botonCalcular.cargando(false);
    }
  }

  function abrirResultado() {
    if (!resultado) return;
    const aproximado = resultado.exacto === false;
    const numeroGrande = el(
      "div",
      { class: "numero-grande" },
      aproximado
        ? `≈ ${fmtNum(resultado.mantisa, { decimales: 10, notacion: "estandar" })} × 10${superindice(resultado.exponente)}`
        : fmtEnteroGrande(resultado.resultado)
    );
    const cuerpo = el(
      "div",
      { class: "pila pila--sm" },
      numeroGrande,
      aproximado && resultado.nota ? alerta({ tipo: "info", texto: resultado.nota }) : null,
      resultado.pasos?.length ? el("ol", { class: "pasos-calculo" }, resultado.pasos.map((p) => el("li", {}, p))) : null,
      bloqueFormula(resultado.formula, "Expresión utilizada")
    );
    const pie = el(
      "div",
      { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
      boton("Teoría", { variante: "secundario", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("combinatoria", { alcance: "vista" }) }),
      el(
        "div",
        { class: "fila", style: { gap: "6px" } },
        boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(String(resultado.resultado)) }),
        ...botonesExportar(["pdf", "xlsx", "csv"], (formato, nodo) =>
          exportarProbabilidad(nodo, {
            titulo: `Combinatoria · ${resultado.etiqueta}`,
            resumen: `Resultado: ${resultado.resultado}\n${(resultado.pasos || []).join("\n")}`,
            tablas: [{ nombre: "Resultado", columnas: ["Métrica", "Valor"], filas: [["Etiqueta", resultado.etiqueta], ["Resultado", resultado.resultado], ["Dígitos", resultado.digitos]] }],
            formula: resultado.formula,
            estado: { tipo, n: campoN.valor(), k: campoK.valor(), conteos: campoConteos.texto() },
          }, formato))
      )
    );
    abrirVentana({
      id: "prob-resultados",
      titulo: `Resultado · ${resultado.etiqueta}`,
      tituloCorto: "Resultado",
      subtitulo: `${fmtNum(resultado.digitos, { entero: true })} cifras · ${aproximado ? "orden de magnitud" : "valor exacto"}`,
      icono: "objetivo",
      tipo: "resultados",
      alcance: "vista",
      contenido: cuerpo,
      pie,
    });
  }

  function renderBarra() {
    if (!resultado) {
      barraHost.replaceChildren();
      return;
    }
    barraHost.replaceChildren(
      barraResultados({
        icono: "calculadora",
        resumen: `${resultado.etiqueta} · ${fmtNum(resultado.digitos, { entero: true })} cifras`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: abrirResultado }),
          boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("combinatoria", { alcance: "vista" }) }),
        ],
      })
    );
  }

  botonCalcular.addEventListener("click", calcular);
  return el("div", { class: "pila" }, formulario, barraHost, errorHost);
}

/* ================================================================== */
/* Probabilidad condicional                                           */
/* ================================================================== */

function herramientaCondicional() {
  let resultado = null;
  const campoInterseccion = campo({ etiqueta: "P(A ∩ B)", tipo: "numero", valor: 0.2, fraccion: true, nombre: "interseccion", requerido: true, ayuda: "Decimal o fracción (1/5)." });
  const campoCondicion = campo({ etiqueta: "P(B)", tipo: "numero", valor: 0.5, fraccion: true, nombre: "condicion", requerido: true, ayuda: "Debe ser mayor que cero." });
  const campoA = campo({ etiqueta: "P(A)", tipo: "numero", valor: 0.4, fraccion: true, nombre: "pa", opcional: true, ayuda: "Opcional, para comprobar independencia." });
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Calcular P(A | B)", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
  const estado = el("span", { class: "calculando" });

  const formulario = panel({
    titulo: "Probabilidad condicional",
    subtitulo: "Normaliza la probabilidad conjunta por el espacio de la condición.",
    icono: "condicional",
    contenido: el(
      "div",
      { class: "pila" },
      el("div", { class: "columnas-formulario" }, campoInterseccion.envoltura, campoCondicion.envoltura, campoA.envoltura),
      el("div", { class: "fila" }, botonCalcular, estado)
    ),
  });

  function abrirGrafico({ enfocar = true } = {}) {
    if (!resultado) return;
    const hostGrafico = el("div");
    const categorias = resultado.detalle.pa !== null ? ["P(A)", "P(B)", "P(A|B)"] : ["P(A ∩ B)", "P(B)", "P(A|B)"];
    const valores = [
      resultado.detalle.pa !== null ? resultado.detalle.pa : resultado.detalle.interseccion,
      resultado.detalle.condicion,
      resultado.resultado,
    ];
    abrirVentana({
      id: "prob-grafico",
      titulo: "Gráfico · Probabilidad condicional",
      tituloCorto: "Gráfico",
      subtitulo: "Comparación de probabilidades",
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      contenido: hostGrafico,
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Detalle", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: () => abrirDetalle() })
      ),
    });
    dibujar(hostGrafico, {
      tipo: "barras",
      categorias,
      series: [{ nombre: "Probabilidad", x: [0, 1, 2], y: valores, tipo: "barra", color: "var(--grafico-2)" }],
      ylabel: "Probabilidad",
      altura: 300,
      dominioY: [0, 1],
      ariaLabel: "Comparación de probabilidades",
    });
  }

  function abrirDetalle({ enfocar = true } = {}) {
    if (!resultado) return;
    const datos = resultado;
    const detalle = el(
      "div",
      { class: "pila" },
      el(
        "dl",
        { class: "lista-definicion" },
        el("div", {}, el("dt", {}, "P(A ∩ B)"), el("dd", {}, fmtNum(datos.detalle.interseccion))),
        el("div", {}, el("dt", {}, "P(B)"), el("dd", {}, fmtNum(datos.detalle.condicion))),
        datos.detalle.condicional_inversa
          ? el("div", {}, el("dt", {}, "P(B | A)"), el("dd", {}, conExacto(datos.detalle.condicional_inversa, datos.detalle.condicional_inversa_exacta)))
          : null,
        el("div", {}, el("dt", {}, "P(A | B)"), el("dd", {}, conExacto(datos.resultado, datos.resultado_exacto))),
        datos.independencia
          ? el("div", {}, el("dt", {}, "¿Independientes?"), el("dd", {}, datos.independencia.independientes ? "Sí" : "No"))
          : null,
        datos.independencia?.criterio
          ? el("div", {}, el("dt", {}, "Criterio"), el("dd", {}, datos.independencia.criterio))
          : null
      ),
      bloqueFormula("P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}")
    );
    abrirVentana({
      id: "prob-tabla",
      titulo: "Detalle · Probabilidad condicional",
      tituloCorto: "Detalle",
      icono: "tabla",
      tipo: "tabla",
      alcance: "vista",
      enfocar,
      contenido: detalle,
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Gráfico", { variante: "fantasma", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() })
      ),
    });
  }

  function abrirResultado({ enfocar = true } = {}) {
    if (!resultado) return;
    const datos = resultado;
    const porcentaje = fmtPorcentaje(datos.resultado, 2);
    const kpis = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: "P(A | B)", valor: fmtNum(datos.resultado, { decimales: 5 }), detalle: datos.resultado_exacto && datos.resultado_exacto.includes("/") ? `= ${datos.resultado_exacto} · ${porcentaje}` : porcentaje, tono: "marca" }),
      kpi({ etiqueta: "P(A ∩ B)", valor: fmtNum(datos.detalle.interseccion), detalle: "conjunta" }),
      kpi({ etiqueta: "P(B)", valor: fmtNum(datos.detalle.condicion), detalle: "condición" }),
      datos.independencia
        ? kpi({
            etiqueta: "Independencia",
            valor: datos.independencia.independientes ? "Sí" : "No",
            detalle: `P(A)·P(B) = ${datos.independencia.producto_exacto || fmtNum(datos.independencia.producto)} ${datos.independencia.independientes ? "=" : "≠"} P(A ∩ B)`,
            tono: datos.independencia.independientes ? "ok" : "aviso",
          })
        : kpi({ etiqueta: "P(A)", valor: "—", detalle: "dato opcional no introducido" })
    );

    abrirVentana({
      id: "prob-resultados",
      titulo: "Resultado · Probabilidad condicional",
      tituloCorto: "Resultado",
      subtitulo: `P(A | B) = ${fmtNum(datos.resultado, { decimales: 4 })}`,
      icono: "objetivo",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
      contenido: el("div", { class: "pila" }, kpis, alerta({ tipo: "info", texto: datos.interpretacion }), avisosMotor(datos.avisos)),
      pie: el(
        "div",
        { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
        el(
          "div",
          { class: "fila", style: { gap: "6px" } },
          boton("Ver gráfico", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() }),
          boton("Ver detalle", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirDetalle() }),
          boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("bayes", { alcance: "vista" }) })
        ),
        el(
          "div",
          { class: "fila", style: { gap: "6px" } },
          boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(`P(A|B) = ${datos.resultado_exacto && datos.resultado_exacto.includes("/") ? `${datos.resultado_exacto} = ` : ""}${fmtNum(datos.resultado, { decimales: 10 })}`) }),
          ...botonesExportar(["pdf", "xlsx", "csv"], (formato, nodo) =>
            exportarProbabilidad(nodo, {
              titulo: "Probabilidad condicional",
              resumen: datos.interpretacion,
              tablas: [{ nombre: "Probabilidades", columnas: ["Métrica", "Valor"], filas: [["P(A | B)", datos.resultado], ["P(A ∩ B)", datos.detalle.interseccion], ["P(B)", datos.detalle.condicion], ["P(A)", datos.detalle.pa]] }],
              formula: datos.formula,
              estado: { tipo: "condicional", interseccion: datos.detalle.interseccion, condicion: datos.detalle.condicion, pa: datos.detalle.pa },
            }, formato))
        )
      ),
    });
  }

  function renderBarra() {
    if (!resultado) {
      barraHost.replaceChildren();
      return;
    }
    barraHost.replaceChildren(
      barraResultados({
        icono: "condicional",
        resumen: `P(A | B) = ${fmtNum(resultado.resultado, { decimales: 5 })}`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
          boton("Gráfico", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() }),
          boton("Detalle", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirDetalle() }),
        ],
      })
    );
  }

  botonCalcular.addEventListener("click", async () => {
    for (const c of [campoInterseccion, campoCondicion, campoA]) c.limpiarError();
    errorHost.replaceChildren();
    const lInt = leerProbabilidad(campoInterseccion.texto());
    const lCond = leerProbabilidad(campoCondicion.texto());
    const lA = campoA.texto() ? leerProbabilidad(campoA.texto()) : { valor: null, error: null };
    let primero = null;
    const marcar = (c, mensaje) => { c.setError(mensaje); primero = primero || c; };
    if (lInt.error) marcar(campoInterseccion, lInt.error);
    if (lCond.error) marcar(campoCondicion, lCond.error);
    if (lA.error) marcar(campoA, lA.error);
    if (!lCond.error && lCond.valor <= 0) marcar(campoCondicion, "P(B) debe ser mayor que 0.");
    if (!lInt.error && !lCond.error && lInt.valor > lCond.valor) marcar(campoInterseccion, "P(A ∩ B) no puede superar P(B).");
    if (!lInt.error && !lA.error && lA.valor !== null && lInt.valor > lA.valor) marcar(campoA, "P(A) no puede ser menor que P(A ∩ B).");
    if (primero) { primero.enfocar(); return; }

    botonCalcular.cargando(true);
    estado.replaceChildren(el("span", { class: "pulso" }), "Calculando…");
    try {
      const datos = await api.post("/api/probabilidad/condicional", {
        interseccion: campoInterseccion.texto(),
        condicion: campoCondicion.texto(),
        pa: campoA.texto() || null,
      });
      resultado = datos;
      abrirResultado();
      renderBarra();
      if (ventanasAbiertas().some((v) => v.id === "prob-grafico")) abrirGrafico({ enfocar: false });
      if (ventanasAbiertas().some((v) => v.id === "prob-tabla")) abrirDetalle({ enfocar: false });
      estado.replaceChildren("Calculado");
      registrarHistorial({ titulo: "Probabilidad condicional", detalle: `P(A|B) = ${fmtNum(datos.resultado, { decimales: 4 })}`, ruta: "probabilidad/condicional", tipo: "probabilidad", icono: "condicional" });
    } catch (error) {
      if (!esCancelacion(error)) {
        const enCampo = errorEnCampo(error, { interseccion: campoInterseccion, condicion: campoCondicion, pa: campoA });
        errorHost.replaceChildren(alerta({ tipo: "error", titulo: enCampo ? "Revisa el campo marcado" : "No se pudo calcular", texto: textoError(error) }));
      }
      estado.replaceChildren("");
    } finally {
      botonCalcular.cargando(false);
    }
  });

  return el("div", { class: "pila" }, formulario, barraHost, errorHost);
}

/* ================================================================== */
/* Bayes                                                              */
/* ================================================================== */

function herramientaBayes() {
  let resultado = null;
  let filas = [
    { nombre: "Enfermedad presente", prior: "0,01", likelihood: "0,95" },
    { nombre: "Enfermedad ausente", prior: "0,99", likelihood: "0,05" },
  ];
  const contenedorFilas = el("div", { class: "pila pila--sm" });
  const barraSuma = el("div", { class: "barra-suma" });
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Actualizar con Bayes", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
  const estado = el("span", { class: "calculando" });
  const errores = zonaErrores();
  let entradas = [];

  function actualizarSuma() {
    const suma = filas.reduce((acc, f) => acc + (numero(f.prior) || 0), 0);
    const valido = Math.abs(suma - 1) <= 1e-9;
    barraSuma.dataset.valido = String(valido);
    barraSuma.replaceChildren(
      el("span", {}, "Suma de probabilidades previas"),
      el("strong", {}, fmtNum(suma, { decimales: 6 })),
      el("span", {}, valido ? "✓ correcta" : "debe ser 1")
    );
  }

  function renderFilas() {
    contenedorFilas.replaceChildren();
    errores.limpiar();
    entradas = [];
    contenedorFilas.append(
      el("div", { class: "fila-hipotesis fila-hipotesis--cabecera" }, el("span", {}, "Hipótesis"), el("span", {}, "Prior P(Bᵢ)"), el("span", {}, "Verosimilitud P(A|Bᵢ)"), el("span", {}))
    );
    filas.forEach((fila, indice) => {
      const nombre = el("input", { type: "text", value: fila.nombre, placeholder: `Hipótesis ${indice + 1}`, "aria-label": `Nombre de la hipótesis ${indice + 1}`, onInput: (e) => { fila.nombre = e.target.value; } });
      const prior = el("input", { type: "text", inputMode: "decimal", value: fila.prior, "aria-label": `Probabilidad previa de ${fila.nombre}`, onInput: (e) => { fila.prior = e.target.value; actualizarSuma(); } });
      const verosimilitud = el("input", { type: "text", inputMode: "decimal", value: fila.likelihood, "aria-label": `Verosimilitud de ${fila.nombre}`, onInput: (e) => { fila.likelihood = e.target.value; } });
      const quitar = iconoBoton("basura", {
        etiqueta: `Eliminar ${fila.nombre || "hipótesis"}`,
        onClick: () => {
          if (filas.length <= 2) { toast("Bayes necesita al menos dos hipótesis.", { tipo: "aviso" }); return; }
          filas.splice(indice, 1);
          renderFilas();
        },
      });
      entradas.push({ prior, likelihood: verosimilitud });
      contenedorFilas.append(el("div", { class: "fila-hipotesis" }, nombre, prior, verosimilitud, quitar));
    });
    actualizarSuma();
  }

  const formulario = panel({
    titulo: "Teorema de Bayes",
    subtitulo: "Decimales (0,25) o fracciones exactas (1/4).",
    icono: "objetivo",
    acciones: [
      boton("Añadir hipótesis", { variante: "fantasma", pequeno: true, icono: "mas", onClick: () => { filas.push({ nombre: `Hipótesis ${filas.length + 1}`, prior: "0", likelihood: "0,5" }); renderFilas(); } }),
      boton("Ejemplo", { variante: "fantasma", pequeno: true, icono: "ejemplo", onClick: () => { filas = [{ nombre: "Enfermedad presente", prior: "0,01", likelihood: "0,95" }, { nombre: "Enfermedad ausente", prior: "0,99", likelihood: "0,05" }]; renderFilas(); } }),
    ],
    contenido: el("div", { class: "pila" }, contenedorFilas, barraSuma, errores.nodo, el("div", { class: "fila" }, botonCalcular, estado)),
  });

  function abrirGrafico({ enfocar = true } = {}) {
    if (!resultado) return;
    const hostGrafico = el("div");
    abrirVentana({
      id: "prob-grafico",
      titulo: "Gráfico · Teorema de Bayes",
      tituloCorto: "Gráfico",
      subtitulo: "Probabilidades posteriores por hipótesis",
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      contenido: hostGrafico,
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Tabla completa", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: () => abrirTabla() })
      ),
    });
    dibujar(hostGrafico, {
      tipo: "barras",
      categorias: resultado.filas.map((f) => (f.nombre.length > 16 ? `${f.nombre.slice(0, 15)}…` : f.nombre)),
      series: [{ nombre: "Probabilidad posterior", x: resultado.filas.map((_, i) => i), y: resultado.filas.map((f) => f.posterior), tipo: "barra", color: "var(--grafico-4)" }],
      ylabel: "P(hipótesis | evidencia)",
      altura: 300,
      dominioY: [0, 1],
      ariaLabel: "Probabilidades posteriores de cada hipótesis",
    });
  }

  function abrirTabla({ enfocar = true } = {}) {
    if (!resultado) return;
    abrirVentana({
      id: "prob-tabla",
      titulo: "Tabla · Cálculo de Bayes",
      tituloCorto: "Tabla",
      icono: "tabla",
      tipo: "tabla",
      alcance: "vista",
      enfocar,
      contenido: tabla({
        columnas: resultado.exacto
          ? ["Hipótesis", "Prior", "Verosimilitud", "Prior × verosimilitud", "Posterior", "Posterior exacta"]
          : ["Hipótesis", "Prior", "Verosimilitud", "Prior × verosimilitud", "Posterior"],
        filas: resultado.filas.map((f) =>
          resultado.exacto
            ? [f.nombre, f.prior, f.likelihood, f.conjunta, f.posterior, f.posterior_exacto ?? "—"]
            : [f.nombre, f.prior, f.likelihood, f.conjunta, f.posterior]
        ),
        total: resultado.filas.length,
        formatos: {
          "Posterior exacta": (v) => String(v),
          Prior: (v) => fmtNum(v, { decimales: 5 }),
          Verosimilitud: (v) => fmtNum(v, { decimales: 5 }),
          "Prior × verosimilitud": (v) => fmtNum(v, { decimales: 6 }),
          Posterior: (v) => fmtNum(v, { decimales: 6 }),
        },
      }),
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Gráfico", { variante: "fantasma", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() })
      ),
    });
  }

  function abrirResultado({ enfocar = true } = {}) {
    if (!resultado) return;
    const mayor = resultado.filas.reduce((a, b) => (b.posterior > a.posterior ? b : a));
    const cuerpo = el(
      "div",
      { class: "pila" },
      el(
        "div",
        { class: "rejilla rejilla--kpi" },
        kpi({ etiqueta: "Hipótesis más probable", valor: mayor.nombre, detalle: `posterior ${fmtPorcentaje(mayor.posterior, 2)}`, tono: "marca" }),
        kpi({ etiqueta: "P(evidencia)", valor: fmtNum(resultado.total, { decimales: 6 }), detalle: resultado.total_exacto?.includes("/") ? `= ${resultado.total_exacto} · denominador` : "denominador de Bayes" })
      ),
      alerta({ tipo: "info", texto: resultado.interpretacion }),
      bloqueFormula("P(B_i\\mid A)=\\frac{P(B_i)\\,P(A\\mid B_i)}{\\sum_j P(B_j)\\,P(A\\mid B_j)}", "Posterior normalizada")
    );
    const pie = el(
      "div",
      { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
      el(
        "div",
        { class: "fila", style: { gap: "6px" } },
        boton("Ver gráfico", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() }),
        boton("Ver tabla", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTabla() }),
        boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("bayes", { alcance: "vista" }) })
      ),
      el(
        "div",
        { class: "fila", style: { gap: "6px" } },
        boton("Copiar", {
          variante: "fantasma",
          pequeno: true,
          icono: "copiar",
          onClick: () => copiar(resultado.filas.map((f) => `${f.nombre}: ${f.posterior_exacto && f.posterior_exacto.includes("/") ? `${f.posterior_exacto} = ` : ""}${fmtNum(f.posterior, { decimales: 10 })}`).join("\n")),
        }),
        ...botonesExportar(["pdf", "xlsx", "csv"], (formato, nodo) =>
          exportarProbabilidad(nodo, {
            titulo: "Teorema de Bayes",
            resumen: resultado.interpretacion,
            tablas: [{ nombre: "Posteriores", columnas: ["Hipótesis", "Prior", "Verosimilitud", "Posterior"], filas: resultado.filas.map((f) => [f.nombre, f.prior, f.likelihood, f.posterior]) }],
            formula: resultado.formula,
            estado: { tipo: "bayes", hipotesis: filas.map((f) => ({ nombre: f.nombre, prior: f.prior, likelihood: f.likelihood })) },
          }, formato))
      )
    );
    abrirVentana({
      id: "prob-resultados",
      titulo: "Resultado · Teorema de Bayes",
      tituloCorto: "Resultado · Bayes",
      subtitulo: `${mayor.nombre}: ${fmtPorcentaje(mayor.posterior, 2)}`,
      icono: "objetivo",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
      contenido: cuerpo,
      pie,
    });
  }

  function renderBarra() {
    if (!resultado) { barraHost.replaceChildren(); return; }
    const mayor = resultado.filas.reduce((a, b) => (b.posterior > a.posterior ? b : a));
    barraHost.replaceChildren(
      barraResultados({
        icono: "objetivo",
        resumen: `Mayor posterior: ${mayor.nombre} (${fmtPorcentaje(mayor.posterior, 2)})`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
          boton("Gráfico", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() }),
          boton("Tabla", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTabla() }),
        ],
      })
    );
  }

  async function calcular() {
    errores.limpiar();
    errorHost.replaceChildren();
    let sumaPriores = 0;
    for (let i = 0; i < filas.length; i += 1) {
      const nombre = filas[i].nombre || `Hipótesis ${i + 1}`;
      const lp = leerProbabilidad(filas[i].prior);
      if (lp.error) return errores.mostrar(`Prior de «${nombre}»: ${lp.error}`, entradas[i]?.prior);
      const lv = leerProbabilidad(filas[i].likelihood);
      if (lv.error) return errores.mostrar(`Verosimilitud de «${nombre}»: ${lv.error}`, entradas[i]?.likelihood);
      sumaPriores += lp.valor;
    }
    if (Math.abs(sumaPriores - 1) > 1e-9) {
      return errores.mostrar(`Las probabilidades previas suman ${fmtNum(sumaPriores, { decimales: 6 })} y deben sumar 1.`, entradas[0]?.prior);
    }
    const hipotesis = filas.map((f, i) => ({ nombre: f.nombre || `Hipótesis ${i + 1}`, prior: String(f.prior).trim(), likelihood: String(f.likelihood).trim() }));
    botonCalcular.cargando(true);
    estado.replaceChildren(el("span", { class: "pulso" }), "Calculando…");
    try {
      const datos = await api.post("/api/probabilidad/bayes", { hipotesis });
      resultado = datos;
      abrirResultado();
      renderBarra();
      if (ventanasAbiertas().some((v) => v.id === "prob-grafico")) abrirGrafico({ enfocar: false });
      if (ventanasAbiertas().some((v) => v.id === "prob-tabla")) abrirTabla({ enfocar: false });
      estado.replaceChildren("Calculado");
      registrarHistorial({
        titulo: "Teorema de Bayes",
        detalle: `Mayor posterior: ${datos.filas.reduce((a, b) => (b.posterior > a.posterior ? b : a)).nombre}`,
        ruta: "probabilidad/bayes",
        tipo: "probabilidad",
        icono: "objetivo",
      });
    } catch (error) {
      if (!esCancelacion(error)) {
        const m = /^hipotesis\.(\d+)\.(prior|likelihood)$/.exec(error.campo || "");
        errores.mostrar(textoError(error), m ? entradas[Number(m[1])]?.[m[2]] : entradas[0]?.prior);
        errorHost.replaceChildren(alerta({ tipo: "error", titulo: "No se pudo actualizar", texto: textoError(error) }));
      }
      estado.replaceChildren("");
    } finally {
      botonCalcular.cargando(false);
    }
  }

  renderFilas();
  botonCalcular.addEventListener("click", calcular);
  return el("div", { class: "pila" }, formulario, barraHost, errorHost);
}

/* ================================================================== */
/* Variable discreta                                                  */
/* ================================================================== */

function herramientaVariable() {
  let filas = [
    { x: "0", p: "0,1" },
    { x: "1", p: "0,2" },
    { x: "2", p: "0,3" },
    { x: "3", p: "0,4" },
  ];
  let resultado = null;
  const contenedor = el("div", { class: "tabla-datos-editor" });
  const barraSuma = el("div", { class: "barra-suma" });
  const campoMGF = campo({ etiqueta: "Evaluar la MGF en t", codigo: "t", tipo: "numero", valor: 1, opcional: true, ayuda: "M_X(t) = E[e^{tX}]. Opcional." });
  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });
  const botonCalcular = boton("Calcular momentos", { icono: "reproducir", dataset: { accionPrimaria: "true" } });
  const estado = el("span", { class: "calculando" });
  const errores = zonaErrores();
  let entradas = [];

  function actualizarSuma() {
    const suma = filas.reduce((acc, f) => acc + (numero(f.p) || 0), 0);
    const valido = Math.abs(suma - 1) <= 1e-9;
    barraSuma.dataset.valido = String(valido);
    barraSuma.replaceChildren(el("span", {}, "Suma de las probabilidades"), el("strong", {}, fmtNum(suma, { decimales: 6 })), el("span", {}, valido ? "✓ normalizada" : "debe sumar 1"));
  }

  function renderFilas() {
    errores.limpiar();
    entradas = [];
    contenedor.replaceChildren(
      el("div", { class: "fila-datos", style: { fontSize: "0.7rem", color: "var(--texto-3)", padding: "0 2px" } }, el("span", {}, "Valor x"), el("span", {}, "Probabilidad P(X = x)"), el("span"))
    );
    filas.forEach((fila, indice) => {
      const inputX = el("input", { type: "text", inputMode: "decimal", value: fila.x, "aria-label": `Valor x de la fila ${indice + 1}`, onInput: (e) => { fila.x = e.target.value; } });
      const inputP = el("input", { type: "text", inputMode: "decimal", value: fila.p, "aria-label": `Probabilidad de la fila ${indice + 1}`, onInput: (e) => { fila.p = e.target.value; actualizarSuma(); } });
      const quitar = iconoBoton("basura", {
        etiqueta: `Eliminar fila ${indice + 1}`,
        onClick: () => {
          if (filas.length <= 1) { toast("Necesitas al menos una fila.", { tipo: "aviso" }); return; }
          filas.splice(indice, 1);
          renderFilas();
        },
      });
      entradas.push({ x: inputX, p: inputP });
      contenedor.append(el("div", { class: "fila-datos" }, inputX, inputP, quitar));
    });
    actualizarSuma();
  }

  const formulario = panel({
    titulo: "Variable aleatoria discreta",
    subtitulo: "Define los valores y sus probabilidades (decimales o fracciones).",
    icono: "distribuciones",
    acciones: [
      boton("Añadir valor", { variante: "fantasma", pequeno: true, icono: "mas", onClick: () => { filas.push({ x: String(filas.length), p: "0" }); renderFilas(); } }),
      boton("Dado justo", { variante: "fantasma", pequeno: true, icono: "probabilidad", onClick: () => { filas = [1, 2, 3, 4, 5, 6].map((x) => ({ x: String(x), p: "1/6" })); renderFilas(); } }),
    ],
    contenido: el("div", { class: "pila" }, contenedor, barraSuma, errores.nodo, el("div", { class: "columnas-formulario" }, campoMGF.envoltura), el("div", { class: "fila" }, botonCalcular, estado)),
  });

  function abrirGrafico({ enfocar = true } = {}) {
    if (!resultado) return;
    const hostGrafico = el("div");
    abrirVentana({
      id: "prob-grafico",
      titulo: "Gráfico · Función de masa",
      tituloCorto: "Gráfico",
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      contenido: hostGrafico,
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Tabla", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: () => abrirTabla() })
      ),
    });
    dibujar(hostGrafico, {
      tipo: "barras",
      categorias: resultado.distribucion.map((d) => fmtNum(d.x, { decimales: 3 })),
      series: [{ nombre: "P(X = x)", x: resultado.distribucion.map((_, i) => i), y: resultado.distribucion.map((d) => d.p), tipo: "barra", color: "var(--grafico-1)" }],
      xlabel: "x",
      ylabel: "P(X = x)",
      altura: 300,
      yCero: true,
      ariaLabel: "Función de masa de la variable discreta",
    });
  }

  function abrirTabla({ enfocar = true } = {}) {
    if (!resultado) return;
    abrirVentana({
      id: "prob-tabla",
      titulo: "Tabla · Distribución discreta",
      tituloCorto: "Tabla",
      icono: "tabla",
      tipo: "tabla",
      alcance: "vista",
      enfocar,
      contenido: tabla({
        columnas: ["x", "P(X = x)"],
        filas: resultado.distribucion.map((d) => [d.x, d.p]),
        total: resultado.distribucion.length,
      }),
      pie: el("div", { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
        boton("Gráfico", { variante: "fantasma", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() })
      ),
    });
  }

  function abrirResultado({ enfocar = true } = {}) {
    if (!resultado) return;
    const kpis = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: "E[X]", valor: fmtNum(resultado.esperanza, { decimales: 5 }), detalle: resultado.esperanza_exacta?.includes("/") ? `= ${resultado.esperanza_exacta} · esperanza` : "esperanza", tono: "marca" }),
      kpi({ etiqueta: "Var(X)", valor: fmtNum(resultado.varianza, { decimales: 5 }), detalle: resultado.varianza_exacta?.includes("/") ? `= ${resultado.varianza_exacta} · varianza` : "varianza" }),
      kpi({ etiqueta: "DE(X)", valor: fmtNum(resultado.desviacion, { decimales: 5 }), detalle: "desviación típica" }),
      kpi({ etiqueta: "E[X²]", valor: fmtNum(resultado.segundo_momento, { decimales: 5 }), detalle: "segundo momento" }),
      resultado.mgf !== null && resultado.mgf !== undefined ? kpi({ etiqueta: "M_X(t)", valor: fmtNum(resultado.mgf, { decimales: 5 }), detalle: "función generadora" }) : null
    );

    abrirVentana({
      id: "prob-resultados",
      titulo: "Resultado · Variable discreta",
      tituloCorto: "Resultado",
      subtitulo: `E[X] = ${fmtNum(resultado.esperanza, { decimales: 4 })} · DE = ${fmtNum(resultado.desviacion, { decimales: 4 })}`,
      icono: "objetivo",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
      contenido: el(
        "div",
        { class: "pila" },
        kpis,
        alerta({ tipo: "info", texto: resultado.interpretacion }),
        bloqueFormula(resultado.formula, "Expresión de momentos")
      ),
      pie: el(
        "div",
        { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
        el(
          "div",
          { class: "fila", style: { gap: "6px" } },
          boton("Ver gráfico", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() }),
          boton("Ver tabla", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTabla() }),
          boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("uniforme_discreta", { alcance: "vista" }) })
        ),
        el(
          "div",
          { class: "fila", style: { gap: "6px" } },
          boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(`E[X] = ${resultado.esperanza}\nVar(X) = ${resultado.varianza}`) }),
          ...botonesExportar(["pdf", "xlsx", "csv"], (formato, nodo) =>
            exportarProbabilidad(nodo, {
              titulo: "Variable aleatoria discreta",
              resumen: resultado.interpretacion,
              tablas: [{ nombre: "Distribución", columnas: ["x", "P(X = x)"], filas: resultado.distribucion.map((d) => [d.x, d.p]) }],
              formula: resultado.formula,
              estado: { tipo: "variable", valores: resultado.distribucion.map((d) => d.x), masas: resultado.distribucion.map((d) => d.p) },
            }, formato))
        )
      ),
    });
  }

  function renderBarra() {
    if (!resultado) { barraHost.replaceChildren(); return; }
    barraHost.replaceChildren(
      barraResultados({
        icono: "distribuciones",
        resumen: `E[X] = ${fmtNum(resultado.esperanza, { decimales: 4 })} · Var(X) = ${fmtNum(resultado.varianza, { decimales: 4 })}`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultado() }),
          boton("Gráfico", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGrafico() }),
          boton("Tabla", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTabla() }),
        ],
      })
    );
  }

  async function calcular() {
    errores.limpiar();
    campoMGF.limpiarError();
    errorHost.replaceChildren();
    let suma = 0;
    for (let i = 0; i < filas.length; i += 1) {
      const lx = leerNumero(filas[i].x);
      if (lx.vacio || lx.error) return errores.mostrar(`Fila ${i + 1}: ${lx.vacio ? "falta el valor x." : lx.error.mensaje}`, entradas[i]?.x);
      const lp = leerProbabilidad(filas[i].p);
      if (lp.error) return errores.mostrar(`Fila ${i + 1}, probabilidad: ${lp.error}`, entradas[i]?.p);
      suma += lp.valor;
    }
    if (Math.abs(suma - 1) > 1e-9) {
      return errores.mostrar(`Las probabilidades suman ${fmtNum(suma, { decimales: 6 })} y deben sumar 1.`, entradas[entradas.length - 1]?.p);
    }
    if (campoMGF.texto() && !campoMGF.validar()) return campoMGF.enfocar();
    const valores = filas.map((f) => String(f.x).trim());
    const masas = filas.map((f) => String(f.p).trim());
    botonCalcular.cargando(true);
    estado.replaceChildren(el("span", { class: "pulso" }), "Calculando…");
    try {
      const datos = await api.post("/api/probabilidad/variable", { valores, masas, t: campoMGF.texto() || null });
      resultado = datos;
      abrirResultado();
      renderBarra();
      if (ventanasAbiertas().some((v) => v.id === "prob-grafico")) abrirGrafico({ enfocar: false });
      if (ventanasAbiertas().some((v) => v.id === "prob-tabla")) abrirTabla({ enfocar: false });
      estado.replaceChildren("Calculado");
      registrarHistorial({ titulo: "Variable discreta", detalle: `E[X] = ${fmtNum(datos.esperanza, { decimales: 4 })}`, ruta: "probabilidad/variable", tipo: "probabilidad", icono: "distribuciones" });
    } catch (error) {
      if (!esCancelacion(error)) {
        const fila = Number.isInteger(error.posicion) ? entradas[error.posicion - 1] : null;
        if (error.campo === "t") errorEnCampo(error, { t: campoMGF });
        else errores.mostrar(textoError(error), error.campo === "valores" ? fila?.x : fila?.p ?? entradas[0]?.p);
        errorHost.replaceChildren(alerta({ tipo: "error", titulo: "No se pudo calcular", texto: textoError(error) }));
      }
      estado.replaceChildren("");
    } finally {
      botonCalcular.cargando(false);
    }
  }

  renderFilas();
  botonCalcular.addEventListener("click", calcular);
  return el("div", { class: "pila" }, formulario, barraHost, errorHost);
}

/* ================================================================== */
/* Vista principal                                                    */
/* ================================================================== */

export async function montar(host, parametro) {
  await cargarMeta().catch(() => null);
  let activa = HERRAMIENTAS.some((h) => h.clave === parametro) ? parametro : "combinatoria";

  const selector = el("div", { class: "rejilla rejilla--herramientas" });
  const contenido = el("div", { class: "pila" });
  const constructores = {
    combinatoria: herramientaCombinatoria,
    condicional: herramientaCondicional,
    bayes: herramientaBayes,
    variable: herramientaVariable,
  };

  function renderHerramientas() {
    selector.replaceChildren();
    for (const herramienta of HERRAMIENTAS) {
      selector.append(
        el(
          "button",
          {
            class: `tarjeta-herramienta ${herramienta.clave === activa ? "tarjeta-herramienta--activa" : ""}`,
            type: "button",
            "aria-pressed": String(herramienta.clave === activa),
            onClick: () => seleccionar(herramienta.clave),
          },
          el("span", { class: "tarjeta-herramienta__icono" }, icono(herramienta.icono, { tamano: 17 })),
          el("span", { class: "tarjeta-herramienta__titulo" }, herramienta.nombre),
          el("span", { class: "tarjeta-herramienta__texto" }, herramienta.descripcion)
        )
      );
    }
  }

  function seleccionar(clave) {
    cerrarVentanasPorAlcance("vista");
    activa = clave;
    history.replaceState(null, "", `#/probabilidad/${clave}`);
    renderHerramientas();
    contenido.replaceChildren(constructores[clave]());
    anunciar(`Herramienta ${clave} seleccionada.`);
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
          el("span", { class: "ceja" }, "Explorar · Probabilidad"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("probabilidad", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Probabilidad, paso a paso")
          ),
          el("p", { class: "vista__subtitulo" }, VISTAS.probabilidad.subtitulo)
        ),
        el(
          "div",
          { class: "vista__acciones" },
          boton("Teoría", {
            variante: "secundario",
            icono: "teoria",
            onClick: () => {
              const info = HERRAMIENTAS.find((h) => h.clave === activa);
              abrirTeoriaVentana(info?.teoria || "bayes", { alcance: "vista" });
            },
          })
        )
      ),
      selector,
      contenido
    )
  );

  renderHerramientas();
  contenido.append(constructores[activa]());

  return null;
}
