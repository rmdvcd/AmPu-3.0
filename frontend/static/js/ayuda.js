/** Centro de ayuda local. Se carga únicamente al abrirlo. */
import { el, boton, modal, pestanas } from "./ui.js";
import { icono } from "./icons.js";
import { navegar } from "./store.js";
import { ATAJOS, GRUPOS_ATAJOS } from "./data.js";
import { buscarAtajos, etiquetaAtajo } from "./atajos.js";

function teclasAtajo(atajo) {
  const alternativas = atajo.combinaciones;
  return el("span", { class: "teclas", role: "group", "aria-label": etiquetaAtajo(atajo) },
    alternativas.map((combinacion, i) => [
      i ? el("span", { class: "teclas__alternativa", "aria-hidden": "true" }, "o") : null,
      el("span", { class: "teclas__combinacion", "aria-hidden": "true" },
        combinacion.map((tecla, j) => [
          j ? el("span", { class: "teclas__mas" }, "+") : null,
          el("kbd", {}, tecla),
        ])
      ),
    ])
  );
}

function crearListaAtajos(atajos = ATAJOS) {
  return el("div", { class: "ayuda-atajos" }, GRUPOS_ATAJOS.map((grupo) => {
    const items = atajos.filter((atajo) => atajo.grupo === grupo.id);
    if (!items.length) return null;
    return el("section", { class: "ayuda-atajos__grupo" },
      el("h3", { class: "ayuda-atajos__titulo" }, icono(grupo.icono, { tamano: 16 }), grupo.titulo),
      grupo.nota ? el("p", { class: "ayuda-atajos__nota" }, grupo.nota) : null,
      el("ul", { class: "lista-atajos" }, items.map((atajo) =>
        el("li", { class: "atajo-fila", dataset: { atajo: atajo.id } },
          el("div", { class: "atajo-fila__cuerpo" },
            el("span", { class: "atajo-fila__titulo" }, atajo.texto),
            atajo.detalle ? el("span", { class: "atajo-fila__detalle" }, atajo.detalle) : null
          ),
          teclasAtajo(atajo)
        )
      ))
    );
  }));
}

function crearGuia(irA) {
  const pasos = [
    ["Elige tu herramienta", "Abre una sección en el menú o busca un modelo, una prueba o una lección."],
    ["Prepara y calcula", "Introduce los datos, revisa cómo se han leído y ejecuta el cálculo."],
    ["Entiende el resultado", "Revisa los supuestos, consulta la teoría y exporta lo que necesites."],
  ];
  const recurso = (nombreIcono, titulo, texto, ruta) => el("button", {
    class: "ayuda-recurso", type: "button", onClick: () => irA(ruta),
  },
    el("span", { class: "ayuda-recurso__icono" }, icono(nombreIcono, { tamano: 20 })),
    el("span", { class: "ayuda-recurso__texto" }, el("strong", {}, titulo), el("span", {}, texto)),
    icono("flecha-derecha", { tamano: 16 })
  );
  return el("div", { class: "ayuda__guia" },
    el("div", { class: "ayuda__introduccion" },
      el("span", { class: "ayuda__ceja" }, "Empieza en tres pasos"),
      el("h3", {}, "Del dato a la respuesta"),
      el("p", {}, "Elige una herramienta y empieza a calcular.")
    ),
    el("ol", { class: "ayuda-pasos" }, pasos.map(([titulo, texto], i) =>
      el("li", { class: "ayuda-paso" },
        el("span", { class: "ayuda-paso__numero", "aria-hidden": "true" }, String(i + 1).padStart(2, "0")),
        el("div", {}, el("h4", {}, titulo), el("p", {}, texto))
      )
    )),
    el("section", { class: "ayuda-datos" },
      el("h3", {}, icono("tabla", { tamano: 17 }), "¿Cómo escribo mis datos?"),
      el("dl", { class: "ayuda-datos__ejemplos" },
        el("div", {}, el("dt", {}, "Decimales"), el("dd", {}, el("code", {}, "12,5"), " o ", el("code", {}, "12.5"))),
        el("div", {}, el("dt", {}, "Varios valores"), el("dd", {}, el("code", {}, "12,5; 13,2; 14"))),
        el("div", {}, el("dt", {}, "Tablas y grupos"), el("dd", {}, "Una fila o un grupo por línea; valores separados por espacios."))
      ),
      el("p", {}, "Separa los valores con espacios, saltos de línea o punto y coma. Evita «1,2,3»: es ambiguo. La vista previa te muestra lo que se ha leído.")
    ),
    el("div", { class: "ayuda__recursos" },
      recurso("teoria", "Explorar la teoría", "Conecta cada resultado con su explicación.", "teoria"),
      recurso("ajustes", "Abrir ajustes", "Tema, formato numérico y datos guardados.", "ajustes")
    ),
    el("aside", { class: "ayuda__privacidad" },
      icono("escudo", { tamano: 17 }),
      el("p", {}, el("strong", {}, "Tu trabajo se queda en tu equipo. "), "El motor de Python es local y no necesita conexión a Internet.")
    )
  );
}

