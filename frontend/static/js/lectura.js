/** Prosa local: conserva listas, tablas y matemáticas sin insertar HTML activo. */
import { el, renderMath } from "./ui.js";

const ETIQUETAS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "STRONG", "EM", "BR", "HR",
  "BLOCKQUOTE", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "PRE", "CODE", "DIV", "SPAN", "A", "IMG",
  "DL", "DT", "DD", "SUP", "SUB", "FIGURE", "FIGCAPTION",
]);
const ATRIBUTOS = new Set(["id", "class", "href", "src", "alt", "colspan", "rowspan", "scope", "start"]);

function htmlSeguro(html) {
  const documento = new DOMParser().parseFromString(String(html || ""), "text/html");
  documento.querySelectorAll("script, style, iframe, object, embed, form, input, textarea, select, button, svg, math, template").forEach((n) => n.remove());
  for (const nodo of documento.body.querySelectorAll("*")) {
    if (!ETIQUETAS.has(nodo.tagName)) {
      nodo.replaceWith(...nodo.childNodes);
      continue;
    }
    for (const atributo of [...nodo.attributes]) {
      if (!ATRIBUTOS.has(atributo.name.toLowerCase())) nodo.removeAttribute(atributo.name);
    }
    if (nodo.tagName === "A") {
      const href = nodo.getAttribute("href") || "";
      // Referencias bibliográficas y anclas locales; nunca javascript:, data: ni file:.
      if (!/^(https?:\/\/|#[a-z0-9_-])/i.test(href)) nodo.removeAttribute("href");
      else if (/^https?:/i.test(href)) {
        nodo.setAttribute("target", "_blank");
        nodo.setAttribute("rel", "noopener noreferrer");
      }
    }
    if (nodo.tagName === "IMG") {
      if (!/^\/media\/teoria\/[a-z0-9_-]+\.png$/i.test(nodo.getAttribute("src") || "")) {
        nodo.remove();
        continue;
      }
      nodo.setAttribute("loading", "lazy");
      nodo.setAttribute("decoding", "async");
      nodo.classList.add("imagen-leccion");
    }
  }
  const fragmento = document.createDocumentFragment();
  fragmento.append(...documento.body.childNodes);
  return fragmento;
}

/**
 * El mismo formato para la biblioteca y los ejemplos desplegables de un modelo.
 * En la biblioteca, h2 → h3 mantiene la jerarquía bajo el título de la lección.
 */
export function contenidoLectura(html, { compacto = false, bajoTitulo = false } = {}) {
  const cuerpo = el("div", { class: `lectura ${compacto ? "lectura--compacta" : ""}`.trim() }, htmlSeguro(html));
  cuerpo.querySelector("h1")?.remove();
  if (bajoTitulo) {
    for (const titulo of cuerpo.querySelectorAll("h2, h3, h4, h5")) {
      const nuevo = document.createElement(`h${Number(titulo.tagName[1]) + 1}`);
      for (const atributo of titulo.attributes) nuevo.setAttribute(atributo.name, atributo.value);
      nuevo.append(...titulo.childNodes);
      titulo.replaceWith(nuevo);
    }
  }

  for (const tabla of cuerpo.querySelectorAll("table")) {
    if (!tabla.parentElement.classList.contains("tabla-scroll")) {
      const envoltura = el("div", { class: "tabla-scroll" });
      tabla.replaceWith(envoltura);
      envoltura.append(tabla);
    }
    tabla.parentElement.tabIndex = 0;
    tabla.parentElement.setAttribute("role", "region");
    tabla.parentElement.setAttribute("aria-label", "Tabla de la lección");
    for (const th of tabla.querySelectorAll("thead th")) th.setAttribute("scope", "col");
  }
  for (const formula of cuerpo.querySelectorAll(".formula-bloque")) {
    formula.tabIndex = 0;
    formula.setAttribute("role", "group");
    formula.setAttribute("aria-label", "Fórmula; desplazamiento horizontal si no cabe");
  }

  for (const parrafo of cuerpo.querySelectorAll("p")) {
    const imagen = parrafo.querySelector(":scope > img:only-child");
    if (!imagen || parrafo.childNodes.length > 1) continue;
    const siguiente = parrafo.nextElementSibling;
    const leyenda = siguiente?.querySelector(":scope > em:only-child");
    const figura = el("figure", {}, imagen);
    parrafo.replaceWith(figura);
    if (leyenda && /^Figura\s+\d+/i.test(leyenda.textContent)) {
      figura.append(el("figcaption", {}, ...leyenda.childNodes));
      siguiente.remove();
    }
  }

  for (const titulo of [...cuerpo.children].filter((n) => /^H[2-4]$/.test(n.tagName))) {
    if (!/^Ejemplo resuelto/i.test(titulo.textContent)) continue;
    const ejemplo = el("section", { class: "ejemplo-resuelto" });
    titulo.before(ejemplo);
    let siguiente = titulo.nextSibling;
    ejemplo.append(titulo);
    while (siguiente && !(siguiente.nodeType === Node.ELEMENT_NODE && /^H[1-4]$/.test(siguiente.tagName) && siguiente.tagName <= titulo.tagName)) {
      const actual = siguiente;
      siguiente = actual.nextSibling;
      ejemplo.append(actual);
    }
    ejemplo.querySelector("ol")?.classList.add("pasos-resueltos");
  }
  if (compacto) cuerpo.querySelectorAll("ol").forEach((lista) => lista.classList.add("pasos-resueltos"));
  renderMath(cuerpo);
  return cuerpo;
}
