import {
  el,
  panel,
  boton,
  campo,
  alerta,
  textoError,
  toast,
  confirmar,
  copiar,
  conCarga,
  fmtNum,
  fmtP,
  fechaRelativa,
  descargarTexto,
  anunciar,
} from "../ui.js";
import { icono } from "../icons.js";
import { api } from "../api.js";
import {
  PREFERENCIAS_POR_DEFECTO,
  cargarMeta,
  guardarPrefs,
  historial,
  limpiarHistorial,
  navegar,
  prefs,
  temaResuelto,
} from "../store.js";
import { ATAJOS } from "../data.js";

const CLAVE_PREFS_EXPORT = "ampu.prefs.v1";

const TEMAS = [
  { clave: "claro", nombre: "Claro", descripcion: "Fondo claro y tinta verde." },
  { clave: "oscuro", nombre: "Oscuro", descripcion: "Menos luz, mismo contraste." },
  { clave: "sistema", nombre: "Sistema", descripcion: "Sigue la preferencia del equipo." },
];

const NOTACIONES = [
  ["auto", "Automática"],
  ["fija", "Decimal fija"],
  ["cientifica", "Científica"],
];

function leerPrefsImportadas(texto) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error("El archivo no es JSON válido.");
  }
  const fuente = datos && typeof datos === "object" && datos.prefs ? datos.prefs : datos;
  if (!fuente || typeof fuente !== "object") throw new Error("El archivo no contiene preferencias.");
  const limpio = {};
  for (const clave of Object.keys(PREFERENCIAS_POR_DEFECTO)) {
    if (fuente[clave] === undefined) continue;
    const valor = fuente[clave];
    if (clave === "decimales") {
      const numero = Number(valor);
      if (Number.isFinite(numero)) limpio[clave] = Math.max(0, Math.min(10, numero));
    } else if (clave === "tema" && ["claro", "oscuro", "sistema"].includes(valor)) {
      limpio[clave] = valor;
    } else if (clave === "notacion" && ["auto", "fija", "cientifica"].includes(valor)) {
      limpio[clave] = valor;
    } else if (clave === "densidad" && ["comoda", "compacta"].includes(valor)) {
      limpio[clave] = valor;
    } else if (["calculo_automatico", "sidebar", "reducir_movimiento"].includes(clave)) {
      limpio[clave] = Boolean(valor);
    }
  }
  if (!Object.keys(limpio).length) throw new Error("No se reconoció ninguna preferencia válida.");
  return limpio;
}