function crearPanelAtajos() {
  const resultados = el("div", { class: "ayuda__resultados", id: "ayuda-resultados", tabindex: "0", role: "region", "aria-label": "Lista de atajos" });
  const cuenta = el("p", { class: "ayuda__cuenta", id: "ayuda-cuenta", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const entrada = el("input", {
    type: "search", id: "ayuda-busqueda", placeholder: "Buscar por acción o tecla…",
    autocomplete: "off", spellcheck: false, "aria-controls": resultados.id, "aria-describedby": cuenta.id,
  });
  const limpiar = () => {
    entrada.value = "";
    pintar();
    entrada.focus();
  };
  const borrar = el("button", {
    class: "icono-boton ayuda__borrar", type: "button", "aria-label": "Borrar búsqueda", onClick: limpiar,
  }, icono("cerrar", { tamano: 16 }));

  function pintar() {
    const encontrados = buscarAtajos(entrada.value);
    borrar.hidden = !entrada.value;
    cuenta.textContent = entrada.value.trim() ? `${encontrados.length} de ${ATAJOS.length} atajos` : `${ATAJOS.length} atajos disponibles`;
    resultados.replaceChildren(encontrados.length ? crearListaAtajos(encontrados) :
      el("div", { class: "ayuda__vacio" },
        icono("buscar", { tamano: 28 }),
        el("h3", {}, "No encontramos ese atajo"),
        el("p", {}, "Prueba con «calcular», «tema», «gráfico» o una tecla."),
        boton("Borrar búsqueda", { variante: "secundario", onClick: limpiar })
      )
    );
    resultados.scrollTop = 0;
  }
  entrada.addEventListener("input", pintar);
  pintar();
  return el("div", { class: "ayuda__atajos" },
    el("div", { class: "ayuda__buscador" },
      el("label", { class: "sr-only", for: entrada.id }, "Buscar atajos de teclado"),
      el("div", { class: "ayuda__campo" }, icono("buscar", { tamano: 18 }), entrada, borrar),
      el("div", { class: "ayuda__buscador-pie" }, cuenta,
        el("span", { class: "ayuda__plataforma" }, "Windows · Ctrl / Alt")
      )
    ),
    resultados
  );
}

export function abrirAyuda() {
  // La carga diferida puede terminar después de otra apertura: comprobar aquí también.
  if (document.querySelector("dialog[open]")) return;
  let ventana;
  const irA = (ruta) => {
    ventana.cerrar();
    navegar(ruta);
  };
  const guia = crearGuia(irA);
  let atajos;
  const panel = el("div", { class: "ayuda__panel" }, guia);
  const tabs = pestanas({
    opciones: [
      ["guia", el("span", {}, icono("ayuda", { tamano: 16 }), "Guía rápida")],
      ["atajos", el("span", {}, icono("teclado", { tamano: 16 }), "Atajos de teclado")],
    ],
    valor: "guia", etiqueta: "Contenido de ayuda", panel,
    onCambio: (valor) => {
      // Construir solo lo que se va a mostrar; conservar la búsqueda entre pestañas.
      panel.replaceChildren(valor === "guia" ? guia : (atajos ||= crearPanelAtajos()));
      panel.classList.toggle("ayuda__panel--atajos", valor === "atajos");
      panel.scrollTop = 0;
    },
  });
  tabs.classList.add("ayuda__pestanas");
  tabs.querySelector('[aria-selected="true"]').autofocus = true;
  ventana = modal({
    titulo: "Ayuda y atajos",
    subtitulo: "Guía rápida y teclado de Windows.",
    clase: "modal--ayuda",
    contenido: el("div", { class: "ayuda" }, tabs, panel),
    acciones: [{ texto: "Entendido", variante: "primario" }],
  });
  ventana.dialogo.querySelector(".modal__pie").prepend(
    el("span", { class: "ayuda__cerrar-pista" }, el("kbd", {}, "Esc"), " para cerrar")
  );
  return ventana;
}
