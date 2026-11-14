# Cauchy

## Definición formal

Distribución de colas muy pesadas, centrada en $x_0$ y de escala $\gamma$.

## Parámetros y rango

| Parámetro | Significado | Valores admitidos | Ejemplo |
|---|---|---|---|
| `centro` | Ubicación x₀ | Real finito | 0 |
| `escala` | Escala γ | > 0 | 1 |

## Función de densidad (PDF)

$$
f(x)=\frac{1}{\pi\gamma[1+((x-x_0)/\gamma)^2]}
$$

## Función de distribución acumulada (CDF)

$$
F(x)=\frac12+\frac1\pi\arctan\left(\frac{x-x_0}{\gamma}\right)
$$

La acumulada es $F(x)=P(X\le x)$. Para un intervalo, $P(a\le X\le b)=F(b)-F(a)$. La densidad $f(x)$ no es una probabilidad puntual: $P(X=x)=0$.

## Media, varianza y desviación estándar

$$
\begin{aligned}\operatorname{E}[X]&=\text{indefinida}\\[4pt]\operatorname{Var}(X)&=\text{indefinida}\\[4pt]\sigma_X&=\text{indefinida}\end{aligned}
$$

## Propiedades y casos especiales

Ni la media ni la desviación están definidas. Su mediana es $x_0$. La Cauchy estándar coincide con la t de Student con un grado de libertad.

![Representación de Cauchy](../imagenes/cauchy.png)

*Figura 1. Cauchy: representación ilustrativa de la función de densidad.*

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa `centro` = 0, `escala` = 1 y evalúa el punto $x=1$.
2. **Sustitución.** $f(1)=1/(2\pi)$. La densidad es **0,159155**.
3. **Acumulada.** $F(1)=P(X\le 1)$ ≈ **0,75**.
4. **Interpretación.** La probabilidad de no superar 1 es aproximadamente 75 %. Para una probabilidad entre dos puntos, resta sus acumuladas.

## Referencias

- Ross, S. M. (2019). *A First Course in Probability* (10.ª ed.). Pearson.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
