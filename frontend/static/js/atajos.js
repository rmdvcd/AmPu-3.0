/** Atajos de Windows: búsqueda y resolución sin depender del DOM. */
import { ATAJOS, GRUPOS_ATAJOS } from "./data.js";

const NOMBRES_TECLAS = {
  Ctrl: "Control", Shift: "Mayúsculas", Enter: "Intro", Esc: "Escape", Home: "Inicio", End: "Fin",
  "←": "Flecha izquierda", "→": "Flecha derecha", "+": "Más", "−": "Menos",
};

export function etiquetaAtajo(atajo) {
  return atajo.combinaciones
    .map((combinacion) => combinacion.map((tecla) => NOMBRES_TECLAS[tecla] || tecla).join(" más "))
    .join(" o ");
}

const normalizar = (texto) => String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
let indice = null;

export function buscarAtajos(consulta) {
  const normalizada = normalizar(consulta).trim();
  const terminos = normalizada === "+" ? ["+"] : normalizada.replace(/\+/g, " ").split(/\s+/).filter(Boolean);
  if (!terminos.length) return ATAJOS;
  indice ||= ATAJOS.map((atajo) => normalizar([
    atajo.texto, atajo.detalle || "", GRUPOS_ATAJOS.find((g) => g.id === atajo.grupo)?.titulo,
    atajo.combinaciones.flat().join(" "), etiquetaAtajo(atajo),
  ].join(" ")));
  return ATAJOS.filter((_, i) => terminos.every((termino) => indice[i].includes(termino)));
}

function coincideCombinacion(evento, combinacion) {
  const tecla = combinacion.at(-1);
  if (Boolean(evento.ctrlKey) !== combinacion.includes("Ctrl")) return false;
  if (Boolean(evento.altKey) !== combinacion.includes("Alt")) return false;
  // «?» ya representa el carácter producido por el teclado, use o no Shift.
  if (tecla !== "?" && Boolean(evento.shiftKey) !== combinacion.includes("Shift")) return false;
  return evento.key.toLowerCase() === (tecla === "Esc" ? "Escape" : tecla).toLowerCase();
}

export function accionAtajo(evento, { escribiendo = false, dialogoAbierto = false } = {}) {
  if (evento.defaultPrevented || evento.isComposing || evento.repeat || evento.metaKey || evento.getModifierState?.("AltGraph")) return null;
  for (const atajo of ATAJOS) {
    if (!atajo.accion || (dialogoAbierto && !atajo.enDialogo) || (escribiendo && atajo.fueraDeCampo)) continue;
    if (atajo.id === "ayuda" && evento.key === "?" && escribiendo) continue;
    if (atajo.combinaciones.some((combinacion) => coincideCombinacion(evento, combinacion))) return atajo.accion;
  }
  return null;
}
