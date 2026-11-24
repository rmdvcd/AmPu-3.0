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
  fmtPorcentaje,
  fmtIntervalo,
  errorEnCampo,
  textoError,
  avisosMotor,
  segmentado,
  anunciar,
  botonesExportar,
} from "../ui.js";
import { fmtEntrada, leerNumero } from "../entrada.js";
import { icono } from "../icons.js";
import { dibujar, graficoCaja, calcularHistograma, calcularECDF } from "../chart.js";
import {
  cargarEjemplos,
  navegar,
  registrarHistorial,
  transito,
} from "../store.js";
import { api, esCancelacion } from "../api.js";
import { abrirVentana, cerrarVentanasPorAlcance, ventanasAbiertas, barraResultados } from "../ventanas.js";
import { abrirTeoriaVentana } from "../teoria_dialogo.js";

const textoSerie = (valores, separador = " ") => valores.map((v) => fmtEntrada(v)).join(separador);

function numeroCelda(celda) {
  const lectura = leerNumero(celda);
  return lectura.error ? NaN : lectura.valor;
}

function parsearCSV(texto) {
  const lineas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return null;
  const cuenta = (car) => (lineas[0].match(new RegExp(`\\${car}`, "g")) || []).length;
  const candidatos = ["\t", ";", ","];
  let delimitador = candidatos.sort((a, b) => cuenta(b) - cuenta(a))[0];
  if (cuenta(delimitador) === 0) delimitador = null;

  const filas = [];
  for (const linea of lineas) {
    if (!delimitador) {
      filas.push(linea.split(/\s+/).map((v) => v.trim()).filter(Boolean));
      continue;
    }
    const campos = [];
    let actual = "";
    let comillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        if (comillas && linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else comillas = !comillas;
      } else if (c === delimitador && !comillas) {
        campos.push(actual.trim());
        actual = "";
      } else actual += c;
    }
    campos.push(actual.trim());
    filas.push(campos);
  }
  if (filas.length < 2) return null;
  const ancho = Math.max(...filas.map((f) => f.length));
  const cabecera = filas[0];
  const primeraNumerica = cabecera.every((c) => c === "" || Number.isFinite(numeroCelda(c)));
  const nombres = primeraNumerica ? cabecera.map((_, i) => `Columna ${i + 1}`) : cabecera.map((c, i) => c || `Columna ${i + 1}`);
  const cuerpo = primeraNumerica ? filas : filas.slice(1);
  const columnas = [];
  for (let i = 0; i < ancho; i++) {
    const valoresCrudos = cuerpo.map((f) => (f[i] ?? "").trim());
    const validos = valoresCrudos.filter(Boolean);
    const numeros = validos.map(numeroCelda);
    const nValidos = numeros.filter(Number.isFinite).length;
    if (!validos.length || nValidos / validos.length < 0.7) continue;
    columnas.push({
      nombre: nombres[i] || `Columna ${i + 1}`,
      valores: numeros.filter(Number.isFinite),
      faltantes: valoresCrudos.filter((v) => !v).length,
      descartadas: validos.filter((_, j) => !Number.isFinite(numeros[j])),
    });
  }
  return { columnas, filas: cuerpo.length, delimitador };
}

function textoModas(r) {
  const modas = r.modas || [];
  if (!modas.length) return "Sin moda (ningún valor se repite)";
  const extra = (r.n_modas ?? modas.length) - modas.length;
  return modas.map((m) => fmtNum(m)).join(" · ") + (extra > 0 ? ` · (+${extra} más)` : "");
}

