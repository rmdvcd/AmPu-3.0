# Erlang

## Definición formal

Suma de $k$ esperas exponenciales independientes con la misma tasa $\lambda$; $k$ entero. En AmPu 3.0 se parametriza exactamente como en `scipy.stats`;
los eventos fuera del soporte reciben masa/densidad 0.

## Parámetros y rango

| Parámetro | Significado | Rango | Valor de ejemplo |
|---|---|---|---|
| `k` | Etapas de espera | ≥ 1; sin límite | `3` |
| `tasa` | Tasa λ | > 0; sin límite | `1.0` |


## Función de densidad (PDF)

$$
f(x)=\frac{\lambda^k x^{k-1}e^{-\lambda x}}{(k-1)!},\quad x\ge0
$$

## Función de distribución acumulada (CDF)

$$
F(x)=1-e^{-\lambda x}\sum_{j=0}^{k-1}\frac{(\lambda x)^j}{j!}
$$

En general, la CDF es $F(x)=P(X\le x)$. Para una variable continua,
$P(a\le X\le b)=F(b)-F(a)$; para una discreta los extremos se incluyen
según los saltos de su CDF. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.

## Media, varianza y desviación estándar

$$
\operatorname{E}[X]=\frac{k}{\lambda}
$$

$$
\operatorname{Var}(X)=\frac{k}{\lambda^2}
$$

$$
\sigma_X=\sqrt{\operatorname{Var}(X)}
$$

En modelos multivariados los momentos anteriores son **por componente**.
Si el momento no existe, la desviación tampoco está definida.

## Propiedades y casos especiales

Es gamma con forma entera $k$; $k=1$ produce una exponencial.

![Representación de Erlang](../imagenes/erlang.png)

*Figura 1. Curva teórica o primera marginal ilustrativa para Erlang; no sustituye a la densidad conjunta de un modelo multivariante.*

## Ejemplo resuelto, paso a paso

1. Configure `k=3`, `tasa=1.0` y el evento $x=3$.
2. Sustituya los parámetros en la fórmula de densidad (PDF); obtenga densidad (no probabilidad puntual) **0.224042**.
3. Evalúe la CDF en ese mismo evento: **0.57681**. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.
4. Interprete unidades y soporte antes de comunicar el resultado; la UI conserva todos los decimales internos.

## Referencias

- Ross, S. M. (2019). *A First Course in Probability* (10.ª ed.). Pearson.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
