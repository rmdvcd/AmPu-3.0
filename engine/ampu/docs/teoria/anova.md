# ANOVA de una vía

## Definición formal

Contrasta la igualdad de medias de dos o más grupos independientes mediante una razón de variaciones.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `k` | Número de grupos ≥2 |
| `nᵢ` | Tamaños de grupo |
| `α` | Significación |

## Fórmula y procedimiento

$$
F=\frac{SS_{\mathrm{entre}}/(k-1)}{SS_{\mathrm{dentro}}/(N-k)}
$$

## Distribución de referencia

Bajo igualdad de medias, independencia, normalidad de los errores y varianza común, la razón sigue una $F_{k-1,N-k}$. El p-valor corresponde a su cola derecha. La diferencia entre medias no puede evaluarse solo mirando sus valores: también hace falta la variación dentro de los grupos.

## Propiedades y casos especiales

Requiere independencia y varianzas similares; rechazar H₀ no identifica qué pares difieren.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa tres grupos, uno por línea: `2 3 4`, `5 6 7` y `9 10 11`. Sus medias son 3, 6 y 10.
2. **Variación.** La suma de cuadrados entre grupos es 74 y la interna es 6. Sus grados de libertad son 2 y 6.
3. **Resultado.** $F=(74/2)/(6/6)=$ **37**. La cola $F_{2,6}$ da p-valor **0,000422**.
4. **Conclusión.** Rechaza la igualdad global al 5 %. Para identificar qué pares difieren se necesitan comparaciones posteriores con control de multiplicidad.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
