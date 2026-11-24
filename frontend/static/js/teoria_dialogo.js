/**
 * Ventanas emergentes para lecciones completas de Teoría y fichas/fórmulas
 * con ejemplos resueltos de distribuciones. Se invocan desde cualquier vista
 * sin perder el cálculo ni abandonar la herramienta actual.
 */

import {
  el,
  fragmento,
  panel,
  boton,
  badge,
  alerta,
  textoError,
  esqueletoPanel,
  copiar,
  fmtNum,
  latex,
  textoMatematico,
  renderMath,
  anunciar,
  comportamientoScroll,
} from "./ui.js";
import { icono } from "./icons.js";
import { contenidoLectura } from "./lectura.js";
import { api, esCancelacion } from "./api.js";
import { cargarMeta, navegar, registrarHistorial } from "./store.js";
import { VISTAS, ETIQUETAS_CATEGORIA, herramientaDeLeccion } from "./data.js";
import { abrirVentana } from "./ventanas.js";

const CLAVE_LEIDAS = "ampu3.teoria.leidas";
const cacheLecciones = new Map();
let controladorTeoria = null;

export function obtenerLeidasTeoria() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_LEIDAS) || "[]");
    return new Set(Array.isArray(datos) ? datos : []);
  } catch {
    return new Set();
  }
}

function marcarLeidaTeoria(clave) {
  const conjunto = obtenerLeidasTeoria();
  conjunto.add(clave);
  try {
    localStorage.setItem(CLAVE_LEIDAS, JSON.stringify([...conjunto].slice(-400)));
  } catch {
    /* almacenamiento no disponible */
  }
  return conjunto;
}

/**
 * Abre una lección de teoría en una ventana emergente arrastrable y redimensionable.
 */
