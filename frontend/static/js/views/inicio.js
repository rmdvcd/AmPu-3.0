import { el, boton, panel, badge, estadoVacio, fechaRelativa, confirmar, toast } from "../ui.js";
import { icono } from "../icons.js";
import { cargarMeta, historial, limpiarHistorial, meta } from "../store.js";

const HERRAMIENTAS = [
  { ruta: "distribuciones", titulo: "Explorar una distribución", texto: "Modelos, curvas y cuantiles", icono: "distribuciones" },
  { ruta: "descriptiva", titulo: "Describir mis datos", texto: "Resumen, histograma y atípicos", icono: "descriptiva" },
  { ruta: "probabilidad", titulo: "Calcular probabilidades", texto: "Combinatoria, condicional y Bayes", icono: "probabilidad" },
  { ruta: "inferencia", titulo: "Contrastar una hipótesis", texto: "Pruebas e interpretación", icono: "inferencia" },
  { ruta: "regresion", titulo: "Ajustar una regresión", texto: "Coeficientes, R² y residuos", icono: "regresion" },
  { ruta: "muestreo", titulo: "Diseñar una muestra", texto: "Tamaño, estratos y semilla", icono: "muestreo" },
  { ruta: "simulacion", titulo: "Simular y ajustar modelos", texto: "Monte Carlo, muestras y QQ-plots", icono: "simulacion" },
  { ruta: "teoria", titulo: "Consultar la teoría", texto: "Definiciones, fórmulas y ejemplos", icono: "teoria" },
];

const DESTACADAS = ["normal", "binomial", "poisson", "t_student", "exponencial"];

function tarjetaHerramienta({ ruta, titulo, texto, icono: nombreIcono }) {
  return el("a", { class: "tarjeta-herramienta", href: `#/${ruta}` },
    el("span", { class: "tarjeta-herramienta__icono" }, icono(nombreIcono, { tamano: 17 })),
    el("span", { class: "tarjeta-herramienta__titulo" }, titulo),
    el("span", { class: "tarjeta-herramienta__texto" }, texto)
  );
}

function actividad(entradas) {
  if (!entradas.length) {
    return estadoVacio({
      icono: "historial", titulo: "Sin actividad reciente", texto: "Tus cálculos recientes aparecerán aquí.",
    });
  }
  return el("div", { class: "actividad" }, entradas.slice(0, 7).map((entrada) =>
    el("a", { class: "actividad__item", href: `#/${entrada.ruta}` },
      el("span", { class: "actividad__icono" }, icono(entrada.icono || "historial", { tamano: 14 })),
      el("span", { class: "actividad__cuerpo" },
        el("span", { class: "actividad__titulo" }, entrada.titulo),
        el("span", { class: "actividad__meta" }, entrada.detalle || "Cálculo reciente")
      ),
      el("span", { class: "actividad__hora" }, fechaRelativa(entrada.fecha))
    )
  ));
}

function destacada(modelo) {
  return el("a", { class: "distribucion-mini", href: `#/distribuciones/${modelo.clave}` },
    el("strong", {}, modelo.nombre),
    el("span", { class: "distribucion-mini__meta" },
      badge(modelo.discreta ? "discreta" : "continua", modelo.discreta ? "discreta" : "continua"),
      icono("flecha-derecha", { tamano: 14 })
    )
  );
}

export async function montar(host) {
  let datos = meta.datos;
  if (!datos) {
    try {
      datos = await cargarMeta();
    } catch {
      datos = null;
    }
  }
  const modelos = DESTACADAS.map((clave) => datos?.distribuciones?.find((d) => d.clave === clave)).filter(Boolean);
  const entradas = historial();
  const hero = el("section", { class: "hero" },
    el("span", { class: "ceja" }, icono("candado", { tamano: 13 }), "AmPu · Laboratorio local"),
    el("h1", {}, "Probabilidad y estadística, ", el("em", {}, "en tu equipo.")),
    el("p", { class: "hero__texto" }, "Elige una herramienta para calcular, interpretar y contrastar resultados."),
    el("div", { class: "hero__datos" },
      el("div", { class: "hero__dato" }, el("strong", {}, String(datos?.distribuciones?.length ?? 26)), el("span", {}, "distribuciones")),
      el("div", { class: "hero__dato" }, el("strong", {}, String(datos?.teoria?.length ?? 57)), el("span", {}, "lecciones")),
      el("div", { class: "hero__dato" }, el("strong", {}, String(datos?.pruebas?.length ?? 13)), el("span", {}, "pruebas de hipótesis"))
    )
  );
  const herramientas = panel({
    titulo: "¿Qué quieres hacer?", icono: "objetivo",
    contenido: el("div", { class: "rejilla rejilla--4" }, HERRAMIENTAS.map(tarjetaHerramienta)),
  });
  const botonLimpiar = boton("Limpiar actividad", {
    variante: "fantasma", pequeno: true, icono: "basura", deshabilitado: !entradas.length,
    onClick: async () => {
      if (!await confirmar({
        titulo: "¿Limpiar la actividad?", texto: "Se borrarán los accesos recientes de este navegador. Las preferencias no cambiarán.", confirmar: "Limpiar",
      })) return;
      limpiarHistorial();
      recientes.cuerpo.replaceChildren(actividad([]));
      botonLimpiar.disabled = true;
      toast("Actividad borrada", { tipo: "ok" });
    },
  });
  const recientes = panel({
    titulo: "Actividad reciente", icono: "historial", acciones: [botonLimpiar], contenido: actividad(entradas),
  });
  const destacadas = panel({
    titulo: "Modelos para empezar", icono: "distribuciones",
    contenido: modelos.length
      ? el("div", { class: "rejilla", style: { gap: "8px" } }, modelos.map(destacada))
      : estadoVacio({ icono: "distribuciones", titulo: "Catálogo no disponible", texto: "Vuelve a abrir Inicio cuando el motor esté disponible." }),
  });
  host.append(el("div", { class: "vista" }, hero, herramientas,
    el("div", { class: "rejilla rejilla--2", style: { alignItems: "start" } }, recientes, destacadas)
  ));

}
