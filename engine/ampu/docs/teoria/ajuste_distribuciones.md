# Ajuste y comparación de distribuciones

## Definición formal

Estima los parámetros de una familia de distribuciones por máxima verosimilitud y compara su ajuste a los datos.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `xᵢ` | Muestra numérica finita ≥5 |
| `θ` | Parámetros del modelo dentro de límites |
| `AIC` | Criterio de información para comparar modelos |

## Fórmula y procedimiento

$$
\hat\theta=\operatorname*{arg\,max}_{\theta}\sum_{i=1}^n\log f(x_i;\theta),\quad\mathrm{AIC}=2k-2\log L(\hat\theta)
$$

## Ajuste e interpretación

AmPu ajusta de forma determinista por máxima verosimilitud. En familias positivas fija la localización en 0; en beta fija además la escala en 1. Solo se cuentan los parámetros libres en AIC. El histograma y el QQ-plot ayudan a detectar desacuerdos que una cifra aislada no muestra.

## Propiedades y casos especiales

El p-valor KS sin corrección tras estimar parámetros es **exploratorio**, no una prueba formal de bondad de ajuste. Compara AIC solo con los mismos datos y el mismo tratamiento de observaciones.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa `1 2 3 4 5` y elige la familia exponencial. AmPu fija la localización en 0.
2. **Estimación.** La escala de máxima verosimilitud es la media, **3**; la tasa equivalente es $1/3$.
3. **Comparación.** $\log L=-5\log(3)-5$. Con un parámetro libre, $\mathrm{AIC}=2-2\log L\approx$ **22,986123**.
4. **Interpretación.** Compara AIC solo entre modelos ajustados a estas mismas observaciones. El KS es exploratorio porque los parámetros se estimaron con esos datos.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
