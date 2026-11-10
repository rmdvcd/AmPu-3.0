# Pareto

## Definición formal

Modelo de cola de potencia para valores superiores a un mínimo $x_m$. En AmPu 3.0 se parametriza exactamente como en `scipy.stats`;
los eventos fuera del soporte reciben masa/densidad 0.

## Parámetros y rango

| Parámetro | Significado | Rango | Valor de ejemplo |
|---|---|---|---|
| `alpha` | Forma α | > 0; sin límite | `3.0` |
| `xmin` | Mínimo xₘ | > 0; sin límite | `1.0` |


## Función de densidad (PDF)

$$
f(x)=\frac{\alpha x_m^\alpha}{x^{\alpha+1}},\quad x\ge x_m
$$

## Función de distribución acumulada (CDF)

$$
F(x)=\begin{cases}0,&x<x_m\\1-(x_m/x)^\alpha,&x\ge x_m\end{cases}
$$

En general, la CDF es $F(x)=P(X\le x)$. Para una variable continua,
$P(a\le X\le b)=F(b)-F(a)$; para una discreta los extremos se incluyen
según los saltos de su CDF. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.

## Media, varianza y desviación estándar

$$
\operatorname{E}[X]=\frac{\alpha x_m}{\alpha-1}\ (\alpha>1)
$$

$$
\operatorname{Var}(X)=\frac{\alpha x_m^2}{(\alpha-1)^2(\alpha-2)}\ (\alpha>2)
$$

$$
\sigma_X=\sqrt{\operatorname{Var}(X)}
$$

En modelos multivariados los momentos anteriores son **por componente**.
Si el momento no existe, la desviación tampoco está definida.

## Propiedades y casos especiales

La media diverge si $\alpha\le1$ y la varianza si $\alpha\le2$. Multiplicar $x_m$ solo cambia la escala.

![Representación de Pareto](../imagenes/pareto.png)

*Figura 1. Curva teórica o primera marginal ilustrativa para Pareto; no sustituye a la densidad conjunta de un modelo multivariante.*

## Ejemplo resuelto, paso a paso

1. Configure `alpha=3.0`, `xmin=1.0` y el evento $x=2$.
2. Sustituya los parámetros en la fórmula de densidad (PDF); obtenga densidad (no probabilidad puntual) **0.1875**.
3. Evalúe la CDF en ese mismo evento: **0.875**. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.
4. Interprete unidades y soporte antes de comunicar el resultado; la UI conserva todos los decimales internos.

## Referencias

- Ross, S. M. (2019). *A First Course in Probability* (10.ª ed.). Pearson.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
