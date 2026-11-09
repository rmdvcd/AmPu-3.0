# Binomial

## Definición formal

Cuenta éxitos en $n$ ensayos de Bernoulli independientes con probabilidad común $p$. En AmPu 3.0 se parametriza exactamente como en `scipy.stats`;
los eventos fuera del soporte reciben masa/densidad 0.

## Parámetros y rango

| Parámetro | Significado | Rango | Valor de ejemplo |
|---|---|---|---|
| `n` | Ensayos independientes | ≥ 0; sin límite | `10` |
| `p` | Probabilidad de éxito | ≥ 0; ≤ 1 | `0.5` |


## Función de masa (PMF)

$$
P(X=x)=\begin{cases}\binom{n}{x}p^x(1-p)^{n-x},&x\in\{0,\ldots,n\}\\0,&\mathrm{en\ otro\ caso}\end{cases}
$$

## Función de distribución acumulada (CDF)

$$
F(x)=\sum_{k=0}^{\lfloor x\rfloor}\binom{n}{k}p^k(1-p)^{n-k}
$$

En general, la CDF es $F(x)=P(X\le x)$. Para una variable continua,
$P(a\le X\le b)=F(b)-F(a)$; para una discreta los extremos se incluyen
según los saltos de su CDF. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.

## Media, varianza y desviación estándar

$$
\operatorname{E}[X]=np
$$

$$
\operatorname{Var}(X)=np(1-p)
$$

$$
\sigma_X=\sqrt{\operatorname{Var}(X)}
$$

En modelos multivariados los momentos anteriores son **por componente**.
Si el momento no existe, la desviación tampoco está definida.

## Propiedades y casos especiales

$p=0$ o $p=1$ dan resultados deterministas. Para $n$ grande y $np,n(1-p)$ suficientes se usa la aproximación normal.

![Representación de Binomial](../imagenes/binomial.png)

*Figura 1. Curva teórica o primera marginal ilustrativa para Binomial; no sustituye a la densidad conjunta de un modelo multivariante.*

## Ejemplo resuelto, paso a paso

1. Configure `n=10`, `p=0.5` y el evento $x=5$.
2. Sustituya los parámetros en la fórmula de masa (PMF); obtenga probabilidad **0.246094**.
3. Evalúe la CDF en ese mismo evento: **0.623047**. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.
4. Interprete unidades y soporte antes de comunicar el resultado; la UI conserva todos los decimales internos.

## Referencias

- Ross, S. M. (2019). *A First Course in Probability* (10.ª ed.). Pearson.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