export async function abrirTeoriaVentana(clave, opciones = {}) {
  const {
    id = "ventana-teoria",
    alcance = "vista",
    alLeer = null,
    alAbrir = null,
    alIrHerramienta = null,
  } = opciones;

  if (!clave) return null;
  let metaDatos = null;
  try {
    metaDatos = await cargarMeta();
  } catch {
    metaDatos = null;
  }

  const leccionMeta = metaDatos?.teoria?.find((t) => t.clave === clave);
  const tituloInicial = leccionMeta?.titulo || clave.replaceAll("_", " ");

  const esqueleto = el("div", { class: "esqueleto-articulo" });
  esqueletoPanel(esqueleto, 2);

  const ventana = abrirVentana({
    id,
    titulo: `Teoría · ${tituloInicial}`,
    tituloCorto: tituloInicial,
    subtitulo: ETIQUETAS_CATEGORIA[leccionMeta?.categoria] || "Biblioteca de teoría",
    icono: "teoria",
    tipo: "teoria",
    alcance,
    contenido: esqueleto,
  });

  if (cacheLecciones.has(clave)) {
    pintar(cacheLecciones.get(clave));
    return ventana;
  }

  if (controladorTeoria) controladorTeoria.abort();
  controladorTeoria = new AbortController();

  try {
    const contenido = await api.get(`/api/teoria/${clave}`, { senal: controladorTeoria.signal });
    cacheLecciones.set(clave, contenido);
    pintar(contenido);
  } catch (error) {
    if (esCancelacion(error)) return ventana;
    ventana.actualizar({
      titulo: "No se pudo abrir la lección",
      tituloCorto: "Error en teoría",
      subtitulo: null,
      icono: "alerta",
      alcance,
      contenido: alerta({
        tipo: "error",
        texto: textoError(error),
        acciones: [
          boton("Reintentar", {
            variante: "secundario",
            pequeno: true,
            icono: "actualizar",
            onClick: () => abrirTeoriaVentana(clave, opciones),
          }),
        ],
      }),
      pie: null,
    });
  }

  function pintar(contenido) {
    marcarLeidaTeoria(contenido.clave);
    if (typeof alLeer === "function") alLeer(contenido.clave);

    const cuerpo = contenidoLectura(contenido.html, { bajoTitulo: true });

    for (const pre of cuerpo.querySelectorAll("pre")) {
      if (pre.parentElement?.classList.contains("bloque-codigo")) continue;
      const envoltura = el("div", { class: "bloque-codigo" });
      pre.replaceWith(envoltura);
      envoltura.append(pre);
      envoltura.append(
        boton("Copiar", {
          variante: "fantasma",
          pequeno: true,
          icono: "copiar",
          clase: "bloque-codigo__copiar",
          onClick: () => copiar(pre.textContent || ""),
        })
      );
    }

    const toc = Array.isArray(contenido.toc) ? contenido.toc.filter((t) => t.nivel >= 2 && t.nivel <= 3) : [];
    const tocNodo = toc.length > 2
      ? el(
          "details",
          { class: "indice-leccion" },
          el("summary", {}, icono("lista", { tamano: 17 }), "En esta lección", icono("flecha-abajo", { tamano: 15 })),
          el(
            "nav",
            { class: "toc-lista", "aria-label": "Secciones de esta lección" },
            toc.map((item) =>
              boton(item.texto, {
                variante: "fantasma",
                pequeno: true,
                clase: `toc-enlace toc-enlace--n${item.nivel}`,
                onClick: () => {
                  const destino = cuerpo.querySelector(`#${CSS.escape(item.id)}`);
                  if (!destino) return;
                  destino.tabIndex = -1;
                  destino.focus({ preventScroll: true });
                  destino.scrollIntoView({ behavior: comportamientoScroll(), block: "start" });
                },
              })
            )
          )
        )
      : null;

    const herramienta = herramientaDeLeccion(contenido.clave, metaDatos);
    const acciones = [
      contenido.formula
        ? boton("Copiar fórmula", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(contenido.formula) })
        : null,
      boton("Copiar enlace", {
        variante: "fantasma",
        pequeno: true,
        icono: "enlace",
        onClick: () => copiar(`${location.origin}${location.pathname}#/teoria/${contenido.clave}`),
      }),
      boton("Imprimir", { variante: "fantasma", pequeno: true, icono: "imprimir", onClick: () => window.print() }),
      herramienta
        ? boton(herramienta.etiqueta, {
            variante: "secundario",
            pequeno: true,
            icono: VISTAS[herramienta.ruta.split("/")[0]]?.icono || "externo",
            onClick: () => {
              if (typeof alIrHerramienta === "function") alIrHerramienta(herramienta.ruta, ventana);
              else {
                ventana.cerrar();
                navegar(herramienta.ruta);
              }
            },
          })
        : null,
    ].filter(Boolean);

    const anteriores = contenido.navegacion;
    const pie = el(
      "div",
      { class: "leccion-pie" },
      anteriores?.anterior
        ? boton(anteriores.anterior.titulo, {
            variante: "secundario",
            pequeno: true,
            icono: "flecha-izquierda",
            ariaLabel: `Lección anterior: ${anteriores.anterior.titulo}`,
            onClick: () => abrirTeoriaVentana(anteriores.anterior.clave, opciones),
          })
        : el("span"),
      anteriores?.siguiente
        ? boton(anteriores.siguiente.titulo, {
            variante: "secundario",
            pequeno: true,
            icono: "flecha-derecha",
            ariaLabel: `Lección siguiente: ${anteriores.siguiente.titulo}`,
            onClick: () => abrirTeoriaVentana(anteriores.siguiente.clave, opciones),
          })
        : el("span")
    );

    const relacionados = contenido.relacionados?.length
      ? panel({
          titulo: "Continúa leyendo",
          icono: "teoria",
          contenido: el(
            "div",
            { class: "rejilla rejilla--3" },
            contenido.relacionados.map((r) =>
              el(
                "button",
                { class: "ruta-card", type: "button", onClick: () => abrirTeoriaVentana(r.clave, opciones) },
                el("span", { class: "ruta-card__icono" }, icono("teoria", { tamano: 16 })),
                el("span", { class: "ruta-card__titulo" }, r.titulo)
              )
            )
          ),
        })
      : null;

    const categoria = ETIQUETAS_CATEGORIA[leccionMeta?.categoria || contenido.categoria] || "Lección";
    const articulo = el(
      "article",
      { class: "lectura-dialogo" },
      el(
        "header",
        { class: "articulo-cabecera" },
        el(
          "div",
          { class: "fila", style: { gap: "8px", flexWrap: "wrap" } },
          badge(categoria, "marca"),
          el("span", { class: "chip" }, `${fmtNum(contenido.minutos, { entero: true })} min de lectura`),
          el("span", { class: "chip chip--ok" }, icono("comprobar", { tamano: 12 }), "leída")
        ),
        el("h2", { tabindex: "-1" }, contenido.titulo),
        el("div", { class: "fila", style: { gap: "6px", flexWrap: "wrap" } }, acciones)
      ),
      tocNodo,
      cuerpo,
      relacionados
    );

    ventana.actualizar({
      id,
      titulo: contenido.titulo,
      tituloCorto: contenido.titulo,
      subtitulo: `${categoria} · ${fmtNum(contenido.minutos, { entero: true })} min`,
      icono: "teoria",
      tipo: "teoria",
      alcance,
      contenido: articulo,
      pie,
    });
    renderMath(ventana.nodo);
    if (typeof alAbrir === "function") alAbrir(contenido);
    registrarHistorial({
      titulo: `Teoría · ${contenido.titulo}`,
      detalle: `${contenido.minutos} min`,
      ruta: `teoria/${contenido.clave}`,
      tipo: "teoria",
      icono: "teoria",
    });
    anunciar(`Lección ${contenido.titulo} abierta.`);
  }

  return ventana;
}

