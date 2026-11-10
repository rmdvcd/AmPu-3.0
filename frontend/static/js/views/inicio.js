import { el, boton, panel, badge, latex, estadoVacio, fechaRelativa } from "../ui.js";
import { icono } from "../icons.js";
import { cargarMeta, historial, limpiarHistorial, meta, navegar } from "../store.js";

const HERRAMIENTAS = [
  { ruta: "distribuciones", titulo: "Explorar una distribución", texto: "26 modelos, curvas y cuantiles", icono: "distribuciones" },
  { ruta: "descriptiva", titulo: "Describir mis datos", texto: "Resumen, histograma y atípicos", icono: "descriptiva" },
  { ruta: "inferencia", titulo: "Contrastar una hipótesis", texto: "13 pruebas con interpretación", icono: "inferencia" },
  { ruta: "regresion", titulo: "Ajustar una regresión", texto: "Coeficientes, R² y residuos", icono: "regresion" },
  { ruta: "muestreo", titulo: "Diseñar una muestra", texto: "Tamaño, estratos y semilla", icono: "muestreo" },
  { ruta: "simulacion", titulo: "Simular con Monte Carlo", texto: "π, integrales y ajustes", icono: "simulacion" },
];

const RUTAS = [
  { ceja: "Si empiezas hoy", titulo: "Aprende el vocabulario", texto: "Lee la teoría de una distribución y pruébala en el laboratorio con los parámetros por defecto.", ruta: "teoria/normal", accion: "Leer la lección" },
  { ceja: "Si ya tienes datos", titulo: "Empieza por describirlos", texto: "Pega tu columna de números y observa centro, dispersión, forma y valores atípicos antes de inferir.", ruta: "descriptiva", accion: "Analizar datos" },
  { ceja: "Si vas a decidir", titulo: "Contrasta con contexto", texto: "Una prueba devuelve más que un p-valor: revisa supuestos, intervalo y tamaño del efecto.", ruta: "inferencia", accion: "Ver pruebas" },
  { ceja: "Si diseñas un estudio", titulo: "Calcula antes de recoger", texto: "Estima el tamaño muestral y documenta el diseño con una semilla reproducible.", ruta: "muestreo", accion: "Diseñar muestra" },
];

function tarjetaHerramienta({ ruta, titulo, texto, icono: nombreIcono }) {
  return el(
    "a",
    { class: "tarjeta-herramienta", href: `#/${ruta}` },
    el("span", { class: "tarjeta-herramienta__icono" }, icono(nombreIcono, { tamano: 17 })),
    el("span", { class: "tarjeta-herramienta__titulo" }, titulo),
    el("span", { class: "tarjeta-herramienta__texto" }, texto)
  );
}

function actividad(entradas) {
  if (!entradas.length) {
    return estadoVacio({
      icono: "historial",
      titulo: "Tu actividad aparecerá aquí",
      texto: "Cuando calcules una distribución, analices datos o ejecutes una prueba, podrás volver a ese resultado con un clic.",
      acciones: [boton("Empezar por distribuciones", { icono: "distribuciones", onClick: () => navegar("distribuciones") })],
    });
  }
  const lista = el("div", { class: "actividad" });
  for (const entrada of entradas.slice(0, 7)) {
    lista.append(
      el(
        "a",
        { class: "actividad__item", href: `#/${entrada.ruta}` },
        el("span", { class: "actividad__icono" }, icono(entrada.icono || "historial", { tamano: 14 })),
        el(
          "span",
          { class: "actividad__cuerpo" },
          el("span", { class: "actividad__titulo" }, entrada.titulo),
          el("span", { class: "actividad__meta" }, entrada.detalle || "Cálculo guardado")
        ),
        el("span", { class: "actividad__hora" }, fechaRelativa(entrada.fecha))
      )
    );
  }
  return lista;
}

