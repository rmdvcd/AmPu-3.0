# Prueba de Kruskal–Wallis

## Definición formal

Alternativa no paramétrica a ANOVA para dos o más grupos independientes.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `k` | Número de grupos ≥2 |
| `R_h` | Suma de rangos por grupo |
| `N` | Total de observaciones |

## Fórmula y procedimiento

$$
H=\frac{12}{N(N+1)}\sum_{h=1}^k\frac{R_h^2}{n_h}-3(N+1)
$$

## Referencia y supuestos

El estadístico se corrige por empates y se compara aproximadamente con una $\chi^2_{k-1}$. Requiere grupos independientes y tamaños suficientes para la aproximación; con pocos datos por grupo, la interpretación asintótica es débil.

## Propiedades y casos especiales

AmPu corrige los empates. El rechazo global no identifica qué grupos difieren; para comparar medianas se necesitan formas distribucionales similares. Si todos los valores son iguales, la prueba no está definida.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa tres grupos independientes: `1 2 3 4 5`, `6 7 8 9 10` y `11 12 13 14 15`.
2. **Rangos.** No hay empates. Las sumas por grupo son 15, 40 y 65; al sustituir en la fórmula, $H=$ **12,5**.
3. **Referencia.** Con 2 grados de libertad, la aproximación chi-cuadrado da p-valor **0,00193**.
4. **Conclusión.** Rechaza la igualdad global al 5 %. Interpretar el resultado como diferencia de medianas requiere formas y dispersiones comparables.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