/**
 * Abre la ficha matemática (fórmula, resumen, ejemplo resuelto y propiedades)
 * de una distribución en una ventana emergente arrastrable y redimensionable.
 */
export function abrirFichaModeloVentana(modelo, {
  alcance = "vista",
  alAbrirTeoria = null,
  alSimular = null,
} = {}) {
  if (!modelo) return null;

  const formula = el("div", { class: "formula-card" });
  const etiquetaFormula = modelo.discreta ? "Función de masa (PMF)" : "Función de densidad (PDF)";
  if (modelo.formula) {
    formula.append(el("span", { class: "formula-etiqueta" }, etiquetaFormula));
    const mate = el("div");
    formula.append(mate);
    latex(mate, modelo.formula, { display: true });
  } else {
    formula.append(el("p", { class: "texto-tenue" }, "Este modelo no incluye una fórmula en bloque."));
  }

  const ejemploBloque = modelo.ejemplo
    ? el(
        "section",
        { class: "ficha-seccion" },
        el("h3", { class: "ficha-seccion__titulo" }, icono("ejemplo", { tamano: 16 }), "Ejemplo resuelto"),
        modelo.ejemplo_html ? contenidoLectura(modelo.ejemplo_html, { compacto: true }) : textoMatematico(modelo.ejemplo)
      )
    : null;

  const propiedadesBloque = modelo.propiedades
    ? el(
        "section",
        { class: "ficha-seccion" },
        el("h3", { class: "ficha-seccion__titulo" }, icono("info", { tamano: 16 }), "Propiedades y casos especiales"),
        modelo.propiedades_html ? contenidoLectura(modelo.propiedades_html, { compacto: true }) : textoMatematico(modelo.propiedades)
      )
    : null;

  const cuerpo = el(
    "div",
    { class: "modelo-ficha" },
    el(
      "div",
      { class: "modelo-ficha__titulo" },
      badge(modelo.discreta ? "Discreta" : "Continua", modelo.discreta ? "discreta" : "continua"),
      modelo.dimensionalidad !== "univariante"
        ? badge(modelo.dimensionalidad === "bivariante" ? "Bivariante" : "Multivariante", "multivariante")
        : null,
      badge(`${modelo.parametros.length} parámetro${modelo.parametros.length === 1 ? "" : "s"}`),
      modelo.soporte_sugerido
        ? el("span", { class: "chip" }, `Soporte: [${modelo.soporte_sugerido[0]}, ${modelo.soporte_sugerido[1]}]`)
        : null
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
    ejemploBloque,
    propiedadesBloque
  );

  const pie = el(
    "div",
    { class: "fila fila--entre", style: { width: "100%", flexWrap: "wrap", gap: "8px" } },
    el(
      "div",
      { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
      modelo.teoria
        ? boton("Ver lección completa", {
            variante: "secundario",
            pequeno: true,
            icono: "teoria",
            onClick: () => {
              if (typeof alAbrirTeoria === "function") alAbrirTeoria(modelo.teoria);
              else abrirTeoriaVentana(modelo.teoria, { alcance });
            },
          })
        : null,
      alSimular
        ? boton("Simular muestra", {
            variante: "fantasma",
            pequeno: true,
            icono: "simulacion",
            onClick: alSimular,
          })
        : null
    ),
    boton("Copiar enlace", {
      variante: "fantasma",
      pequeno: true,
      icono: "enlace",
      onClick: () => copiar(`${location.origin}${location.pathname}#/distribuciones/${modelo.clave}`),
    })
  );

  return abrirVentana({
    id: "ventana-ficha-modelo",
    titulo: `Ficha · ${modelo.nombre}`,
    tituloCorto: `Ficha · ${modelo.nombre}`,
    subtitulo: "Fórmula, ejemplo resuelto y propiedades",
    icono: "ejemplo",
    tipo: "ficha",
    alcance,
    contenido: cuerpo,
    pie,
  });
}
