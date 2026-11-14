/**
 * Mapa de navegación y textos de orientación. La arquitectura de información
 * agrupa las herramientas por la pregunta que responde el usuario:
 * explorar, inferir, diseñar y aprender.
 */

export const VISTAS = {
  inicio: {
    titulo: "Inicio",
    descripcion: "Tu punto de partida",
    icono: "inicio",
    palabras: "inicio panel resumen empezar",
  },
  distribuciones: {
    titulo: "Distribuciones",
    descripcion: "Explora 26 modelos de probabilidad",
    icono: "distribuciones",
    ceja: "Explorar",
    subtitulo: "Explora modelos, probabilidades y cuantiles con sus parámetros.",
    palabras: "distribuciones probabilidad normal binomial poisson modelo pmf pdf cdf cuantil",
  },
  descriptiva: {
    titulo: "Describir datos",
    descripcion: "Resume una muestra en segundos",
    icono: "descriptiva",
    ceja: "Explorar",
    subtitulo: "Resume tus datos y examina su distribución, dispersión y valores atípicos.",
    palabras: "descriptiva media mediana desviacion cuartiles histograma datos csv atipicos",
  },
  probabilidad: {
    titulo: "Probabilidad",
    descripcion: "Combinatoria, condicional y Bayes",
    icono: "probabilidad",
    ceja: "Explorar",
    subtitulo: "Combinatoria, probabilidad condicional, Bayes y variables discretas.",
    palabras: "probabilidad combinatoria factorial permutaciones combinaciones bayes condicional",
  },
  inferencia: {
    titulo: "Inferencia",
    descripcion: "Contrasta hipótesis con contexto",
    icono: "inferencia",
    ceja: "Inferir",
    subtitulo: "Elige una prueba y revisa sus supuestos antes de interpretar el resultado.",
    palabras: "inferencia prueba hipotesis p-valor t student z chi cuadrado anova correlacion wilcoxon kruskal",
  },
  regresion: {
    titulo: "Regresión",
    descripcion: "Ajusta y diagnostica modelos lineales",
    icono: "regresion",
    ceja: "Inferir",
    subtitulo: "Ajusta modelos lineales y revisa coeficientes, residuos y predicciones.",
    palabras: "regresion lineal multiple ols r2 residuos prediccion coeficientes",
  },
  muestreo: {
    titulo: "Diseño muestral",
    descripcion: "Calcula tamaños y extrae muestras",
    icono: "muestreo",
    ceja: "Diseñar",
    subtitulo: "Calcula el tamaño y selecciona una muestra reproducible.",
    palabras: "muestreo muestra estratos neyman optimo conglomerados tamano poblacion",
  },
  simulacion: {
    titulo: "Simulación",
    descripcion: "Monte Carlo y bondad de ajuste",
    icono: "simulacion",
    ceja: "Diseñar",
    subtitulo: "Experimenta con Monte Carlo, muestras aleatorias, ajustes y QQ-plots.",
    palabras: "simulacion monte carlo pi integral ajuste qq muestra semilla",
  },
  teoria: {
    titulo: "Teoría",
    descripcion: "57 lecciones con fórmulas",
    icono: "teoria",
    ceja: "Aprender",
    subtitulo: "Consulta definiciones, fórmulas y ejemplos conectados con las herramientas.",
    palabras: "teoria lecciones formulas apuntes aprender katex",
  },
  ajustes: {
    titulo: "Ajustes",
    descripcion: "Apariencia, formato y datos",
    icono: "ajustes",
    ceja: "Sistema",
    subtitulo: "Configura la apariencia, el cálculo y los datos guardados.",
    palabras: "ajustes preferencias tema formato decimales datos privacidad historial",
  },
};

export const NAV = [
  { grupo: "Empezar", items: ["inicio"] },
  { grupo: "Explorar", items: ["distribuciones", "descriptiva", "probabilidad"] },
  { grupo: "Inferir", items: ["inferencia", "regresion"] },
  { grupo: "Diseñar", items: ["muestreo", "simulacion"] },
  { grupo: "Aprender", items: ["teoria"] },
  { grupo: "Sistema", items: ["ajustes"] },
];

export const ORDEN_VISTAS = NAV.flatMap((g) => g.items);

export const ETIQUETAS_CATEGORIA = {
  distribuciones: "Distribuciones",
  muestreo: "Muestreo",
  inferencia: "Inferencia",
  analisis: "Análisis de datos",
  otros: "Referencia",
};

export const GRUPOS_ATAJOS = [
  { id: "general", titulo: "Navegación y apariencia", icono: "teclado" },
  { id: "calculo", titulo: "Cálculos y diálogos", icono: "calculadora" },
  { id: "graficos", titulo: "Exploración de gráficos", icono: "grafico", nota: "Primero usa el atajo «Ir al primer gráfico visible» o enfócalo con Tab. El zoom está disponible en los gráficos que lo admiten." },
];