function destacada(modelo) {
  const formula = el("div", { class: "distribucion-mini__formula" });
  return el(
    "a",
    { class: "distribucion-mini", href: `#/distribuciones/${modelo.clave}` },
    el(
      "div",
      { class: "distribucion-mini__cabecera" },
      el("strong", {}, modelo.nombre),
      badge(modelo.discreta ? "discreta" : "continua", modelo.discreta ? "discreta" : "continua")
    ),
    formula,
    el("span", { class: "distribucion-mini__flecha" }, "Abrir ", icono("flecha-derecha", { tamano: 13 }))
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

  const nDist = datos?.distribuciones?.length ?? 26;
  const nTeoria = datos?.teoria?.length ?? 57;
  const nPruebas = datos?.pruebas?.length ?? 13;

  const hero = el(
    "section",
    { class: "hero" },
    el("span", { class: "ceja" }, icono("candado", { tamano: 13 }), "Laboratorio local · sin conexión"),
    el("h1", {}, "Piensa con datos, ", el("em", {}, "no contra la interfaz.")),
    el(
      "p",
      { class: "hero__texto" },
      "AmPu reúne distribuciones, estadística descriptiva, inferencia, regresión, muestreo y simulación en un solo lugar. Cada resultado incluye su fórmula, su interpretación y los datos para verificarlo."
    ),
    el(
      "div",
      { class: "hero__acciones" },
      boton("Abrir el laboratorio", { icono: "distribuciones", onClick: () => navegar("distribuciones") }),
      boton("Analizar mis datos", { icono: "descriptiva", variante: "secundario", onClick: () => navegar("descriptiva") }),
      boton("Explorar la teoría", { icono: "teoria", variante: "fantasma", onClick: () => navegar("teoria") })
    ),
    el(
      "div",
      { class: "hero__datos" },
      el("div", { class: "hero__dato" }, el("strong", {}, String(nDist)), el("span", {}, "distribuciones")),
      el("div", { class: "hero__dato" }, el("strong", {}, String(nTeoria)), el("span", {}, "lecciones con fórmulas")),
      el("div", { class: "hero__dato" }, el("strong", {}, String(nPruebas)), el("span", {}, "pruebas de hipótesis")),
      el("div", { class: "hero__dato" }, el("strong", {}, "100 %"), el("span", {}, "cálculo en tu equipo"))
    )
  );

  const herramientas = panel({
    titulo: "¿Qué quieres hacer?",
    subtitulo: "Elige una tarea; el resto lo guía la interfaz.",
    icono: "objetivo",
    contenido: el("div", { class: "rejilla rejilla--herramientas" }, HERRAMIENTAS.map(tarjetaHerramienta)),
  });

  const recientes = panel({
    titulo: "Continuar donde lo dejaste",
    icono: "historial",
    acciones: [
      boton("Limpiar", {
        variante: "fantasma",
        pequeno: true,
        icono: "basura",
        onClick: async () => {
          const { confirmar } = await import("../ui.js");
          if (await confirmar({ titulo: "Limpiar actividad", texto: "Se borrará el historial local de cálculos recientes. Los datos de tus análisis no se eliminan del motor.", confirmar: "Limpiar" })) {
            limpiarHistorial();
            montar(host);
          }
        },
      }),
    ],
    contenido: actividad(historial()),
  });

  const destacadas = panel({
    titulo: "Modelos para empezar",
    subtitulo: "Los cinco modelos que aparecen en casi todos los cursos.",
    icono: "distribuciones",
    contenido: el(
      "div",
      { class: "rejilla", style: { gap: "8px" } },
      ["normal", "binomial", "poisson", "t_student", "exponencial"].map((clave) => {
        const modelo = datos?.distribuciones?.find((d) => d.clave === clave);
        return modelo ? destacada(modelo) : null;
      })
    ),
  });

  const rutas = panel({
    titulo: "Rutas sugeridas",
    subtitulo: "Según el momento en el que estés.",
    icono: "chispa",
    contenido: el(
      "div",
      { class: "rejilla rejilla--2", style: { gap: "10px" } },
      RUTAS.map((r) =>
        el(
          "a",
          { class: "ruta-card", href: `#/${r.ruta}` },
          el("span", { class: "ceja" }, r.ceja),
          el("strong", {}, r.titulo),
          el("p", {}, r.texto),
          el("span", { class: "ruta-card__accion" }, r.accion, icono("flecha-derecha", { tamano: 13 }))
        )
      )
    ),
  });

  const pasos = panel({
    titulo: "Un flujo de trabajo honesto",
    icono: "escudo",
    contenido: el(
      "div",
      { class: "pasos" },
      el("div", { class: "paso" }, el("strong", {}, "Configura y valida"), el("p", {}, "Los formularios conocen el dominio de cada parámetro y explican el rango antes de calcular.")),
      el("div", { class: "paso" }, el("strong", {}, "Interpreta con contexto"), el("p", {}, "Cada salida incluye supuestos, intervalo, tamaño del efecto y una lectura en lenguaje claro.")),
      el("div", { class: "paso" }, el("strong", {}, "Exporta y reproduce"), el("p", {}, "Descarga PNG, PDF, Excel o CSV. Las simulaciones y muestras guardan su semilla."))
    ),
  });

  host.append(
    el(
      "div",
      { class: "vista" },
      hero,
      herramientas,
      el("div", { class: "rejilla rejilla--2" }, recientes, destacadas),
      rutas,
      pasos
    )
  );

  // Las fórmulas de las tarjetas se renderizan después de insertar en el DOM.
  const nodosFormula = host.querySelectorAll(".distribucion-mini__formula");
  const claves = ["normal", "binomial", "poisson", "t_student", "exponencial"];
  nodosFormula.forEach((nodo, i) => {
    const modelo = datos?.distribuciones?.find((d) => d.clave === claves[i]);
    if (modelo?.formula) latex(nodo, modelo.formula, { display: true });
    else nodo.textContent = "";
  });

  // Iconos de los enlaces recién creados (el shell hidrata los suyos al arrancar).
  host.querySelectorAll(".distribucion-mini__flecha svg, .ruta-card__accion svg").forEach(() => {});
}
