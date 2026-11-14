# Normal general

## Definición formal

Familia de densidades simétricas de media $\mu$ y desviación $\sigma$.

## Parámetros y rango

| Parámetro | Significado | Valores admitidos | Ejemplo |
|---|---|---|---|
| `mu` | Media | Real finito | 0 |
| `sigma` | Desviación estándar | > 0 | 1 |

## Función de densidad (PDF)

$$
f(x)=\frac{1}{\sigma\sqrt{2\pi}}\exp\left[-\frac{(x-\mu)^2}{2\sigma^2}\right]
$$

## Función de distribución acumulada (CDF)

$$
F(x)=\Phi\left(\frac{x-\mu}{\sigma}\right)
$$

La acumulada es $F(x)=P(X\le x)$. Para un intervalo, $P(a\le X\le b)=F(b)-F(a)$. La densidad $f(x)$ no es una probabilidad puntual: $P(X=x)=0$.

## Media, varianza y desviación estándar

$$
\begin{aligned}\operatorname{E}[X]&=\mu\\[4pt]\operatorname{Var}(X)&=\sigma^2\\[4pt]\sigma_X&=\sqrt{\operatorname{Var}(X)}\end{aligned}
$$

## Propiedades y casos especiales

La normal estándar es el caso $\mu=0,\sigma=1$. Las probabilidades en intervalos se restan entre dos CDF.

![Representación de Normal general](../imagenes/normal.png)

*Figura 1. Normal general: representación ilustrativa de la función de densidad.*

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa `mu` = 0, `sigma` = 1 y evalúa el punto $x=1$.
2. **Sustitución.** $f(1)=e^{-1/2}/\sqrt{2\pi}$. La densidad es **0,241971**.
3. **Acumulada.** $F(1)=P(X\le 1)$ ≈ **0,841345**.
4. **Interpretación.** La probabilidad de no superar 1 es aproximadamente 84,13 %. Para una probabilidad entre dos puntos, resta sus acumuladas.

## Referencias

- Ross, S. M. (2019). *A First Course in Probability* (10.ª ed.). Pearson.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
