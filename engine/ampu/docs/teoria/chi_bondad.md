# Chi-cuadrado · bondad de ajuste

## Definición formal

Compara frecuencias observadas con frecuencias esperadas por un modelo categórico.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `Oᵢ` | Frecuencia observada ≥0 |
| `Eᵢ` | Frecuencia esperada positiva |
| `m` | Parámetros estimados de estos datos |

## Fórmula y procedimiento

$$
X^2=\sum_{i=1}^{k}\frac{(O_i-E_i)^2}{E_i},\quad\nu=k-1-m
$$

## Distribución de referencia

La referencia es aproximadamente $\chi^2_\nu$ con $\nu=k-1-m>0$. El p-valor es de cola derecha. Las categorías deben ser excluyentes; observadas y esperadas han de tener el mismo total. Frecuencias esperadas pequeñas debilitan la aproximación.

## Propiedades y casos especiales

Pocas frecuencias esperadas (<5) debilitan la aproximación asintótica. El p-valor es cola derecha.

## Ejemplo resuelto, paso a paso

1. **Datos.** Introduce observadas `12 15 23` y esperadas `15 15 20`. Ambas suman 50 y no se han estimado parámetros con estos datos.
2. **Estadístico.** $X^2=9/15+0+9/20=$ **1,05**.
3. **Referencia.** Hay $3-1=2$ grados de libertad. La cola derecha da p-valor **0,591555**.
4. **Conclusión.** No rechaces el modelo al 5 %. Un p-valor grande no demuestra que el modelo sea el único posible.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
