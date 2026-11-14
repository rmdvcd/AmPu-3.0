import { VISTAS } from "../data.js";
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
  guardarPrefs,
  historial,
  limpiarHistorial,
  navegar,
  prefs,
  temaResuelto,
} from "../store.js";

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
  let salud = null;
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
    const enfocada = [...temaBotones].find(([, nodo]) => nodo === document.activeElement)?.[0];
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
    if (enfocada) temaBotones.get(enfocada)?.focus({ preventScroll: true });
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
    ayuda: "Evita transiciones y desplazamientos suaves.",
  });
  casillaMovimiento.control.addEventListener("change", () => {
    guardarPrefs({ reducir_movimiento: casillaMovimiento.control.checked });
  });

  const casillaSidebar = campo({
    etiqueta: "Mantener el menú visible en escritorio",
    tipo: "checkbox",
    valor: prefs.sidebar !== false,
    ayuda: "En pantallas pequeñas se abre sobre el contenido.",
  });
  casillaSidebar.control.addEventListener("change", () => {
    guardarPrefs({ sidebar: casillaSidebar.control.checked });
  });

  /* --------------------------- números --------------------------- */

  const muestraNumero = el("strong", { class: "muestra-numero" });
  const muestraP = el("span", { class: "muestra-numero muestra-numero--p" });
  const campoDecimales = campo({
    etiqueta: "Decimales al mostrar resultados",
    tipo: "entero",
    valor: prefs.decimales,
    min: 0,
    max: 10,
    ayuda: "De 0 a 10 decimales; no modifica los cálculos internos.",
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
    etiqueta: "Recalcular distribuciones automáticamente",
    tipo: "checkbox",
    valor: Boolean(prefs.calculo_automatico),
    ayuda: "Desactívalo para calcular solo al pulsar «Calcular».",
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
    icono: "importar",
    onClick: () => entradaArchivo.click(),
  });

  const botonRestablecer = boton("Restablecer preferencias", {
    variante: "peligro",
    icono: "restablecer",
    onClick: async () => {
      const confirmado = await confirmar({
        titulo: "¿Restablecer las preferencias?",
        texto: "Volverán el tema del sistema, la densidad cómoda, cuatro decimales y el cálculo automático. El historial no se modifica.",
        confirmar: "Restablecer",
        peligro: true,
      });
      if (!confirmado) return;
      guardarPrefs({ ...PREFERENCIAS_POR_DEFECTO, reducir_movimiento: false });
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
    icono: "monitor",
    contenido: el(
      "div",
      { class: "pila" },
      rejillaTemas,
      el("div", { class: "rejilla rejilla--2" }, selectorDensidad.envoltura, el("div", { class: "pila pila--sm" }, casillaMovimiento.envoltura, casillaSidebar.envoltura))
    ),
  });

  const panelNumeros = panel({
    titulo: "Formato y cálculo",
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
      el("div", { class: "rejilla rejilla--2" }, campoDecimales.envoltura, selectorNotacion.envoltura),
      casillaAuto.envoltura
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
    icono: "candado",
    contenido: el(
      "div",
      { class: "pila" },
      el("p", { class: "texto-articulo" }, "El navegador guarda preferencias, actividad y estados de distribuciones. El servidor local conserva una copia de las preferencias. Sin cuentas ni telemetría."),
      el("div", { class: "fila", style: { flexWrap: "wrap" } }, botonExportar, botonImportar, botonRestablecer, entradaArchivo)
    ),
  });

  const panelSalud = panel({
    titulo: "Estado del motor",
    subtitulo: "Versión y diagnóstico del motor local.",
    icono: "escudo",
    acciones: [estadoMotor, botonComprobar],
    contenido: el("div", { class: "pila" }, detalleMotor,
      boton("Copiar información de diagnóstico", {
        variante: "fantasma", pequeno: true, icono: "copiar",
        onClick: () => copiar([
          `AmPu ${salud?.version || "3.2.0"}`,
          `Motor ${salud?.motor || "desconocido"}`,
          `Tema ${prefs.tema} (${temaResuelto()})`,
          `Densidad ${prefs.densidad}`,
          `Decimales ${prefs.decimales}, notación ${prefs.notacion}`,
          `Navegador ${navigator.userAgent}`,
        ].join("\n")),
      })
    ),
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
          el("span", { class: "ceja" }, "Sistema · Preferencias"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("ajustes", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Ajustes y datos")
          ),
          el(
            "p",
            { class: "vista__subtitulo" },
            VISTAS.ajustes.subtitulo
          )
        )
      ),
      el("div", { class: "rejilla rejilla--2" }, panelApariencia, panelNumeros),
      el("div", { class: "rejilla rejilla--2", style: { alignItems: "start" } }, panelSalud, panelHistorial),
      panelDatos
    )
  );

  function sincronizarControles() {
    pintarTemas();
    campoDecimales.setValor(prefs.decimales);
    selectorNotacion.setValor(prefs.notacion);
    selectorDensidad.setValor(prefs.densidad);
    casillaAuto.setValor(prefs.calculo_automatico);
    casillaSidebar.setValor(prefs.sidebar);
    casillaMovimiento.setValor(prefs.reducir_movimiento);
    pintarMuestra();
  }
  sincronizarControles();
  pintarHistorial();
  pintarSalud();
  window.addEventListener("ampu:prefs", sincronizarControles);
  return () => window.removeEventListener("ampu:prefs", sincronizarControles);
}
