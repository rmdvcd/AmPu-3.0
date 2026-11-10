import {
  el,
  panel,
  boton,
  badge,
  alerta,
  estadoVacio,
  esqueletoPanel,
  copiar,
  fmtNum,
  latex,
  renderMath,
  anunciar,
} from "../ui.js";
import { icono } from "../icons.js";
import { api, esCancelacion } from "../api.js";
import { cargarMeta, navegar, registrarHistorial } from "../store.js";
import { ETIQUETAS_CATEGORIA, herramientaDeLeccion } from "../data.js";

const CLAVE_LEIDAS = "ampu3.teoria.leidas";
const ORDEN_CATEGORIAS = ["distribuciones", "analisis", "inferencia", "muestreo", "otros"];

function normalizar(texto) {
  return String(texto || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function leidas() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_LEIDAS) || "[]");
    return new Set(Array.isArray(datos) ? datos : []);
  } catch {
    return new Set();
  }
}

function guardarLeidas(conjunto) {
  try {
    localStorage.setItem(CLAVE_LEIDAS, JSON.stringify([...conjunto].slice(-400)));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Limpia el HTML de una lección local antes de insertarlo. */
function htmlSeguro(texto) {
  const documento = new DOMParser().parseFromString(String(texto || ""), "text/html");
  documento.querySelectorAll("script, style, iframe, object, embed, form, input, textarea, select, button").forEach((n) => n.remove());
  for (const nodo of documento.body.querySelectorAll("*")) {
    for (const atributo of [...nodo.attributes]) {
      const nombre = atributo.name.toLowerCase();
      if (nombre.startsWith("on")) nodo.removeAttribute(atributo.name);
      if ((nombre === "href" || nombre === "src") && /^\s*javascript:/i.test(atributo.value)) {
        nodo.removeAttribute(atributo.name);
      }
    }
    if (nodo.tagName === "A") {
      const href = nodo.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        nodo.setAttribute("target", "_blank");
        nodo.setAttribute("rel", "noopener noreferrer");
      }
    }
    if (nodo.tagName === "IMG") {
      nodo.setAttribute("loading", "lazy");
      nodo.setAttribute("decoding", "async");
      nodo.classList.add("imagen-leccion");
    }
  }
  return documento.body;
}

export async function montar(host, parametro) {
  let metaDatos;
  try {
    metaDatos = await cargarMeta();
  } catch (error) {
    host.append(alerta({ tipo: "error", titulo: "El motor no responde", texto: error.message }));
    return null;
  }

  let lecciones = [];
  try {
    lecciones = await api.get("/api/teoria/lista");
  } catch (error) {
    host.append(alerta({ tipo: "error", titulo: "No se pudo cargar la biblioteca", texto: error.message }));
    return null;
  }

  const porClave = new Map(lecciones.map((l) => [l.clave, l]));
  const predeterminada = porClave.has("descriptiva") ? "descriptiva" : lecciones[0]?.clave;
  let activa = porClave.has(parametro) ? parametro : predeterminada;
  let controlador = null;
  const cache = new Map();
  const leidasActuales = leidas();

  const entradaBusqueda = el("input", { type: "search", placeholder: "Buscar una lección…", "aria-label": "Buscar en la teoría" });
  const lista = el("div", { class: "lista-modelos", role: "list" });
  const contadorLectura = el("span", { class: "chip" }, "");
  const catalogo = panel({
    titulo: "Biblioteca",
    subtitulo: `${lecciones.length} lecciones`,
    icono: "teoria",
    acciones: [contadorLectura],
    contenido: el("div", {}, el("div", { class: "lista-busqueda" }, icono("buscar", { tamano: 15 }), entradaBusqueda), lista),
    sinRelleno: true,
    clase: "panel--plano",
  });

  const articulo = el("article", { class: "panel panel--articulo", "aria-live": "polite" });
  const miga = el("div", { class: "migas-teoria" });

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
          el("span", { class: "ceja" }, "Aprender · Teoría"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("teoria", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Teoría que se puede aplicar")
          ),
          el(
            "p",
            { class: "vista__subtitulo" },
            "Cada lección conecta la definición con una herramienta del laboratorio. Texto, fórmulas e imágenes se sirven sin conexión."
          )
        ),
        el("div", { class: "vista__acciones" }, boton("Ir a distribuciones", { variante: "secundario", icono: "distribuciones", onClick: () => navegar("distribuciones") }))
      ),
      miga,
      el("div", { class: "dividido dividido--teoria" }, catalogo, articulo)
    )
  );

  function actualizarContador() {
    const total = leidas().size;
    contadorLectura.textContent = `${total}/${lecciones.length} leídas`;
    contadorLectura.dataset.tono = total === lecciones.length ? "ok" : "";
  }

  function renderLista() {
    const consulta = normalizar(entradaBusqueda.value);
    lista.replaceChildren();
    const leidasAhora = leidas();
    let visibles = 0;
    for (const categoria of ORDEN_CATEGORIAS) {
      const items = lecciones.filter(
        (l) => l.categoria === categoria && (!consulta || normalizar(`${l.titulo} ${l.resumen}`).includes(consulta))
      );
      if (!items.length) continue;
      lista.append(el("p", { class: "modelo-grupo__titulo" }, ETIQUETAS_CATEGORIA[categoria] || categoria));
      for (const leccion of items) {
        visibles++;
        lista.append(
          el(
            "button",
            {
              class: "modelo-item",
              type: "button",
              role: "listitem",
              "aria-pressed": String(leccion.clave === activa),
              onClick: () => seleccionar(leccion.clave),
            },
            el("span", { class: "modelo-item__nombre" }, leccion.titulo),
            el(
              "span",
              { class: "modelo-item__meta" },
              leidasAhora.has(leccion.clave) ? icono("comprobar", { tamano: 13 }) : null,
              el("span", {}, `${leccion.minutos} min`)
            )
          )
        );
      }
    }
    if (!visibles) {
      lista.append(el("p", { class: "tabla-vacia" }, "No hay lecciones que coincidan con la búsqueda."));
    }
    actualizarContador();
  }

  entradaBusqueda.addEventListener("input", renderLista);
  entradaBusqueda.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
      const primera = lista.querySelector(".modelo-item");
      if (primera) primera.click();
    }
  });

  function mostrarCarga() {
    const esqueleto = el("div", { class: "esqueleto-articulo" });
    esqueletoPanel(esqueleto, 2);
    articulo.replaceChildren(esqueleto);
  }

  async function seleccionar(clave) {
    if (!porClave.has(clave)) return;
    activa = clave;
    history.replaceState(null, "", `#/teoria/${clave}`);
    renderLista();
    actualizarMiga();
    if (cache.has(clave)) {
      pintarLeccion(cache.get(clave));
      return;
    }
    mostrarCarga();
    if (controlador) controlador.abort();
    controlador = new AbortController();
    try {
      const contenido = await api.get(`/api/teoria/${clave}`, { senal: controlador.signal });
      cache.set(clave, contenido);
      if (activa === clave) pintarLeccion(contenido);
    } catch (error) {
      if (!esCancelacion(error)) {
        articulo.replaceChildren(
          panel({
            titulo: "No se pudo abrir la lección",
            icono: "alerta",
            contenido: alerta({
              tipo: "error",
              texto: error.message,
              acciones: [boton("Reintentar", { variante: "secundario", pequeno: true, icono: "actualizar", onClick: () => seleccionar(clave) })],
            }),
          })
        );
      }
    }
  }

  function actualizarMiga() {
    const leccion = porClave.get(activa);
    miga.replaceChildren(
      el("span", {}, "Teoría"),
      icono("punto", { tamano: 8 }),
      el("span", { class: "texto-tenue" }, ETIQUETAS_CATEGORIA[leccion?.categoria] || "Lección"),
      icono("punto", { tamano: 8 }),
      el("strong", {}, leccion?.titulo || "")
    );
  }

  function pintarLeccion(contenido) {
    const leccion = porClave.get(contenido.clave) || {};
    const nuevaLectura = leidas();
    nuevaLectura.add(contenido.clave);
    guardarLeidas(nuevaLectura);
    renderLista();
    actualizarMiga();

    const cuerpo = el("div", { class: "texto-articulo" });
    cuerpo.append(htmlSeguro(contenido.html));
    cuerpo.querySelector("h1")?.remove();

    // Botones de copia para bloques de código.
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
    const tocNodo =
      toc.length > 2
        ? panel({
            titulo: "En esta lección",
            icono: "menu",
            clase: "panel--toc",
            contenido: el(
              "div",
              { class: "toc-lista" },
              toc.map((item) =>
                el(
                  "button",
                  {
                    type: "button",
                    class: `toc-enlace toc-enlace--n${item.nivel}`,
                    onClick: () => {
                      const destino = cuerpo.querySelector(`#${CSS.escape(item.id)}`);
                      destino?.scrollIntoView({ behavior: "smooth", block: "start" });
                    },
                  },
                  item.texto
                )
              )
            ),
          })
        : null;

    const formulaNodo = el("div", { class: "formula-card" }, el("span", { class: "formula-etiqueta" }, "Fórmula central"));
    const destinoFormula = el("div");
    formulaNodo.append(destinoFormula);
    if (contenido.formula) latex(destinoFormula, contenido.formula, { display: true });

    const herramienta = herramientaDeLeccion(contenido.clave, metaDatos);
    const acciones = [
      contenido.formula ? boton("Copiar fórmula", { variante: "fantasma", pequeno: true, icono: "copiar", onClick: () => copiar(contenido.formula) }) : null,
      boton("Copiar enlace", { variante: "fantasma", pequeno: true, icono: "enlace", onClick: () => copiar(`${location.origin}${location.pathname}#/teoria/${contenido.clave}`) }),
      boton("Imprimir", { variante: "fantasma", pequeno: true, icono: "imprimir", onClick: () => window.print() }),
      herramienta ? boton(herramienta.etiqueta, { variante: "secundario", pequeno: true, icono: "reproducir", onClick: () => navegar(herramienta.ruta) }) : null,
    ].filter(Boolean);

    const anteriores = contenido.navegacion;
    const pie = el(
      "footer",
      { class: "leccion-pie" },
      anteriores?.anterior
        ? boton(`← ${anteriores.anterior.titulo}`, { variante: "secundario", onClick: () => seleccionar(anteriores.anterior.clave) })
        : el("span"),
      anteriores?.siguiente
        ? boton(`${anteriores.siguiente.titulo} →`, { variante: "secundario", onClick: () => seleccionar(anteriores.siguiente.clave) })
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
                { class: "ruta-card", type: "button", onClick: () => seleccionar(r.clave) },
                el("span", { class: "ruta-card__icono" }, icono("teoria", { tamano: 16 })),
                el("span", { class: "ruta-card__titulo" }, r.titulo)
              )
            )
          ),
        })
      : null;

    articulo.replaceChildren(
      el(
        "header",
        { class: "articulo-cabecera" },
        el(
          "div",
          { class: "fila", style: { gap: "8px", flexWrap: "wrap" } },
          badge(ETIQUETAS_CATEGORIA[leccion.categoria] || "Lección", "marca"),
          el("span", { class: "chip" }, `${fmtNum(contenido.minutos, { entero: true })} min de lectura`),
          el("span", { class: "chip chip--ok" }, icono("comprobar", { tamano: 12 }), "leída")
        ),
        el("h2", { tabindex: "-1" }, contenido.titulo),
        contenido.resumen ? el("p", { class: "texto-tenue" }, contenido.resumen) : null,
        el("div", { class: "fila", style: { gap: "6px", flexWrap: "wrap" } }, acciones)
      ),
      tocNodo,
      contenido.formula ? formulaNodo : null,
      cuerpo,
      relacionados,
      pie
    );
    renderMath(articulo);
    articulo.scrollIntoView({ behavior: "smooth", block: "start" });
    registrarHistorial({ titulo: `Teoría · ${contenido.titulo}`, detalle: `${contenido.minutos} min`, ruta: `teoria/${contenido.clave}`, tipo: "teoria", icono: "teoria" });
    anunciar(`Lección ${contenido.titulo} abierta.`);
  }

  renderLista();
  if (activa) await seleccionar(activa);
  else articulo.append(estadoVacio({ icono: "teoria", titulo: "Biblioteca vacía", texto: "No se encontraron lecciones en el servidor." }));

  return () => {
    if (controlador) controlador.abort();
  };
}
