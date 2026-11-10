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
  fmtPorcentaje,
  segmentado,
  anunciar,
  pliegue,
} from "../ui.js";
import { icono } from "../icons.js";
import { dibujar, graficoCaja, calcularHistograma, calcularECDF } from "../chart.js";
import {
  cargarEjemplos,
  navegar,
  registrarHistorial,
  transito,
} from "../store.js";
import { api, esCancelacion } from "../api.js";

function parsearDatos(texto, { separador = "auto", comaDecimal = false } = {}) {
  const limpio = String(texto || "").trim();
  if (!limpio) return { valores: [], invalidos: [], crudos: [] };
  if (limpio.startsWith("[")) {
    try {
      const lista = JSON.parse(limpio);
      if (!Array.isArray(lista)) return { valores: [], invalidos: [limpio.slice(0, 30)], crudos: [] };
      const valores = lista.map((v) => Number(v));
      return {
        valores: valores.filter((v) => Number.isFinite(v)),
        invalidos: lista.filter((v, i) => !Number.isFinite(valores[i])).slice(0, 4),
        crudos: lista,
      };
    } catch {
      /* continúa con el análisis de texto */
    }
  }

  let normalizado = limpio;
  let patron;
  const tieneLineas = /[\n;]/.test(limpio);
  if (separador === "lineas") patron = /[\n;]+/;
  else if (separador === "comas") patron = /[\s,;]+/;
  else if (separador === "puntoycoma") patron = /[\n;]+/;
  else if (separador === "espacios") patron = /\s+/;
  else {
    // Auto: si hay líneas o punto y coma, la coma puede ser decimal; si no, es separador.
    if (tieneLineas || /\t/.test(limpio)) {
      patron = /[\s;]+/;
      normalizado = normalizado.replace(/,/g, ".");
    } else if (/\s/.test(limpio.trim()) && /,/.test(limpio)) {
      // Coma entre dígitos = decimal; coma junto a espacio = separador.
      normalizado = normalizado.replace(/(\d),(\d)/g, "$1.$2");
      patron = /[\s,;]+/;
    } else {
      patron = /[\s,;]+/;
    }
  }
  if (comaDecimal && separador !== "comas") {
    normalizado = normalizado.replace(/,/g, ".");
  }
  const crudos = normalizado.split(patron).map((v) => v.trim()).filter(Boolean);
  const valores = [];
  const invalidos = [];
  for (const crudo of crudos) {
    const numero = Number(crudo.replace(",", "."));
    if (Number.isFinite(numero)) valores.push(numero);
    else invalidos.push(crudo);
  }
  return { valores, invalidos: invalidos.slice(0, 5), crudos };
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
  const primeraNumerica = cabecera.every((c) => c === "" || Number.isFinite(Number(c.replace(",", "."))));
  const nombres = primeraNumerica ? cabecera.map((_, i) => `Columna ${i + 1}`) : cabecera.map((c, i) => c || `Columna ${i + 1}`);
  const cuerpo = primeraNumerica ? filas : filas.slice(1);
  const columnas = [];
  for (let i = 0; i < ancho; i++) {
    const valoresCrudos = cuerpo.map((f) => (f[i] ?? "").trim());
    const validos = valoresCrudos.filter(Boolean);
    const numeros = validos.map((v) => Number(v.replace(",", ".")));
    const nValidos = numeros.filter(Number.isFinite).length;
    if (!validos.length || nValidos / validos.length < 0.7) continue;
    columnas.push({
      nombre: nombres[i] || `Columna ${i + 1}`,
      valores: numeros.filter(Number.isFinite),
      faltantes: valoresCrudos.filter((v) => !v).length,
    });
  }
  return { columnas, filas: cuerpo.length, delimitador };
}

