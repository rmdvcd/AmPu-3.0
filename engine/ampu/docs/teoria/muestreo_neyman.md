# Asignación de Neyman

## Definición formal

Distribuye tamaño estratificado según el tamaño y la variabilidad de cada estrato, a costes iguales.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `N_h` | Unidades en el estrato |
| `S_h` | Desviación esperada (≥0) |
| `n` | Tamaño total |

## Fórmula y procedimiento

$$
n_h\approx n\frac{N_hS_h}{\sum_j N_jS_j}
$$

## Selección e interpretación

Con costes unitarios iguales y tamaño total fijado, Neyman minimiza la varianza aproximada de la media estratificada al asignar en proporción a $N_hS_h$. Las desviaciones son estimaciones previas, no datos inventados para favorecer un estrato.

## Propiedades y casos especiales

Se redondea preservando la suma y la capacidad. Si todas las $S_h=0$, no hay asignación informativa por dispersión.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa $(N_A,S_A)=(100;8)$ y $(N_B,S_B)=(200;4)$, con tamaño total 40.
2. **Pesos.** Los productos $N_AS_A$ y $N_BS_B$ son 800 y 800.
3. **Asignación.** $n_A=40(800/1600)=$ **20** y $n_B=$ **20**. Selecciona ese número sin reemplazo en cada estrato, con semilla 42.
4. **Interpretación.** El estrato más variable recibe más muestra que con asignación puramente proporcional. Los desvíos esperados deben proceder de información previa fiable.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
