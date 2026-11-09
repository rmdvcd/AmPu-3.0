# Exponencial

## Definición formal

Tiempo de espera positivo hasta un suceso de proceso de Poisson con tasa $\lambda$. En AmPu 3.0 se parametriza exactamente como en `scipy.stats`;
los eventos fuera del soporte reciben masa/densidad 0.

## Parámetros y rango

| Parámetro | Significado | Rango | Valor de ejemplo |
|---|---|---|---|
| `tasa` | Tasa de eventos λ | > 0; sin límite | `1.0` |


## Función de densidad (PDF)

$$
f(x)=\begin{cases}\lambda e^{-\lambda x},&x\ge0\\0,&x<0\end{cases}
$$

## Función de distribución acumulada (CDF)

$$
F(x)=\begin{cases}1-e^{-\lambda x},&x\ge0\\0,&x<0\end{cases}
$$

En general, la CDF es $F(x)=P(X\le x)$. Para una variable continua,
$P(a\le X\le b)=F(b)-F(a)$; para una discreta los extremos se incluyen
según los saltos de su CDF. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.

## Media, varianza y desviación estándar

$$
\operatorname{E}[X]=\frac1\lambda
$$

$$
\operatorname{Var}(X)=\frac1{\lambda^2}
$$

$$
\sigma_X=\sqrt{\operatorname{Var}(X)}
$$

En modelos multivariados los momentos anteriores son **por componente**.
Si el momento no existe, la desviación tampoco está definida.

## Propiedades y casos especiales

Sin memoria: $P(X>s+t\mid X>s)=P(X>t)$. Su cola estable es $S(x)=e^{-\lambda x}$ para $x\ge0$.

![Representación de Exponencial](../imagenes/exponencial.png)

*Figura 1. Curva teórica o primera marginal ilustrativa para Exponencial; no sustituye a la densidad conjunta de un modelo multivariante.*

## Ejemplo resuelto, paso a paso

1. Configure `tasa=1.0` y el evento $x=4$.
2. Sustituya los parámetros en la fórmula de densidad (PDF); obtenga densidad (no probabilidad puntual) **0.0183156**.
3. Evalúe la CDF en ese mismo evento: **0.981684**. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.
4. Interprete unidades y soporte antes de comunicar el resultado; la UI conserva todos los decimales internos.

## Referencias

- Ross, S. M. (2019). *A First Course in Probability* (10.ª ed.). Pearson.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