function configTablaResumen(resultado) {
  const r = resultado.resumen;
  const filas = [
    ["Observaciones", resultado.n],
    ["Suma", r.suma],
    ["Media", r.media],
    ["Mediana", r.mediana],
    ["Moda(s)", (r.modas || []).map((m) => fmtNum(m)).join(", ") || "—"],
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
    ["IC 95 % para la media", `[${fmtNum(r.ic_media[0])}, ${fmtNum(r.ic_media[1])}]`],
    ["Asimetría (sesgo)", r.sesgo],
    ["Curtosis (exceso)", r.curtosis],
    ["Valores atípicos (1,5 · IQR)", resultado.atipicos?.length ?? 0],
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
  let pestaña = "pegar";
  let bins = null;

  const campoDatos = campo({
    etiqueta: "Datos numéricos",
    tipo: "serie",
    valor: "",
    filas: 9,
    ayuda: "Separa con espacios, comas o saltos de línea. También puedes pegar una lista JSON.",
    placeholder: "12, 14, 13, 12, 15, 18, 11, 40…",
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
      el("span", { class: "texto-tenue texto-pequeno" }, "Los valores se validan antes de enviarlos al motor."),
      contador
    ),
    pliegue({
      titulo: "Opciones de importación",
      icono: "ajustes",
      contenido: el(
        "div",
        { class: "columnas-formulario" },
        campo({
          etiqueta: "Separador",
          tipo: "select",
          id: "sep-datos",
          valor: "auto",
          opciones: [
            ["auto", "Detectar automáticamente"],
            ["lineas", "Líneas o punto y coma"],
            ["comas", "Comas"],
            ["espacios", "Espacios"],
            ["puntoycoma", "Punto y coma"],
          ],
        }).envoltura,
        campo({
          etiqueta: "Coma decimal",
          tipo: "checkbox",
          id: "coma-decimal",
          valor: false,
          ayuda: "Marca esta opción si escribes 3,14 en lugar de 3.14.",
        }).envoltura
      ),
    })
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
        campoDatos.setValor(col.valores.join("\n"));
        actualizarContador();
        toast(`Columna «${col.nombre}» cargada con ${col.valores.length} valores`, { tipo: "ok" });
      }
    },
  });
  const informacionArchivo = el("p", { class: "texto-tenue texto-pequeno" }, "Formatos: CSV, TSV o TXT. Se detectan cabecera y columnas numéricas.");
  const entradaArchivo = el("input", { type: "file", id: "archivo-datos", accept: ".csv,.tsv,.txt,text/csv,text/plain", hidden: true });
  const zonaArchivo = el(
    "label",
    { class: "zona-archivo", for: "archivo-datos", tabindex: "0" },
    icono("archivo", { tamano: 22 }),
    el("strong", {}, "Arrastra un CSV o haz clic para elegirlo"),
    el("span", {}, "El archivo se procesa en tu navegador; no se envía a ningún servidor.")
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
    el(
      "p",
      {},
      ejemplo?.descripcion || "Tiempos de atención con valores atípicos, útil para practicar el resumen y el diagrama de caja."
    ),
    el(
      "div",
      { class: "chips" },
      (ejemplo?.datos || []).slice(0, 12).map((v) => el("span", { class: "chip" }, fmtNum(v, { decimales: 1 }))),
      el("span", { class: "chip chip--marca" }, `+${Math.max(0, (ejemplo?.datos?.length || 0) - 12)} más`)
    ),
    boton("Cargar este ejemplo", {
      variante: "secundario",
      icono: "descargar",
      onClick: () => {
        if (!ejemplo) return;
        campoDatos.setValor(ejemplo.datos.join(", "));
        actualizarContador();
        fijarPestana("pegar");
        toast("Ejemplo cargado", { tipo: "ok" });
      },
    })
  );

  const contenedorPestanas = el("div");
  const panelDatos = panel({
    titulo: "Tus datos",
    subtitulo: "Todo ocurre en tu equipo. Nada se envía fuera.",
    icono: "descriptiva",
    acciones: [
      boton("Limpiar", {
        variante: "fantasma",
        pequeno: true,
        icono: "basura",
        onClick: () => {
          campoDatos.setValor("");
          actualizarContador();
          resultado = null;
          renderInicial();
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
  const accionesDatos = el(
    "div",
    { class: "fila fila--entre", style: { marginTop: "6px" } },
    el("div", { class: "fila" }, botonAnalizar, estadoAnalisis),
    el(
      "span",
      { class: "texto-tenue texto-pequeno" },
      "Consejo: revisa los atípicos antes de calcular medias."
    )
  );
  panelDatos.cuerpo.append(accionesDatos);

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
          el("span", { class: "ceja" }, "Explorar · Descriptiva"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("descriptiva", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Describir un conjunto de datos")
          ),
          el(
            "p",
            { class: "vista__subtitulo" },
            "Obtén centro, dispersión, forma y atípicos antes de decidir. El histograma y la caja se recalculan al instante y puedes exportar el informe completo."
          )
        ),
        el(
          "div",
          { class: "vista__acciones" },
          boton("Leer sobre descriptiva", {
            variante: "secundario",
            icono: "teoria",
            onClick: () => navegar("teoria/descriptiva"),
          })
        )
      ),
      panelDatos,
      resultadoHost
    )
  );

  /* ------------------------- pestañas ------------------------- */

  const zonas = {
    pegar: zonaPegar,
    archivo: zonaArchivoPanel,
    ejemplo: zonaEjemplo,
  };
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
    pestaña = valor;
    selector.definir(valor);
    zonaPestana.replaceChildren(zonas[valor]);
    if (valor === "archivo") selectorColumna.envoltura.classList.remove("oculto");
    else selectorColumna.envoltura.classList.add("oculto");
  }
  fijarPestana("pegar");

  /* ------------------------- contador y parseo ------------------------- */

  function actualizarContador() {
    clearTimeout(temporizadorContador);
    temporizadorContador = setTimeout(() => {
      const opciones = leerOpciones();
      const { valores, invalidos } = parsearDatos(campoDatos.texto(), opciones);
      contador.textContent = `${valores.length} ${valores.length === 1 ? "valor" : "valores"}`;
      contador.className = invalidos.length ? "chip chip--aviso" : valores.length ? "chip chip--marca" : "chip";
      contador.title = invalidos.length ? `Valores no numéricos: ${invalidos.join(", ")}` : "";
    }, 120);
  }

  function leerOpciones() {
    return {
      separador: document.getElementById("sep-datos")?.value || "auto",
      comaDecimal: Boolean(document.getElementById("coma-decimal")?.checked),
    };
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
      if (datos.columnas.length === 1) {
        selectorColumna.setValor(datos.columnas[0].nombre);
        campoDatos.setValor(datos.columnas[0].valores.join("\n"));
        informacionArchivo.textContent = `Se usó la única columna numérica. ${datos.filas} filas leídas.`;
      } else {
        informacionArchivo.textContent = `Se detectaron ${datos.columnas.length} columnas numéricas. Elige una para analizar.`;
        campoDatos.setValor(datos.columnas[0].valores.join("\n"));
        selectorColumna.setValor(datos.columnas[0].nombre);
      }
      actualizarContador();
      toast("Archivo leído correctamente", { tipo: "ok" });
    } catch (error) {
      toast(`No se pudo leer el archivo: ${error.message}`, { tipo: "error" });
    }
  }

  /* Zona de arrastre */
  ["dragenter", "dragover"].forEach((evento) =>
    zonaArchivo.addEventListener(evento, (e) => {
      e.preventDefault();
      zonaArchivo.dataset.arrastrando = "true";
    })
  );
  ["dragleave", "drop"].forEach((evento) =>
    zonaArchivo.addEventListener(evento, (e) => {
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

  async function analizar() {
    const opciones = leerOpciones();
    const { valores, invalidos } = parsearDatos(campoDatos.texto(), opciones);
    if (invalidos.length) {
      alertaError(`Hay valores que no son números: ${invalidos.join(", ")}. Corrige el texto o cambia el separador.`);
      return;
    }
    if (valores.length < 2) {
      alertaError("Necesito al menos dos observaciones numéricas para describir la muestra.");
      return;
    }
    if (valores.length > 50000) {
      alertaError("El máximo es de 50 000 observaciones. Divide el archivo o usa una muestra.");
      return;
    }
    if (controlador) controlador.abort();
    controlador = new AbortController();
    botonAnalizar.cargando(true);
    estadoAnalisis.replaceChildren(el("span", { class: "pulso" }), "Calculando…");
    resultadoHost.setAttribute("aria-busy", "true");
    try {
      const datos = await api.post("/api/descriptiva", { datos: valores }, { senal: controlador.signal });
      resultado = datos;
      bins = null;
      renderResultado();
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
        alertaError(error.message);
        toast(error.message, { tipo: "error" });
      }
    } finally {
      botonAnalizar.cargando(false);
      resultadoHost.setAttribute("aria-busy", "false");
    }
  }

  function alertaError(mensaje) {
    const previo = resultadoHost.querySelector(".alerta--error");
    if (previo) previo.remove();
    resultadoHost.prepend(alerta({ tipo: "error", titulo: "No se pudo analizar", texto: mensaje }));
  }

  /* ------------------------- resultados ------------------------- */

  function resumenTexto(r = resultado) {
    const s = r.resumen;
    return [
      `Análisis descriptivo (n = ${r.n})`,
      `Media: ${fmtNum(s.media)} · Mediana: ${fmtNum(s.mediana)} · DE: ${fmtNum(s.desviacion)}`,
      `Mín: ${fmtNum(s.minimo)} · Q1: ${fmtNum(s.q1)} · Q3: ${fmtNum(s.q3)} · Máx: ${fmtNum(s.maximo)}`,
      `Rango: ${fmtNum(s.rango)} · IQR: ${fmtNum(s.iqr)} · CV: ${s.cv !== null ? fmtPorcentaje(s.cv) : "—"}`,
      `Asimetría: ${fmtNum(s.sesgo)} · Curtosis: ${fmtNum(s.curtosis)}`,
      `Atípicos: ${(r.atipicos || []).length}`,
      r.interpretacion,
    ].join("\n");
  }

  function renderInicial() {
    resultadoHost.replaceChildren(
      panel({
        titulo: "Sin análisis todavía",
        icono: "chispa",
        contenido: estadoVacio({
          icono: "descriptiva",
          titulo: "Pega una columna de números",
          texto: "Verás media, mediana, dispersión, forma, histograma, caja y valores atípicos. Si no tienes datos a mano, carga el ejemplo.",
          acciones: [
            boton("Cargar ejemplo", {
              icono: "descargar",
              onClick: () => {
                if (!ejemplo) return;
                campoDatos.setValor(ejemplo.datos.join(", "));
                actualizarContador();
                fijarPestana("pegar");
                analizar();
              },
            }),
          ],
        }),
      })
    );
  }

  function renderResultado() {
    const r = resultado;
    const s = r.resumen;
    const desactualizado = false;

    const kpis = el(
      "div",
      { class: "rejilla rejilla--kpi" },
      kpi({ etiqueta: "Observaciones", valor: fmtNum(r.n, { entero: true }), detalle: "n" }),
      kpi({ etiqueta: "Media", valor: fmtNum(s.media), detalle: `IC 95 %: ${fmtNum(s.ic_media[0])} – ${fmtNum(s.ic_media[1])}`, tono: "marca" }),
      kpi({ etiqueta: "Mediana", valor: fmtNum(s.mediana), detalle: "percentil 50" }),
      kpi({ etiqueta: "Desviación", valor: fmtNum(s.desviacion), detalle: "muestral (n−1)" }),
      kpi({ etiqueta: "Coef. variación", valor: s.cv !== null ? fmtPorcentaje(s.cv) : "—", detalle: "dispersión relativa" }),
      kpi({ etiqueta: "Rango intercuartílico", valor: fmtNum(s.iqr), detalle: `Q1 ${fmtNum(s.q1)} · Q3 ${fmtNum(s.q3)}` }),
    );

    const hostHistograma = el("div");
    const etiquetaBins = el("span", { class: "chip" }, "");
    const rangoBins = el("input", {
      type: "range",
      min: "5",
      max: "30",
      step: "1",
      value: "12",
      "aria-label": "Número de intervalos del histograma",
    });

    const pintarHistograma = () => {
      const numeroBins = Number(rangoBins.value);
      const hist = calcularHistograma(r.ordenados, numeroBins);
      if (!hist) return;
      etiquetaBins.textContent = `${numeroBins} intervalos`;
      dibujar(hostHistograma, {
        tipo: "barras",
        series: [{ nombre: "Frecuencia", x: hist.centros, y: hist.conteos, tipo: "barra", color: "var(--grafico-1)" }],
        xlabel: "Valor",
        ylabel: "Frecuencia",
        altura: 280,
        yCero: true,
        marcador: { x: s.media, etiqueta: "media" },
        ariaLabel: "Histograma de frecuencias de la muestra",
      });
    };
    rangoBins.addEventListener("input", () => {
      bins = Number(rangoBins.value);
      pintarHistograma();
    });
    setTimeout(pintarHistograma, 0);

    const panelHistograma = panel({
      titulo: "Histograma",
      subtitulo: r.n > r.ordenados.length
        ? `Calculado sobre una submuestra uniforme de ${fmtNum(r.ordenados.length, { entero: true })} valores.`
        : "Ajusta los intervalos para observar la forma.",
      icono: "histograma",
      acciones: el("div", { class: "fila", style: { gap: "8px" } }, etiquetaBins, rangoBins),
      contenido: hostHistograma,
    });

    const hostCaja = el("div");
    setTimeout(() => {
      graficoCaja(hostCaja, { ...r.caja, atipicos: r.atipicos });
    }, 0);
    const panelCaja = panel({
      titulo: "Caja y bigotes",
      subtitulo: "Los puntos fuera de los bigotes son candidatos a atípicos (1,5 · IQR).",
      icono: "caja",
      contenido: hostCaja,
    });

    const panelStats = panel({
      titulo: "Resumen completo",
      subtitulo: "Todos los estadísticos en un solo lugar.",
      icono: "tabla",
      acciones: [
        boton("Copiar", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(resumenTexto()) }),
        boton("Excel", { variante: "fantasma", pequeno: true, icono: "descargar", onClick: (e) => exportar("xlsx", e.currentTarget) }),
        boton("PDF", { variante: "fantasma", pequeno: true, icono: "documento", onClick: (e) => exportar("pdf", e.currentTarget) }),
        boton("PNG", { variante: "fantasma", pequeno: true, icono: "grafico", onClick: (e) => exportar("png", e.currentTarget) }),
      ],
      contenido: tabla({ ...configTablaResumen(r), maximo: 40, total: 19 }),
    });

    const atipicos = r.atipicos || [];
    const panelAtipicos = panel({
      titulo: "Valores atípicos",
      subtitulo: `Criterio de Tukey: fuera de [${fmtNum(r.limites_atipicos[0])}, ${fmtNum(r.limites_atipicos[1])}]`,
      icono: "alerta",
      contenido: atipicos.length
        ? el(
            "div",
            { class: "pila pila--sm" },
            el("div", { class: "lista-atipicos" }, atipicos.slice(0, 60).map((v) => el("span", { class: "valor-atipico" }, fmtNum(v)))),
            el(
              "p",
              { class: "texto-tenue texto-pequeno" },
              "Un atípico no es un error: puede ser un caso real, un registro mal medido o una señal de cola pesada. Investígalo antes de eliminarlo."
            )
          )
        : el("p", { class: "texto-tenue texto-pequeno" }, "No se detectaron valores fuera de los bigotes con el criterio 1,5 · IQR.")
    });

    const panelFrecuencias = panel({
      titulo: "Tabla de frecuencias",
      subtitulo: "Útil con datos discretos o pocos valores distintos.",
      icono: "tabla",
      contenido: pliegue({
        titulo: `Ver frecuencias (${fmtNum(r.frecuencias.total, { entero: true })} valores distintos)`,
        contenido: tabla({ ...r.frecuencias, maximo: 60 }),
      }),
    });

    const panelEcdf = panel({
      titulo: "Distribución acumulada empírica",
      subtitulo: "Proporción de observaciones menores o iguales que cada valor.",
      icono: "grafico",
      contenido: (() => {
        const hostEcdf = el("div");
        setTimeout(() => {
          const ecdf = calcularECDF(r.ordenados);
          if (!ecdf) return;
          dibujar(hostEcdf, {
            tipo: "linea",
            series: [{ nombre: "Fₙ(x)", x: ecdf.x, y: ecdf.y, color: "var(--grafico-2)" }],
            xlabel: "x",
            ylabel: "Proporción acumulada",
            altura: 230,
            dominioY: [0, 1],
            ariaLabel: "Función de distribución empírica",
          });
        }, 0);
        return hostEcdf;
      })(),
    });

    const acciones = el(
      "div",
      { class: "grupo-botones" },
      boton("Enviar a inferencia", {
        variante: "secundario",
        pequeno: true,
        icono: "inferencia",
        onClick: () => {
          transito.inferencia = { prueba: "t_una", campos: { datos: r.ordenados } };
          navegar("inferencia/t_una");
        },
      }),
      boton("Probar ajuste de normalidad", {
        variante: "fantasma",
        pequeno: true,
        icono: "simulacion",
        onClick: () => {
          transito.simulacion = { tipo: "ajuste", clave: "normal", datos: r.ordenados };
          navegar("simulacion/ajuste");
        },
      })
    );

    resultadoHost.replaceChildren(
      el(
        "div",
        { class: "pila" },
        alerta({ tipo: "info", titulo: "Lectura rápida", texto: r.interpretacion }),
        kpis,
        el("div", { class: "rejilla rejilla--2" }, panelHistograma, panelCaja),
        el("div", { class: "rejilla rejilla--2" }, panelStats, panelAtipicos),
        el("div", { class: "rejilla rejilla--2" }, panelEcdf, panelFrecuencias),
        el("div", { class: "fila fila--entre" }, acciones, el("span", { class: "texto-tenue texto-pequeno" }, r.nota))
      )
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
    await conCarga(botonNodo, async () => {
      try {
        await api.exportar({
          formato,
          titulo: "Análisis descriptivo · AmPu 3.1",
          resumen: resumenTexto(),
          tablas,
          figura,
          vista: "descriptiva",
          estado: { datos: resultado.ordenados.slice(0, 5000) },
        });
        toast(`Archivo ${formato.toUpperCase()} generado`, { tipo: "ok" });
      } catch (error) {
        if (!esCancelacion(error)) toast(error.message, { tipo: "error" });
      }
    });
  }

  renderInicial();
  actualizarContador();

  return () => {
    if (controlador) controlador.abort();
    if (resultadoHost.querySelector(".grafico")?._observadorGrafico) {
      resultadoHost.querySelectorAll(".grafico").forEach((g) => g._observadorGrafico?.disconnect());
    }
  };
}
