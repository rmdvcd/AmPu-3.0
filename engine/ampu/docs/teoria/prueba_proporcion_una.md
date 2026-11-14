# Prueba z · una proporción

## Definición formal

Contrasta $H_0:p=p_0$ usando error estándar bajo la hipótesis nula.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `x` | Éxitos observados entre 0 y n |
| `n` | Ensayos positivos |
| `p₀` | Proporción nula en (0,1) |

## Fórmula y procedimiento

$$
Z=\frac{\hat p-p_0}{\sqrt{p_0(1-p_0)/n}},\quad\hat p=x/n
$$

## Aproximación y prueba exacta

El estadístico z es aproximadamente normal estándar si $np_0\ge5$ y $n(1-p_0)\ge5$. AmPu utiliza una prueba binomial exacta cuando esas condiciones no se cumplen. La proporción nula debe estar estrictamente entre 0 y 1.

## Propiedades y casos especiales

AmPu muestra un intervalo de Wilson cuando usa la aproximación z y un intervalo exacto de Clopper–Pearson cuando usa la prueba binomial exacta. El intervalo y el p-valor responden a preguntas diferentes.

## Ejemplo resuelto, paso a paso

1. **Datos.** Observa 50 éxitos en 100 ensayos y contrasta $H_0:p=0{,}3$, con alternativa bilateral.
2. **Estadístico.** $\hat p=0{,}5$ y el error estándar nulo es $\sqrt{0{,}3\cdot0{,}7/100}$. Se obtiene $z\approx$ **4,364358**.
3. **Resultado.** El p-valor bilateral es aproximadamente **0,000013**. Las frecuencias nulas, 30 y 70, permiten la aproximación normal.
4. **Conclusión.** Rechaza $H_0$ al 5 %. El p-valor no es la probabilidad de que la proporción nula sea verdadera.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