function configTablaResumen(resultado) {
  const r = resultado.resumen;
  const filas = [
    ["Observaciones", resultado.n],
    ["Suma", r.suma],
    ["Media", r.media],
    ["Mediana", r.mediana],
    ["Moda(s)", textoModas(r)],
    ["Mínimo", r.minimo],
    ["Máximo", r.maximo],
    ["Rango", r.rango],
    ["Primer cuartil Q1", r.q1],
    ["Tercer cuartil Q3", r.q3],
    ["Rango intercuartílico", r.iqr],
    ["Varianza muestral", r.varianza],
    ["Desviación estándar", r.desviacion],
    ["Coeficiente de variación", r.cv !== null && r.cv !== undefined ? fmtPorcentaje(r.cv, 1) : "—"],
    ["Error estándar de la media", r.error_estandar],
    [`IC ${fmtPorcentaje(r.ic_nivel ?? 0.95, 0)} para la media`, fmtIntervalo(r.ic_media)],
    ["Asimetría (sesgo)", r.sesgo],
    ["Curtosis (exceso)", r.curtosis],
    ["Valores atípicos (1,5 · IQR)", resultado.n_atipicos ?? resultado.atipicos?.length ?? 0],
  ];
  return {
    columnas: ["Estadístico", "Valor"],
    filas,
    total: filas.length,
  };
}

