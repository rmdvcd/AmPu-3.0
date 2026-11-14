# Chi-cuadrado · independencia

## Definición formal

Contrasta independencia entre dos variables categóricas en tabla de contingencia.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `Oᵢⱼ` | Frecuencias observadas en la tabla |
| `Eᵢⱼ` | Total fila × total columna / total |
| `r,c` | Número de filas y columnas |

## Fórmula y procedimiento

$$
X^2=\sum_{i=1}^{r}\sum_{j=1}^{c}\frac{(O_{ij}-E_{ij})^2}{E_{ij}},\quad\nu=(r-1)(c-1)
$$

## Distribución de referencia

Las esperadas son $E_{ij}=O_{i+}O_{+j}/N$. Bajo independencia, la referencia asintótica es $\chi^2_{(r-1)(c-1)}$. AmPu calcula el estadístico sin corrección de Yates. Si una tabla 2×2 de conteos enteros tiene alguna frecuencia esperada menor que 5, AmPu decide con la prueba exacta de Fisher.

## Propiedades y casos especiales

En tablas mayores que 2×2, o con frecuencias no enteras, la referencia sigue siendo asintótica. Las esperadas pequeñas reducen su fiabilidad; revisa el diseño o considera un procedimiento exacto apropiado.

## Ejemplo resuelto, paso a paso

1. **Datos.** Escribe dos filas en la tabla: `18 12` y `10 20`. Los totales de fila son 30 y 30; los de columna, 28 y 32.
2. **Esperadas.** En ambas filas se esperan 14 y 16. La suma de contribuciones, sin corrección de Yates, es $X^2\approx$ **4,285714**.
3. **Referencia.** Con $(2-1)(2-1)=1$ grado de libertad, el p-valor es **0,038434**.
4. **Conclusión.** Rechaza la independencia al 5 %. La asociación detectada no establece una relación causal.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