export async function montar(host) {
  let metaDatos = null;
  let salud = null;
  try {
    metaDatos = await cargarMeta();
  } catch {
    /* la vista de ajustes funciona aunque el motor no responda */
  }
  try {
    salud = await api.get("/api/salud");
  } catch {
    salud = null;
  }

  let historialActual = historial();

  /* --------------------------- apariencia --------------------------- */

  const temaBotones = new Map();
  const rejillaTemas = el("div", { class: "rejilla rejilla--3" });

  function pintarTemas() {
    rejillaTemas.replaceChildren();
    for (const tema of TEMAS) {
      const activo = prefs.tema === tema.clave;
      const boton = el(
        "button",
        {
          type: "button",
          class: `tema-opcion ${activo ? "tema-opcion--activa" : ""}`,
          "aria-pressed": String(activo),
          onClick: () => {
            guardarPrefs({ tema: tema.clave });
            pintarTemas();
            anunciar(`Tema ${tema.nombre}.`);
          },
        },
        el("span", { class: `tema-opcion__muestra tema-opcion__muestra--${tema.clave}` }, el("span", { class: "tema-opcion__linea" }), el("span", { class: "tema-opcion__linea tema-opcion__linea--corta" }), el("span", { class: "tema-opcion__bloque" })),
        el("span", { class: "tema-opcion__nombre" }, tema.nombre, activo ? icono("comprobar", { tamano: 13 }) : null),
        el("span", { class: "tema-opcion__texto" }, tema.descripcion)
      );
      temaBotones.set(tema.clave, boton);
      rejillaTemas.append(boton);
    }
  }

  const selectorDensidad = campo({
    etiqueta: "Densidad de la interfaz",
    tipo: "select",
    valor: prefs.densidad,
    opciones: [["comoda", "Cómoda (más aire)"], ["compacta", "Compacta (más datos en pantalla)"]],
    onCambio: (valor) => {
      guardarPrefs({ densidad: valor });
      toast("Densidad actualizada", { tipo: "ok", duracion: 2200 });
    },
  });

  const casillaMovimiento = campo({
    etiqueta: "Reducir animaciones",
    tipo: "checkbox",
    valor: Boolean(prefs.reducir_movimiento),
    ayuda: "Desactiva transiciones y desplazamientos suaves si te distraen o afectan al rendimiento.",
  });
  casillaMovimiento.control.addEventListener("change", () => {
    guardarPrefs({ reducir_movimiento: casillaMovimiento.control.checked });
  });

  const casillaSidebar = campo({
    etiqueta: "Mantener la barra lateral visible",
    tipo: "checkbox",
    valor: prefs.sidebar !== false,
    ayuda: "En pantallas grandes, deja la navegación fija mientras trabajas.",
  });
  casillaSidebar.control.addEventListener("change", () => {
    guardarPrefs({ sidebar: casillaSidebar.control.checked });
  });

  /* --------------------------- números --------------------------- */

  const muestraNumero = el("strong", { class: "muestra-numero" });
  const muestraP = el("span", { class: "muestra-numero muestra-numero--p" });
  const campoDecimales = campo({
    etiqueta: "Decimales al mostrar resultados",
    tipo: "numero",
    valor: prefs.decimales,
    min: 0,
    max: 10,
    ayuda: "Afecta a tablas, tarjetas, gráficos y exportaciones. Los cálculos internos conservan toda la precisión.",
    onInput: (valor) => {
      if (typeof valor !== "number") return;
      guardarPrefs({ decimales: Math.max(0, Math.min(10, Math.round(valor))) });
      pintarMuestra();
    },
  });
  const selectorNotacion = campo({
    etiqueta: "Notación numérica",
    tipo: "select",
    valor: prefs.notacion,
    opciones: NOTACIONES,
    onCambio: (valor) => {
      guardarPrefs({ notacion: valor });
      pintarMuestra();
    },
  });

  function pintarMuestra() {
    muestraNumero.textContent = fmtNum(1234567.891234);
    muestraP.textContent = fmtP(0.03245);
  }

  const casillaAuto = campo({
    etiqueta: "Calcular automáticamente al cambiar un parámetro",
    tipo: "checkbox",
    valor: Boolean(prefs.calculo_automatico),
    ayuda: "Desactívalo si prefieres revisar todos los valores antes de lanzar cada cálculo.",
  });
  casillaAuto.control.addEventListener("change", () => {
    guardarPrefs({ calculo_automatico: casillaAuto.control.checked });
  });

  /* --------------------------- historial --------------------------- */

  const listaHistorial = el("div", { class: "pila pila--sm" });
  const botonBorrarHistorial = boton("Borrar historial", { variante: "peligro", pequeno: true, icono: "basura" });

  function pintarHistorial() {
    historialActual = historial();
    const subtituloHistorial = panelHistorial?.querySelector(".panel__subtitulo");
    if (subtituloHistorial) {
      subtituloHistorial.textContent = `${historialActual.length} ${historialActual.length === 1 ? "entrada guardada" : "entradas guardadas"} en este navegador`;
    }
    listaHistorial.replaceChildren();
    if (!historialActual.length) {
      listaHistorial.append(el("p", { class: "texto-tenue texto-pequeno" }, "Todavía no hay actividad. Los cálculos que ejecutes aparecerán aquí."));
      botonBorrarHistorial.disabled = true;
      return;
    }
    botonBorrarHistorial.disabled = false;
    for (const entrada of historialActual.slice(0, 8)) {
      listaHistorial.append(
        el(
          "button",
          { type: "button", class: "historial-fila", onClick: () => navegar(entrada.ruta) },
          el("span", { class: "historial-fila__icono" }, icono(entrada.icono || "historial", { tamano: 15 })),
          el(
            "span",
            { class: "historial-fila__cuerpo" },
            el("span", { class: "historial-fila__titulo" }, entrada.titulo),
            entrada.detalle ? el("span", { class: "historial-fila__detalle" }, entrada.detalle) : null
          ),
          el("span", { class: "historial-fila__fecha" }, fechaRelativa(entrada.fecha))
        )
      );
    }
    if (historialActual.length > 8) {
      listaHistorial.append(el("p", { class: "texto-tenue texto-pequeno" }, `y ${historialActual.length - 8} más…`));
    }
  }

  botonBorrarHistorial.addEventListener("click", async () => {
    const confirmado = await confirmar({
      titulo: "¿Borrar el historial?",
      texto: "Se eliminarán las entradas guardadas en este navegador. Las preferencias y los modelos recordados no se tocan.",
      confirmar: "Borrar historial",
      peligro: true,
    });
    if (!confirmado) return;
    limpiarHistorial();
    pintarHistorial();
    toast("Historial borrado", { tipo: "ok" });
  });

  /* --------------------------- datos --------------------------- */

  const entradaArchivo = el("input", {
    type: "file",
    accept: "application/json,.json",
    class: "oculto",
    "aria-label": "Importar preferencias desde un archivo JSON",
  });

  entradaArchivo.addEventListener("change", async () => {
    const archivo = entradaArchivo.files?.[0];
    if (!archivo) return;
    try {
      const texto = await archivo.text();
      const importadas = leerPrefsImportadas(texto);
      guardarPrefs(importadas);
      pintarTemas();
      campoDecimales.setValor(prefs.decimales);
      selectorNotacion.setValor(prefs.notacion);
      selectorDensidad.setValor(prefs.densidad);
      casillaAuto.control.checked = Boolean(prefs.calculo_automatico);
      casillaSidebar.control.checked = prefs.sidebar !== false;
      casillaMovimiento.control.checked = Boolean(prefs.reducir_movimiento);
      pintarMuestra();
      toast("Preferencias importadas", { tipo: "ok" });
      anunciar("Preferencias importadas correctamente.");
    } catch (error) {
      toast(textoError(error), { tipo: "error" });
    } finally {
      entradaArchivo.value = "";
    }
  });

  const botonExportar = boton("Exportar datos", {
    variante: "secundario",
    icono: "descargar",
    onClick: () => {
      const contenido = JSON.stringify(
        { app: "AmPu", version: salud?.version || "3.2.0", exportado: new Date().toISOString(), prefs: { ...prefs }, historial: historial() },
        null,
        2
      );
      descargarTexto("ampu-preferencias.json", contenido, "application/json;charset=utf-8");
      toast("Datos exportados", { tipo: "ok" });
    },
  });

  const botonImportar = boton("Importar preferencias", {
    variante: "secundario",
    icono: "carpeta",
    onClick: () => entradaArchivo.click(),
  });

  const botonRestablecer = boton("Restablecer preferencias", {
    variante: "peligro",
    icono: "actualizar",
    onClick: async () => {
      const confirmado = await confirmar({
        titulo: "¿Restablecer las preferencias?",
        texto: "Volverán el tema del sistema, la densidad cómoda, cuatro decimales y el cálculo automático. El historial no se modifica.",
        confirmar: "Restablecer",
        peligro: true,
      });
      if (!confirmado) return;
      guardarPrefs({ ...PREFERENCIAS_POR_DEFECTO, reducir_movimiento: false });
      pintarTemas();
      campoDecimales.setValor(prefs.decimales);
      selectorNotacion.setValor(prefs.notacion);
      selectorDensidad.setValor(prefs.densidad);
      casillaAuto.control.checked = Boolean(prefs.calculo_automatico);
      casillaSidebar.control.checked = prefs.sidebar !== false;
      casillaMovimiento.control.checked = Boolean(prefs.reducir_movimiento);
      pintarMuestra();
      toast("Preferencias restablecidas", { tipo: "ok" });
    },
  });

  /* --------------------------- salud --------------------------- */

  const estadoMotor = el("span", { class: "chip" }, salud ? "Comprobando…" : "Sin conexión");
  const detalleMotor = el("div", { class: "pila pila--sm" });

  function pintarSalud() {
    if (!salud) {
      estadoMotor.className = "chip chip--aviso";
      estadoMotor.replaceChildren(icono("alerta", { tamano: 12 }), "Motor no disponible");
      detalleMotor.replaceChildren(
        alerta({
          tipo: "aviso",
          texto: "La interfaz funciona, pero los cálculos requieren el servidor local de AmPu. Inicia app.py y recarga.",
        })
      );
      return;
    }
    estadoMotor.className = "chip chip--ok";
    estadoMotor.replaceChildren(icono("comprobar", { tamano: 12 }), "Motor en línea");
    detalleMotor.replaceChildren(
      el(
        "dl",
        { class: "lista-definicion" },
        el("div", {}, el("dt", {}, "Aplicación"), el("dd", {}, `${salud.version} (${salud.estado})`)),
        el("div", {}, el("dt", {}, "Motor"), el("dd", {}, salud.motor)),
        el("div", {}, el("dt", {}, "Distribuciones"), el("dd", {}, String(salud.distribuciones))),
        el("div", {}, el("dt", {}, "Lecciones"), el("dd", {}, String(salud.lecciones))),
        el("div", {}, el("dt", {}, "Modo"), el("dd", {}, salud.offline ? "Local y sin conexión" : "En red")),
        el("div", {}, el("dt", {}, "Hora del servidor"), el("dd", {}, new Date(salud.hora_utc).toLocaleString("es-ES")))
      )
    );
  }

  async function comprobarMotor(botonNodo) {
    await conCarga(botonNodo, async () => {
      try {
        salud = await api.get("/api/salud");
        toast("Motor disponible", { tipo: "ok" });
      } catch (error) {
        salud = null;
        toast(textoError(error), { tipo: "error" });
      }
      pintarSalud();
    });
  }

  const botonComprobar = boton("Comprobar de nuevo", { variante: "fantasma", pequeno: true, icono: "actualizar" });
  botonComprobar.addEventListener("click", () => comprobarMotor(botonComprobar));

  /* --------------------------- montaje --------------------------- */

  const panelApariencia = panel({
    titulo: "Apariencia",
    subtitulo: "Los cambios se aplican al instante y se guardan en este navegador.",
    icono: "monitor",
    contenido: el(
      "div",
      { class: "pila" },
      rejillaTemas,
      el("div", { class: "rejilla rejilla--2" }, selectorDensidad.envoltura, el("div", { class: "pila pila--sm" }, casillaMovimiento.envoltura, casillaSidebar.envoltura))
    ),
  });

  const panelNumeros = panel({
    titulo: "Formato de los números",
    subtitulo: "Elige cuánta precisión ves sin perder la precisión interna del motor.",
    icono: "calculadora",
    contenido: el(
      "div",
      { class: "pila" },
      el(
        "div",
        { class: "muestra-formato" },
        el("span", { class: "muestra-formato__etiqueta" }, "Vista previa"),
        el("div", { class: "fila", style: { gap: "16px", flexWrap: "wrap" } }, muestraNumero, el("span", { class: "texto-tenue" }, "p ="), muestraP)
      ),
      el("div", { class: "rejilla rejilla--2" }, campoDecimales.envoltura, selectorNotacion.envoltura)
    ),
  });

  const panelComportamiento = panel({
    titulo: "Comportamiento",
    subtitulo: "Ajusta el ritmo del laboratorio a tu forma de trabajar.",
    icono: "rayo",
    contenido: el(
      "div",
      { class: "pila" },
      casillaAuto.envoltura,
      el("p", { class: "texto-tenue texto-pequeno" }, "El cálculo automático solo se activa después de la primera ejecución manual en cada herramienta, para no lanzar cálculos mientras escribes.")
    ),
  });

  const panelHistorial = panel({
    titulo: "Actividad reciente",
    subtitulo: `${historialActual.length} ${historialActual.length === 1 ? "entrada guardada" : "entradas guardadas"} en este navegador`,
    icono: "historial",
    acciones: [botonBorrarHistorial],
    contenido: el("div", { class: "pila" }, listaHistorial),
  });

  const panelDatos = panel({
    titulo: "Datos y privacidad",
    subtitulo: "Tus cálculos y preferencias viven en este equipo. No se envía nada a internet.",
    icono: "candado",
    contenido: el(
      "div",
      { class: "pila" },
      el("p", { class: "texto-articulo" }, "AmPu guarda preferencias, historial de cálculos y el último estado de cada modelo en el almacenamiento local del navegador. El servidor conserva una copia de las preferencias para que el escritorio y el navegador compartan configuración. No hay cuentas, analítica ni telemetría."),
      el("div", { class: "fila", style: { flexWrap: "wrap" } }, botonExportar, botonImportar, botonRestablecer, entradaArchivo),
      el("p", { class: "texto-tenue texto-pequeno" }, `Clave local de preferencias: ${CLAVE_PREFS_EXPORT}. Puedes borrarla desde la configuración del navegador.`)
    ),
  });

  const panelSalud = panel({
    titulo: "Estado del motor",
    subtitulo: "Comprueba que el servidor local responde y qué versión está cargada.",
    icono: "escudo",
    acciones: [estadoMotor, botonComprobar],
    contenido: detalleMotor,
  });

  const panelAcerca = panel({
    titulo: "Acerca de AmPu 3.2",
    subtitulo: "Asistente matemático local para probabilidad, estadística y muestreo.",
    icono: "info",
    contenido: el(
      "div",
      { class: "pila" },
      el("p", { class: "texto-articulo" }, "AmPu combina un motor en Python (numpy, scipy, pandas) con una interfaz web sin dependencias externas. Las fórmulas se renderizan con KaTeX servido localmente, así que el laboratorio funciona sin conexión."),
      el(
        "div",
        { class: "rejilla rejilla--kpi" },
        kpiSimple("Distribuciones", metaDatos?.distribuciones?.length ?? salud?.distribuciones ?? "—"),
        kpiSimple("Lecciones", metaDatos?.teoria?.length ?? salud?.lecciones ?? "—"),
        kpiSimple("Pruebas", metaDatos?.pruebas?.length ?? "—"),
        kpiSimple("Diseños de muestreo", metaDatos?.muestreo?.length ?? "—")
      ),
      el(
        "div",
        { class: "fila", style: { flexWrap: "wrap" } },
        boton("Explorar la teoría", { variante: "secundario", pequeno: true, icono: "teoria", onClick: () => navegar("teoria") }),
        boton("Volver al inicio", { variante: "fantasma", pequeno: true, icono: "inicio", onClick: () => navegar("inicio") }),
        boton("Copiar información de diagnóstico", {
          variante: "fantasma",
          pequeno: true,
          icono: "copiar",
          onClick: () =>
            copiar(
              [
                `AmPu ${salud?.version || "3.2.0"}`,
                `Motor ${salud?.motor || "desconocido"}`,
                `Tema ${prefs.tema} (${temaResuelto()})`,
                `Densidad ${prefs.densidad}`,
                `Decimales ${prefs.decimales}, notación ${prefs.notacion}`,
                `Navegador ${navigator.userAgent}`,
              ].join("\n")
            ),
        })
      )
    ),
  });

  const panelAtajos = panel({
    titulo: "Atajos de teclado",
    icono: "teclado",
    contenido: el(
      "div",
      { class: "lista-atajos" },
      ATAJOS.map((atajo) =>
        el(
          "div",
          { class: "atajo-fila" },
          el("span", {}, atajo.texto),
          el("span", { class: "teclas" }, atajo.teclas.map((t) => el("kbd", {}, t)))
        )
      )
    ),
  });

  function kpiSimple(etiqueta, valor) {
    return el("div", { class: "kpi" }, el("span", { class: "kpi__etiqueta" }, etiqueta), el("span", { class: "kpi__valor" }, String(valor)));
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
          el("span", { class: "ceja" }, "Aprender · Preferencias"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("ajustes", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Ajustes y datos")
          ),
          el(
            "p",
            { class: "vista__subtitulo" },
            "Personaliza la lectura, el formato numérico y el comportamiento del laboratorio. Todo se guarda localmente y puedes exportarlo o restablecerlo."
          )
        ),
        el("div", { class: "vista__acciones" }, boton("Ayuda y atajos", { variante: "secundario", icono: "ayuda", onClick: () => window.dispatchEvent(new CustomEvent("ampu:ayuda")) }))
      ),
      el("div", { class: "rejilla rejilla--2" }, panelApariencia, panelNumeros),
      el("div", { class: "rejilla rejilla--2" }, panelComportamiento, panelSalud),
      panelHistorial,
      el("div", { class: "rejilla rejilla--2" }, panelDatos, panelAtajos),
      panelAcerca
    )
  );

  pintarTemas();
  pintarMuestra();
  pintarHistorial();
  pintarSalud();
}