// Atajos de Windows. Cada alternativa es una combinación independiente.
// Las acciones globales se resuelven con estas mismas definiciones en atajos.js.
export const ATAJOS = [
  { id: "buscar", grupo: "general", texto: "Buscar herramientas y lecciones", detalle: "Abre el buscador de AmPu.", combinaciones: [["Ctrl", "K"]], accion: "buscar" },
  { id: "tema", grupo: "general", texto: "Cambiar el tema", detalle: "Recorre claro, oscuro y sistema.", combinaciones: [["Ctrl", "Shift", "L"]], accion: "tema", enDialogo: true },
  { id: "ayuda", grupo: "general", texto: "Abrir ayuda y atajos", detalle: "Usa «?» solo fuera de los campos de entrada.", combinaciones: [["F1"], ["?"]], accion: "ayuda", enDialogo: true },
  { id: "calcular", grupo: "calculo", texto: "Calcular en el formulario activo", detalle: "Ejecuta el botón principal disponible; no actúa detrás de un diálogo.", combinaciones: [["Ctrl", "Enter"]], accion: "calcular" },
  { id: "escape", grupo: "calculo", texto: "Cerrar o cancelar", detalle: "Cierra el diálogo o el menú. Fuera de ellos, cancela el cálculo en curso.", combinaciones: [["Esc"]], accion: "escape" },
  { id: "grafico", grupo: "graficos", texto: "Ir al primer gráfico visible", detalle: "Fuera de los campos de entrada.", combinaciones: [["Alt", "G"]], accion: "grafico", fueraDeCampo: true },
  { id: "recorrer", grupo: "graficos", texto: "Recorrer los valores", detalle: "Muestra el punto anterior o siguiente.", combinaciones: [["←"], ["→"]] },
  { id: "extremos", grupo: "graficos", texto: "Ir al primer o último valor", combinaciones: [["Home"], ["End"]] },
  { id: "zoom", grupo: "graficos", texto: "Acercar o alejar", detalle: "Con el foco en un gráfico con zoom.", combinaciones: [["+"], ["−"]] },
  { id: "restablecer", grupo: "graficos", texto: "Restablecer la vista del gráfico", detalle: "También puedes usar Esc si el gráfico está ampliado.", combinaciones: [["0"]] },
  { id: "desplazar", grupo: "graficos", texto: "Desplazar la vista", detalle: "En un gráfico ampliado.", combinaciones: [["Shift", "←"], ["Shift", "→"]] },
];

export const LECCIONES_MUESTREO = {
  finito: "muestreo_finito",
  infinito: "muestreo_infinito",
  sistematico: "muestreo_sistematico",
  proporcional: "muestreo_estratificado",
  neyman: "muestreo_neyman",
  optimo: "muestreo_optimo",
  conglomerados: "muestreo_conglomerados",
};

/** Herramienta que practica cada lección de teoría. */
export function herramientaDeLeccion(clave, metaDatos) {
  const dist = metaDatos?.distribuciones?.some((d) => d.clave === clave);
  if (dist) return { ruta: `distribuciones/${clave}`, etiqueta: `Abrir ${clave.replaceAll("_", " ")}` };
  if (clave.startsWith("muestreo") || clave.startsWith("tamano")) {
    const metodo = Object.keys(LECCIONES_MUESTREO).find((m) => LECCIONES_MUESTREO[m] === clave);
    return { ruta: `muestreo/${metodo || "finito"}`, etiqueta: "Abrir diseño muestral" };
  }
  const pruebas = {
    prueba_t_una: "t_una",
    prueba_z_una: "z_una",
    prueba_t_dos: "t_dos",
    prueba_z_dos: "z_dos",
    prueba_proporcion_una: "prop_una",
    prueba_proporcion_dos: "prop_dos",
    chi_bondad: "chi_bondad",
    chi_independencia: "chi_indep",
    anova: "anova",
    correlacion: "correlacion",
    mann_whitney: "mann_whitney",
    wilcoxon: "wilcoxon",
    kruskal: "kruskal",
    intervalos_confianza: "t_una",
  };
  if (pruebas[clave]) return { ruta: `inferencia/${pruebas[clave]}`, etiqueta: "Abrir prueba estadística" };
  const otras = {
    descriptiva: "descriptiva",
    combinatoria: "probabilidad/combinatoria",
    bayes: "probabilidad/bayes",
    regresion: "regresion",
    montecarlo: "simulacion/pi",
    ajuste_distribuciones: "simulacion/ajuste",
    qq_plot: "simulacion/qq",
  };
  if (otras[clave]) return { ruta: otras[clave], etiqueta: "Abrir herramienta" };
  return null;
}

export const MENSAJES_CARGA = [
  "Preparando el laboratorio…",
  "Cargando modelos de probabilidad…",
  "Ajustando la interfaz…",
];

export const LIMITES = {
  maxSerie: 50000,
  maxPuntos: 401,
  minPuntos: 41,
};