export async function montar(host) {
  let resultado = null;
  let columnasArchivo = [];
  let temporizadorContador = null;
  let controlador = null;
  let bins = 12;
  let vistaGrafico = "histograma";
  let vistaTabla = "resumen";

  const campoDatos = campo({
    etiqueta: "Datos numéricos",
    tipo: "serie",
    valor: "",
    filas: 8,
    nombre: "datos",
    ayuda: "Pega una columna o escribe valores separados por espacios, saltos de línea o punto y coma.",
    placeholder: "12,5 14 13,2 12 15 18 11 40",
    onInput: () => {
      actualizarContador();
      if (resultado) marcarDesactualizado();
    },
  });

  const contador = el("span", { class: "chip" }, "0 valores");
  const zonaPegar = el(
    "div",
    { class: "pila pila--sm" },
    campoDatos.envoltura,
    el(
      "div",
      { class: "fila fila--entre" },
      el("span", { class: "texto-tenue texto-pequeno" }, "Comprueba el conteo antes de analizar."),
      contador
    )
  );

  const nombreArchivo = el("span", { class: "chip" }, "Ningún archivo");
  const selectorColumna = campo({
    etiqueta: "Columna a analizar",
    tipo: "select",
    id: "columna-archivo",
    valor: "",
    opciones: [["", "Carga un CSV para elegir una columna"]],
    onCambio: (valor) => {
      const col = columnasArchivo.find((c) => c.nombre === valor);
      if (col) {
        campoDatos.setValor(textoSerie(col.valores, "\n"));
        actualizarContador();
        avisarDescartes(col);
        toast(`Columna «${col.nombre}» cargada con ${col.valores.length} valores`, { tipo: "ok" });
      }
    },
  });
  const informacionArchivo = el("p", { class: "texto-tenue texto-pequeno" }, "Formatos: CSV, TSV o TXT.");
  const entradaArchivo = el("input", { type: "file", id: "archivo-datos", accept: ".csv,.tsv,.txt,text/csv,text/plain", hidden: true });
  const zonaArchivo = el(
    "label",
    { class: "zona-archivo", for: "archivo-datos", tabindex: "0" },
    icono("archivo", { tamano: 22 }),
    el("strong", {}, "Arrastra un CSV o haz clic para elegirlo"),
    el("span", {}, "Lectura local en el navegador.")
  );
  zonaArchivo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      entradaArchivo.click();
    }
  });
  zonaArchivo.append(entradaArchivo);
  const zonaArchivoPanel = el(
    "div",
    { class: "pila pila--sm" },
    zonaArchivo,
    el("div", { class: "fila" }, nombreArchivo, informacionArchivo),
    selectorColumna.envoltura
  );

  const ejemplos = await cargarEjemplos().catch(() => null);
  const ejemplo = ejemplos?.descriptiva;
  const zonaEjemplo = el(
    "div",
    { class: "pila pila--sm" },
    el("p", {}, ejemplo?.descripcion || "Tiempos de atención con valores atípicos."),
    el(
      "div",
      { class: "chips" },
      (ejemplo?.datos || []).slice(0, 12).map((v) => el("span", { class: "chip" }, fmtNum(v, { decimales: 1 }))),
      el("span", { class: "chip chip--marca" }, `+${Math.max(0, (ejemplo?.datos?.length || 0) - 12)} más`)
    ),
    boton("Cargar este ejemplo", {
      variante: "secundario",
      icono: "ejemplo",
      onClick: () => {
        if (!ejemplo) return;
        campoDatos.setValor(textoSerie(ejemplo.datos));
        actualizarContador();
        fijarPestana("pegar");
        toast("Ejemplo cargado", { tipo: "ok" });
      },
    })
  );

  const contenedorPestanas = el("div");
  const panelDatos = panel({
    titulo: "Tus datos",
    subtitulo: "Introduce los valores y pulsa Analizar para abrir resultados, gráficos y tablas en ventanas emergentes.",
    icono: "descriptiva",
    acciones: [
      boton("Limpiar", {
        variante: "fantasma",
        pequeno: true,
        icono: "limpiar",
        onClick: () => {
          campoDatos.setValor("");
          campoDatos.limpiarError();
          actualizarContador();
          resultado = null;
          errorHost.replaceChildren();
          renderBarra();
          cerrarVentanasPorAlcance("vista");
          estadoAnalisis.replaceChildren();
        },
      }),
    ],
    contenido: el("div", { class: "pila" }, contenedorPestanas, el("div", { class: "zona-pestana" })),
  });

  const botonAnalizar = boton("Analizar datos", {
    icono: "reproducir",
    dataset: { accionPrimaria: "true" },
  });

  const estadoAnalisis = el("span", { class: "calculando", role: "status", "aria-live": "polite" });
  panelDatos.cuerpo.append(
    el("div", { class: "fila", style: { marginTop: "6px" } }, botonAnalizar, estadoAnalisis)
  );

  const barraHost = el("div", { "aria-live": "polite" });
  const errorHost = el("div", { "aria-live": "polite" });

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
          el("span", { class: "ceja" }, "Explorar · Descriptiva"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("descriptiva", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Describir un conjunto de datos")
          ),
          el("p", { class: "vista__subtitulo" }, VISTAS.descriptiva.subtitulo)
        ),
        el(
          "div",
          { class: "vista__acciones" },
          boton("Teoría", {
            variante: "secundario",
            icono: "teoria",
            onClick: () => abrirTeoriaVentana("descriptiva", { alcance: "vista" }),
          })
        )
      ),
      panelDatos,
      barraHost,
      errorHost
    )
  );

  /* ------------------------- pestañas ------------------------- */

  const zonas = { pegar: zonaPegar, archivo: zonaArchivoPanel, ejemplo: zonaEjemplo };
  const selector = segmentado({
    etiqueta: "Modo de entrada de datos",
    valor: "pegar",
    opciones: [
      ["pegar", "Pegar datos"],
      ["archivo", "Archivo CSV"],
      ["ejemplo", "Ejemplo"],
    ],
    onCambio: (valor) => fijarPestana(valor),
  });
  contenedorPestanas.append(selector);
  const zonaPestana = panelDatos.cuerpo.querySelector(".zona-pestana");

  function fijarPestana(valor) {
    selector.definir(valor);
    zonaPestana.replaceChildren(zonas[valor]);
    if (valor === "archivo") selectorColumna.envoltura.classList.remove("oculto");
    else selectorColumna.envoltura.classList.add("oculto");
  }
  fijarPestana("pegar");

  /* ------------------------- contador y archivo ------------------------- */

  function actualizarContador() {
    clearTimeout(temporizadorContador);
    temporizadorContador = setTimeout(() => {
      const lectura = campoDatos.lectura();
      const n = lectura.valores.length;
      contador.textContent = lectura.error ? "Entrada sin leer" : `${n} ${n === 1 ? "valor" : "valores"}`;
      contador.className = lectura.error || lectura.avisos.length ? "chip chip--aviso" : n ? "chip chip--marca" : "chip";
      contador.title = lectura.error ? lectura.error.mensaje : lectura.avisos.join(" ");
    }, 120);
  }

  function avisarDescartes(col) {
    const n = col.descartadas?.length || 0;
    if (!n) return;
    const muestra = col.descartadas.slice(0, 3).map((v) => `«${v}»`).join(", ");
    informacionArchivo.textContent = `Columna «${col.nombre}»: se omitieron ${n} celda${n === 1 ? "" : "s"} no numérica${n === 1 ? "" : "s"} (${muestra}${n > 3 ? "…" : ""}).`;
    toast(`Se omitieron ${n} celda${n === 1 ? "" : "s"} no numérica${n === 1 ? "" : "s"}`, { tipo: "aviso" });
  }

  entradaArchivo.addEventListener("change", async () => {
    const archivo = entradaArchivo.files?.[0];
    if (!archivo) return;
    if (archivo.size > 8 * 1024 * 1024) {
      toast("El archivo supera 8 MB. Divide los datos en partes.", { tipo: "error" });
      return;
    }
    await cargarArchivo(archivo);
  });

  async function cargarArchivo(archivo) {
    try {
      const texto = await archivo.text();
      const datos = parsearCSV(texto);
      if (!datos || !datos.columnas.length) {
        toast("No se encontraron columnas numéricas en el archivo.", { tipo: "error" });
        return;
      }
      columnasArchivo = datos.columnas;
      nombreArchivo.textContent = `${archivo.name} · ${datos.filas} filas`;
      nombreArchivo.className = "chip chip--ok";
      selectorColumna.control.replaceChildren(
        ...datos.columnas.map((c) => el("option", { value: c.nombre }, `${c.nombre} (${c.valores.length})`))
      );
      selectorColumna.setValor(datos.columnas[0].nombre);
      campoDatos.setValor(textoSerie(datos.columnas[0].valores, "\n"));
      informacionArchivo.textContent = datos.columnas.length === 1
        ? `Columna única cargada (${datos.filas} filas).`
        : `Se detectaron ${datos.columnas.length} columnas numéricas.`;
      avisarDescartes(datos.columnas[0]);
      actualizarContador();
      toast("Archivo leído correctamente", { tipo: "ok" });
    } catch (error) {
      toast(`No se pudo leer el archivo: ${error.message}`, { tipo: "error" });
    }
  }

  ["dragenter", "dragover"].forEach((ev) =>
    zonaArchivo.addEventListener(ev, (e) => {
      e.preventDefault();
      zonaArchivo.dataset.arrastrando = "true";
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zonaArchivo.addEventListener(ev, (e) => {
      e.preventDefault();
      zonaArchivo.dataset.arrastrando = "false";
    })
  );
  zonaArchivo.addEventListener("drop", async (e) => {
    const archivo = e.dataTransfer?.files?.[0];
    if (archivo) await cargarArchivo(archivo);
  });

  /* ------------------------- análisis ------------------------- */

  botonAnalizar.addEventListener("click", analizar);

  function marcarDesactualizado() {
    estadoAnalisis.replaceChildren("Los datos cambiaron · vuelve a analizar");
  }

  function alertaError(mensaje) {
    errorHost.replaceChildren(alerta({ tipo: "error", titulo: "No se pudo analizar", texto: mensaje }));
  }

  async function analizar() {
    campoDatos.limpiarError();
    errorHost.replaceChildren();
    const crudo = campoDatos.texto();
    if (crudo.startsWith("[")) {
      try {
        const lista = JSON.parse(crudo);
        if (Array.isArray(lista) && lista.every((v) => typeof v === "number" && Number.isFinite(v))) {
          campoDatos.setValor(textoSerie(lista));
        }
      } catch {
        /* lector normal */
      }
    }
    const lectura = campoDatos.lectura();
    if (lectura.error) {
      campoDatos.setError(lectura.error.mensaje);
      campoDatos.enfocar();
      alertaError(`${lectura.error.mensaje} ${lectura.error.sugerencia || ""}`.trim());
      return;
    }
    if (lectura.valores.length < 2) {
      campoDatos.setError("Hacen falta al menos dos observaciones.");
      campoDatos.enfocar();
      alertaError("Necesito al menos dos observaciones numéricas para describir la muestra.");
      return;
    }
    if (lectura.valores.length > 50000) {
      campoDatos.setError("El máximo es de 50 000 observaciones.");
      alertaError("El máximo es de 50 000 observaciones. Divide el archivo o usa una muestra.");
      return;
    }
    if (controlador) controlador.abort();
    controlador = new AbortController();
    botonAnalizar.cargando(true);
    estadoAnalisis.replaceChildren(el("span", { class: "pulso" }), "Calculando…");
    try {
      const datos = await api.post("/api/descriptiva", { datos: campoDatos.texto() }, { senal: controlador.signal });
      resultado = datos;
      bins = 12;
      renderBarra();
      abrirResultadosVentana();
      if (ventanasAbiertas().some((v) => v.id === "desc-graficos")) abrirGraficosVentana({ enfocar: false });
      if (ventanasAbiertas().some((v) => v.id === "desc-tablas")) abrirTablasVentana({ enfocar: false });
      registrarHistorial({
        titulo: `Descriptiva · n = ${datos.n}`,
        detalle: `Media ${fmtNum(datos.resumen.media)} · DE ${fmtNum(datos.resumen.desviacion)}`,
        ruta: "descriptiva",
        tipo: "descriptiva",
        icono: "descriptiva",
      });
      anunciar("Análisis descriptivo actualizado.");
      estadoAnalisis.replaceChildren(`Actualizado ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`);
    } catch (error) {
      if (!esCancelacion(error)) {
        errorEnCampo(error, { datos: campoDatos });
        alertaError(textoError(error));
        estadoAnalisis.replaceChildren("No se pudo analizar");
        anunciar(`Error: ${error.message}`);
      }
    } finally {
      botonAnalizar.cargando(false);
    }
  }

  /* ------------------------- ventanas emergentes ------------------------- */

  function resumenTexto(r = resultado) {
    const s = r.resumen;
    return [
      `Análisis descriptivo (n = ${r.n})`,
      `Media: ${fmtNum(s.media)} · Mediana: ${fmtNum(s.mediana)} · DE: ${fmtNum(s.desviacion)}`,
      `Mín: ${fmtNum(s.minimo)} · Q1: ${fmtNum(s.q1)} · Q3: ${fmtNum(s.q3)} · Máx: ${fmtNum(s.maximo)}`,
      `Rango: ${fmtNum(s.rango)} · IQR: ${fmtNum(s.iqr)} · CV: ${s.cv !== null ? fmtPorcentaje(s.cv) : "—"}`,
      `Asimetría: ${fmtNum(s.sesgo)} · Curtosis: ${fmtNum(s.curtosis)}`,
      `Moda(s): ${textoModas(s)}`,
      `Atípicos: ${r.n_atipicos ?? (r.atipicos || []).length}`,
      r.interpretacion,
    ].join("\n");
  }

  function abrirGraficosVentana({ enfocar = true } = {}) {
    if (!resultado) return;
    const r = resultado;
    const s = r.resumen;
    const hostGrafico = el("div");
    const etiquetaBins = el("span", { class: "chip" }, `${bins} intervalos`);
    const rangoBins = el("input", {
      type: "range",
      min: "5",
      max: "30",
      step: "1",
      value: String(bins),
      "aria-label": "Número de intervalos del histograma",
    });
    const barraHist = el("div", { class: "fila", style: { gap: "8px" } }, etiquetaBins, rangoBins);

    const pintar = () => {
      barraHist.hidden = vistaGrafico !== "histograma";
      if (vistaGrafico === "histograma") {
        const hist = calcularHistograma(r.ordenados, bins);
        if (!hist) return;
        etiquetaBins.textContent = `${bins} intervalos`;
        dibujar(hostGrafico, {
          tipo: "barras",
          series: [{ nombre: "Frecuencia", x: hist.centros, y: hist.conteos, tipo: "barra", color: "var(--grafico-1)" }],
          xlabel: "Valor",
          ylabel: "Frecuencia",
          altura: 330,
          yCero: true,
          marcador: { x: s.media, etiqueta: "media" },
          ariaLabel: "Histograma de frecuencias de la muestra",
        });
      } else if (vistaGrafico === "caja") {
        graficoCaja(hostGrafico, { ...r.caja, atipicos: r.atipicos });
      } else {
        const ecdf = calcularECDF(r.ordenados);
        if (!ecdf) return;
        dibujar(hostGrafico, {
          tipo: "linea",
          series: [{ nombre: "Fₙ(x)", x: ecdf.x, y: ecdf.y, color: "var(--grafico-2)", escalon: true, marcadores: false, trazo: "" }],
          xlabel: "x",
          ylabel: "Proporción acumulada",
          altura: 320,
          dominioY: [0, 1],
          ariaLabel: "Función de distribución empírica",
        });
      }
    };

    rangoBins.addEventListener("input", () => {
      bins = Number(rangoBins.value);
      pintar();
    });

    const control = segmentado({
      etiqueta: "Tipo de gráfico",
      valor: vistaGrafico,
      opciones: [
        ["histograma", "Histograma"],
        ["caja", "Caja y bigotes"],
        ["ecdf", "Acumulada (ECDF)"],
      ],
      onCambio: (nuevo) => {
        vistaGrafico = nuevo;
        pintar();
      },
    });

    abrirVentana({
      id: "desc-graficos",
      titulo: `Gráficos · Descriptiva (n = ${r.n})`,
      tituloCorto: "Gráficos",
      subtitulo: "Histograma, diagrama de caja y distribución empírica",
      icono: "grafico",
      tipo: "grafico",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("PNG", { variante: "fantasma", pequeno: true, icono: "imagen", onClick: (e) => exportar("png", e.currentTarget) }),
      ],
      contenido: el(
        "div",
        { class: "pila" },
        el("div", { class: "fila fila--entre", style: { flexWrap: "wrap", gap: "8px" } }, control, barraHist),
        hostGrafico
      ),
      pie: el(
        "div",
        { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana() }),
        boton("Tablas", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: () => abrirTablasVentana() })
      ),
    });
    pintar();
  }

  function abrirTablasVentana({ enfocar = true } = {}) {
    if (!resultado) return;
    const r = resultado;
    const hostContenido = el("div");

    const pintar = () => {
      if (vistaTabla === "resumen") {
        hostContenido.replaceChildren(tabla({ ...configTablaResumen(r), maximo: 40, total: 19 }));
      } else if (vistaTabla === "frecuencias") {
        hostContenido.replaceChildren(tabla({ ...r.frecuencias, maximo: 120, altura: "alta" }));
      } else {
        const atipicos = r.atipicos || [];
        hostContenido.replaceChildren(
          atipicos.length
            ? el(
                "div",
                { class: "pila pila--sm" },
                el("p", { class: "texto-tenue texto-pequeno" }, `Criterio de Tukey: fuera de ${fmtIntervalo(r.limites_atipicos)} (${r.n_atipicos ?? atipicos.length} detectados).`),
                el("div", { class: "lista-atipicos", style: { maxHeight: "none" } }, atipicos.slice(0, 100).map((v) => el("span", { class: "valor-atipico" }, fmtNum(v)))),
                el("p", { class: "texto-tenue texto-pequeno" }, "Un atípico no es necesariamente un error: puede reflejar un caso real o una distribución de cola pesada.")
              )
            : alerta({ tipo: "ok", texto: "No se detectaron valores atípicos con el criterio 1,5 · IQR." })
        );
      }
    };

    const control = segmentado({
      etiqueta: "Vista de tabla",
      valor: vistaTabla,
      opciones: [
        ["resumen", "Resumen (19)"],
        ["frecuencias", "Frecuencias"],
        ["atipicos", `Atípicos (${r.n_atipicos ?? (r.atipicos || []).length})`],
      ],
      onCambio: (nuevo) => {
        vistaTabla = nuevo;
        pintar();
      },
    });

    abrirVentana({
      id: "desc-tablas",
      titulo: `Tablas · Descriptiva (n = ${r.n})`,
      tituloCorto: "Tablas",
      subtitulo: "Estadísticos completos, frecuencias y atípicos",
      icono: "tabla",
      tipo: "tabla",
      alcance: "vista",
      enfocar,
      accionesCabecera: [
        boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(resumenTexto()) }),
        boton("CSV", { variante: "fantasma", pequeno: true, icono: "descargar", onClick: (e) => exportar("csv", e.currentTarget) }),
        boton("Excel", { variante: "fantasma", pequeno: true, icono: "tabla", onClick: (e) => exportar("xlsx", e.currentTarget) }),
      ],
      contenido: el("div", { class: "pila" }, control, hostContenido),
      pie: el(
        "div",
        { class: "fila", style: { gap: "6px" } },
        boton("Resultados", { variante: "fantasma", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana() }),
        boton("Gráficos", { variante: "fantasma", pequeno: true, icono: "grafico", onClick: () => abrirGraficosVentana() })
      ),
    });
    pintar();
  }

  function abrirResultadosVentana({ enfocar = true } = {}) {
    if (!resultado) return;
    const r = resultado;
    const s = r.resumen;

    const kpis = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: "Observaciones", valor: fmtNum(r.n, { entero: true }), detalle: "n" }),
      kpi({ etiqueta: "Media", valor: fmtNum(s.media), detalle: `IC ${fmtPorcentaje(s.ic_nivel ?? 0.95, 0)}: ${fmtIntervalo(s.ic_media)}`, tono: "marca" }),
      kpi({ etiqueta: "Mediana", valor: fmtNum(s.mediana), detalle: "percentil 50" }),
      kpi({ etiqueta: "Desviación", valor: fmtNum(s.desviacion), detalle: "muestral (n−1)" }),
      kpi({ etiqueta: "Coef. variación", valor: s.cv !== null ? fmtPorcentaje(s.cv) : "—", detalle: "dispersión relativa" }),
      kpi({ etiqueta: "IQR", valor: fmtNum(s.iqr), detalle: `Q1 ${fmtNum(s.q1)} · Q3 ${fmtNum(s.q3)}` })
    );

    const cuerpo = el(
      "div",
      { class: "pila" },
      alerta({ tipo: "info", titulo: "Lectura rápida", texto: r.interpretacion }),
      avisosMotor(r.avisos),
      kpis,
      el(
        "div",
        { class: "fila fila--entre", style: { flexWrap: "wrap", gap: "8px" } },
        el(
          "div",
          { class: "fila", style: { gap: "6px" } },
          boton("Enviar a inferencia", {
            variante: "secundario",
            pequeno: true,
            icono: "inferencia",
            onClick: () => {
              transito.inferencia = { prueba: "t_una", campos: { datos: r.ordenados } };
              navegar("inferencia/t_una");
            },
          }),
          boton("Probar normalidad", {
            variante: "fantasma",
            pequeno: true,
            icono: "simulacion",
            onClick: () => {
              transito.simulacion = { tipo: "ajuste", clave: "normal", datos: r.ordenados };
              navegar("simulacion/ajuste");
            },
          })
        ),
        r.nota ? el("span", { class: "texto-tenue texto-pequeno" }, r.nota) : null
      )
    );

    const pie = el(
      "div",
      { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
      el(
        "div",
        { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
        boton("Ver gráficos", { variante: "primario", pequeno: true, icono: "grafico", onClick: () => abrirGraficosVentana() }),
        boton("Ver tablas", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTablasVentana() }),
        boton("Teoría", { variante: "fantasma", pequeno: true, icono: "teoria", onClick: () => abrirTeoriaVentana("descriptiva", { alcance: "vista" }) })
      ),
      el(
        "div",
        { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
        boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(resumenTexto()) }),
        ...botonesExportar(["pdf", "xlsx", "png", "csv"], (formato, nodo) => exportar(formato, nodo), { variante: "fantasma" })
      )
    );

    abrirVentana({
      id: "desc-resultados",
      titulo: `Resultados · Descriptiva (n = ${r.n})`,
      tituloCorto: `Resultados (n = ${r.n})`,
      subtitulo: `Media ${fmtNum(s.media)} · Mediana ${fmtNum(s.mediana)} · DE ${fmtNum(s.desviacion)}`,
      icono: "objetivo",
      tipo: "resultados",
      alcance: "vista",
      enfocar,
      contenido: cuerpo,
      pie,
    });
  }

  function renderBarra() {
    if (!resultado) {
      barraHost.replaceChildren();
      return;
    }
    const r = resultado;
    barraHost.replaceChildren(
      barraResultados({
        icono: "descriptiva",
        resumen: `n = ${r.n} · Media = ${fmtNum(r.resumen.media)} · Mediana = ${fmtNum(r.resumen.mediana)}`,
        botones: [
          boton("Resultados", { variante: "primario", pequeno: true, icono: "objetivo", onClick: () => abrirResultadosVentana() }),
          boton("Gráficos", { variante: "secundario", pequeno: true, icono: "grafico", onClick: () => abrirGraficosVentana() }),
          boton("Tablas", { variante: "secundario", pequeno: true, icono: "tabla", onClick: () => abrirTablasVentana() }),
        ],
      })
    );
  }

  async function exportar(formato, botonNodo) {
    if (!resultado) return;
    const hist = calcularHistograma(resultado.ordenados, Number(bins || 12));
    const figura = hist
      ? {
          series: [{ nombre: "Frecuencia", x: hist.centros, y: hist.conteos, tipo: "barra" }],
          marcador: resultado.resumen.media,
          xlabel: "Valor",
          ylabel: "Frecuencia",
          titulo: "Histograma de la muestra",
        }
      : null;
    const tablas = [
      { nombre: "Resumen", ...configTablaResumen(resultado) },
      { nombre: "Frecuencias", ...resultado.frecuencias },
    ];
    if (formato === "png" && !figura) {
      toast("Este conjunto no permite dibujar un histograma para exportar como imagen.", { tipo: "aviso" });
      return;
    }
    await conCarga(botonNodo, async () => {
      try {
        await api.exportar({
          formato,
          titulo: "Análisis descriptivo · AmPu 3.2",
          resumen: resumenTexto(),
          tablas,
          figura,
          vista: "descriptiva",
          estado: { datos: resultado.ordenados.slice(0, 5000) },
        });
        toast(`Archivo ${formato.toUpperCase()} generado`, { tipo: "ok" });
      } catch (error) {
        if (!esCancelacion(error)) toast(textoError(error), { tipo: "error" });
      }
    });
  }

  actualizarContador();

  return () => {
    if (controlador) controlador.abort();
  };
}
