# Bernoulli

## Definición formal

Un único ensayo binario: $X=1$ si hay éxito y $X=0$ si hay fracaso. En AmPu 3.0 se parametriza exactamente como en `scipy.stats`;
los eventos fuera del soporte reciben masa/densidad 0.

## Parámetros y rango

| Parámetro | Significado | Rango | Valor de ejemplo |
|---|---|---|---|
| `p` | Probabilidad de éxito | ≥ 0; ≤ 1 | `0.4` |


## Función de masa (PMF)

$$
P(X=x)=\begin{cases}p^x(1-p)^{1-x},&x\in\{0,1\}\\0,&\mathrm{en\ otro\ caso}\end{cases}
$$

## Función de distribución acumulada (CDF)

$$
F(x)=\begin{cases}0,&x<0\\1-p,&0\le x<1\\1,&x\ge1\end{cases}
$$

En general, la CDF es $F(x)=P(X\le x)$. Para una variable continua,
$P(a\le X\le b)=F(b)-F(a)$; para una discreta los extremos se incluyen
según los saltos de su CDF. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.

## Media, varianza y desviación estándar

$$
\operatorname{E}[X]=p
$$

$$
\operatorname{Var}(X)=p(1-p)
$$

$$
\sigma_X=\sqrt{\operatorname{Var}(X)}
$$

En modelos multivariados los momentos anteriores son **por componente**.
Si el momento no existe, la desviación tampoco está definida.

## Propiedades y casos especiales

Los límites $p=0$ y $p=1$ son casos degenerados. Es la binomial con $n=1$.

![Representación de Bernoulli](../imagenes/bernoulli.png)

*Figura 1. Curva teórica o primera marginal ilustrativa para Bernoulli; no sustituye a la densidad conjunta de un modelo multivariante.*

## Ejemplo resuelto, paso a paso

1. Configure `p=0.4` y el evento $x=1$.
2. Sustituya los parámetros en la fórmula de masa (PMF); obtenga probabilidad **0.4**.
3. Evalúe la CDF en ese mismo evento: **1**. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.
4. Interprete unidades y soporte antes de comunicar el resultado; la UI conserva todos los decimales internos.

## Referencias

- Ross, S. M. (2019). *A First Course in Probability* (10.ª ed.). Pearson.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
