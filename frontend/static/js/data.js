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
    subtitulo: "Elige un modelo, ajusta sus parámetros y entiende la masa, la densidad, la acumulada y los cuantiles en un mismo lienzo.",
    palabras: "distribuciones probabilidad normal binomial poisson modelo pmf pdf cdf cuantil",
  },
  descriptiva: {
    titulo: "Describir datos",
    descripcion: "Resume una muestra en segundos",
    icono: "descriptiva",
    ceja: "Explorar",
    subtitulo: "Pega tus datos o carga un CSV: obtén medidas de tendencia central, dispersión, forma, atípicos e histogramas listos para interpretar.",
    palabras: "descriptiva media mediana desviacion cuartiles histograma datos csv atipicos",
  },
  probabilidad: {
    titulo: "Probabilidad",
    descripcion: "Combinatoria, condicional y Bayes",
    icono: "probabilidad",
    ceja: "Explorar",
    subtitulo: "Calcula probabilidades con pasos claros: combinatoria exacta, probabilidad condicional, teorema de Bayes y momentos de variables discretas.",
    palabras: "probabilidad combinatoria factorial permutaciones combinaciones bayes condicional",
  },
  inferencia: {
    titulo: "Inferencia",
    descripcion: "Contrasta hipótesis con contexto",
    icono: "inferencia",
    ceja: "Inferir",
    subtitulo: "Trece pruebas paramétricas y no paramétricas con estadístico, p-valor, intervalo, tamaño del efecto y una interpretación sin atajos.",
    palabras: "inferencia prueba hipotesis p-valor t student z chi cuadrado anova correlacion wilcoxon kruskal",
  },
  regresion: {
    titulo: "Regresión",
    descripcion: "Ajusta y diagnostica modelos lineales",
    icono: "regresion",
    ceja: "Inferir",
    subtitulo: "Ajusta una recta o un modelo múltiple, revisa coeficientes e intervalos, analiza residuos y predice nuevas observaciones.",
    palabras: "regresion lineal multiple ols r2 residuos prediccion coeficientes",
  },
  muestreo: {
    titulo: "Diseño muestral",
    descripcion: "Calcula tamaños y extrae muestras",
    icono: "muestreo",
    ceja: "Diseñar",
    subtitulo: "Diseña muestras reproducibles: aleatorio simple, sistemático, estratificado proporcional, Neyman, óptimo y por conglomerados.",
    palabras: "muestreo muestra estratos neyman optimo conglomerados tamano poblacion",
  },
  simulacion: {
    titulo: "Simulación",
    descripcion: "Monte Carlo y bondad de ajuste",
    icono: "simulacion",
    ceja: "Diseñar",
    subtitulo: "Experimenta con Monte Carlo, genera muestras, ajusta distribuciones y compara cuantiles. Todo con semillas reproducibles.",
    palabras: "simulacion monte carlo pi integral ajuste qq muestra semilla",
  },
  teoria: {
    titulo: "Teoría",
    descripcion: "57 lecciones con fórmulas",
    icono: "teoria",
    ceja: "Aprender",
    subtitulo: "Definiciones, fórmulas, propiedades y ejemplos resueltos. Cada lección se conecta con la herramienta que la pone en práctica.",
    palabras: "teoria lecciones formulas apuntes aprender katex",
  },
  ajustes: {
    titulo: "Ajustes",
    descripcion: "Apariencia, formato y datos",
    icono: "ajustes",
    ceja: "Sistema",
    subtitulo: "Personaliza la lectura y el formato, revisa el estado del motor y controla los datos guardados en tu equipo.",
    palabras: "ajustes preferencias tema formato decimales datos privacidad historial",
  },
};

export const NAV = [
  { grupo: "Empezar", items: ["inicio"] },
  { grupo: "Explorar", items: ["distribuciones", "descriptiva", "probabilidad"] },
  { grupo: "Inferir", items: ["inferencia", "regresion"] },
  { grupo: "Diseñar", items: ["muestreo", "simulacion"] },
  { grupo: "Aprender", items: ["teoria"] },
];

export const ORDEN_VISTAS = NAV.flatMap((g) => g.items);

export const ETIQUETAS_CATEGORIA = {
  distribuciones: "Distribuciones",
  muestreo: "Muestreo",
  inferencia: "Inferencia",
  analisis: "Análisis de datos",
  otros: "Referencia",
};

export const ATAJOS = [
  { teclas: ["Ctrl", "K"], texto: "Buscar una herramienta, modelo o lección" },
  { teclas: ["Ctrl", "Enter"], texto: "Calcular en el formulario activo" },
  { teclas: ["Ctrl", "Shift", "L"], texto: "Alternar tema claro y oscuro" },
  { teclas: ["F1"], texto: "Abrir la ayuda y los atajos (también «?» fuera de un campo)" },
  { teclas: ["Esc"], texto: "Cancelar el cálculo en curso; cerrar diálogos y avisos" },
  { teclas: ["Alt", "G"], texto: "Ir al gráfico" },
  { teclas: ["←", "→"], texto: "En un gráfico: recorrer los valores punto a punto" },
  { teclas: ["+", "−", "0"], texto: "En un gráfico: acercar, alejar y restablecer la vista" },
  { teclas: ["Shift", "←/→"], texto: "En un gráfico ampliado: desplazar la vista" },
];

/** Herramienta que practica cada lección de teoría. */
export function herramientaDeLeccion(clave, metaDatos) {
  const dist = metaDatos?.distribuciones?.some((d) => d.clave === clave);
  if (dist) return { ruta: `distribuciones/${clave}`, etiqueta: `Abrir ${clave.replaceAll("_", " ")}` };
  if (clave.startsWith("muestreo") || clave.startsWith("tamano")) {
    const mapa = {
      muestreo_finito: "finito",
      muestreo_infinito: "infinito",
      muestreo_sistematico: "sistematico",
      muestreo_estratificado: "proporcional",
      muestreo_neyman: "neyman",
      muestreo_optimo: "optimo",
      muestreo_conglomerados: "conglomerados",
    };
    return { ruta: `muestreo/${mapa[clave] || "finito"}`, etiqueta: "Abrir diseño muestral" };
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
