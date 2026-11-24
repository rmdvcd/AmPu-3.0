import {
  el,
  panel,
  alerta,
  textoError,
  estadoVacio,
  segmentado,
} from "../ui.js";
import { icono } from "../icons.js";
import { api } from "../api.js";
import { cargarMeta, navegar } from "../store.js";
import { VISTAS, ETIQUETAS_CATEGORIA } from "../data.js";
import { abrirTeoriaVentana, obtenerLeidasTeoria } from "../teoria_dialogo.js";

const ORDEN_CATEGORIAS = ["distribuciones", "analisis", "inferencia", "muestreo", "otros"];

function normalizar(texto) {
  return String(texto || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function montar(host, parametro) {
  try {
    await cargarMeta();
  } catch (error) {
    host.append(alerta({ tipo: "error", titulo: "El motor no responde", texto: textoError(error) }));
    return null;
  }

  let lecciones = [];
  try {
    lecciones = await api.get("/api/teoria/lista");
  } catch (error) {
    host.append(alerta({ tipo: "error", titulo: "No se pudo cargar la biblioteca", texto: textoError(error) }));
    return null;
  }

  const porClave = new Map(lecciones.map((l) => [l.clave, l]));
  let activa = porClave.has(parametro) ? parametro : null;
  let categoriaFiltro = "todas";

  const entradaBusqueda = el("input", {
    type: "search",
    placeholder: "Buscar una lección por título o tema…",
    "aria-label": "Buscar en la teoría",
  });
  const filtroCategorias = segmentado({
    etiqueta: "Filtrar por categoría",
    valor: "todas",
    opciones: [
      ["todas", "Todas"],
      ["distribuciones", "Distribuciones"],
      ["analisis", "Análisis"],
      ["inferencia", "Inferencia"],
      ["muestreo", "Muestreo"],
      ["otros", "Referencia"],
    ],
    onCambio: (valor) => {
      categoriaFiltro = valor;
      renderLista();
    },
  });

  const lista = el("div", { class: "lista-modelos", role: "group", "aria-label": "Lecciones de teoría" });
  const contadorLectura = el("span", { class: "chip" }, "");

  const catalogo = panel({
    titulo: "Biblioteca de lecciones",
    subtitulo: `${lecciones.length} lecciones · haz clic en una tarjeta para abrirla en una ventana emergente`,
    icono: "teoria",
    acciones: [contadorLectura],
    contenido: el(
      "div",
      {},
      el(
        "div",
        { class: "pila pila--sm", style: { padding: "12px 14px 4px" } },
        el("div", { class: "lista-busqueda", style: { border: "1px solid var(--linea)", borderRadius: "9px" } }, icono("buscar", { tamano: 15 }), entradaBusqueda),
        filtroCategorias
      ),
      lista
    ),
    sinRelleno: true,
    clase: "panel--plano teoria-catalogo",
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
          el("span", { class: "ceja" }, "Aprender · Teoría"),
          el(
            "div",
            { class: "vista__titulo" },
            icono("teoria", { tamano: 26 }),
            el("h1", { tabindex: "-1" }, "Teoría que se puede aplicar")
          ),
          el("p", { class: "vista__subtitulo" }, VISTAS.teoria.subtitulo)
        )
      ),
      lecciones.length
        ? catalogo
        : estadoVacio({ icono: "teoria", titulo: "Biblioteca vacía", texto: "No se encontraron lecciones en el servidor." })
    )
  );

  function actualizarContador() {
    const total = obtenerLeidasTeoria().size;
    contadorLectura.textContent = `${total}/${lecciones.length} leídas`;
    contadorLectura.dataset.tono = total === lecciones.length ? "ok" : "";
  }

  function abrirLeccion(clave) {
    if (!porClave.has(clave)) return;
    activa = clave;
    history.replaceState(null, "", `#/teoria/${clave}`);
    renderLista();
    abrirTeoriaVentana(clave, {
      alcance: "vista",
      alLeer: () => renderLista(),
      alAbrir: (contenido) => {
        activa = contenido.clave;
        history.replaceState(null, "", `#/teoria/${contenido.clave}`);
        renderLista();
      },
      alIrHerramienta: (ruta, ventana) => {
        ventana.cerrar();
        navegar(ruta);
      },
    });
  }

  function renderLista() {
    const consulta = normalizar(entradaBusqueda.value);
    lista.replaceChildren();
    const leidasAhora = obtenerLeidasTeoria();
    let visibles = 0;

    for (const categoria of ORDEN_CATEGORIAS) {
      if (categoriaFiltro !== "todas" && categoria !== categoriaFiltro) continue;
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
              "aria-pressed": String(leccion.clave === activa),
              onClick: () => abrirLeccion(leccion.clave),
            },
            el(
              "span",
              { class: "modelo-item__fila" },
              el("span", { class: "modelo-item__nombre" }, leccion.titulo),
              el(
                "span",
                { class: "modelo-item__meta" },
                leidasAhora.has(leccion.clave) ? icono("comprobar", { tamano: 13 }) : null,
                el("span", {}, `${leccion.minutos} min`)
              )
            ),
            leccion.resumen ? el("span", { class: "modelo-item__resumen" }, leccion.resumen) : null
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

  renderLista();
  if (activa) abrirLeccion(activa);

  return null;
}
