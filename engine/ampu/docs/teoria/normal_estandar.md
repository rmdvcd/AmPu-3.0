# Normal estándar

## Definición formal

Distribución normal de media 0 y varianza 1, conocida como campana de Gauss. En AmPu 3.0 se parametriza exactamente como en `scipy.stats`;
los eventos fuera del soporte reciben masa/densidad 0.

## Parámetros y rango

| Parámetro | Significado | Rango | Valor de ejemplo |
|---|---|---|---|
| — | Modelo sin parámetros libres | — | — |


## Función de densidad (PDF)

$$
\varphi(z)=\frac{1}{\sqrt{2\pi}}e^{-z^2/2},\quad z\in\mathbb R
$$

## Función de distribución acumulada (CDF)

$$
\Phi(z)=\int_{-\infty}^{z}\varphi(t)\,\mathrm{d}t
$$

En general, la CDF es $F(x)=P(X\le x)$. Para una variable continua,
$P(a\le X\le b)=F(b)-F(a)$; para una discreta los extremos se incluyen
según los saltos de su CDF. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.

## Media, varianza y desviación estándar

$$
\operatorname{E}[Z]=0
$$

$$
\operatorname{Var}(Z)=1
$$

$$
\sigma_X=\sqrt{\operatorname{Var}(X)}
$$

En modelos multivariados los momentos anteriores son **por componente**.
Si el momento no existe, la desviación tampoco está definida.

## Propiedades y casos especiales

Es simétrica: $\Phi(-z)=1-\Phi(z)$. Si $X\sim N(\mu,\sigma^2)$, entonces $(X-\mu)/\sigma\sim N(0,1)$.

![Representación de Normal estándar](../imagenes/normal_estandar.png)

*Figura 1. Curva teórica o primera marginal ilustrativa para Normal estándar; no sustituye a la densidad conjunta de un modelo multivariante.*

## Ejemplo resuelto, paso a paso

1. Configure la distribución estándar y el evento $x=2$.
2. Sustituya los parámetros en la fórmula de densidad (PDF); obtenga densidad (no probabilidad puntual) **0.053991**.
3. Evalúe la CDF en ese mismo evento: **0.97725**. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.
4. Interprete unidades y soporte antes de comunicar el resultado; la UI conserva todos los decimales internos.

## Referencias

- Ross, S. M. (2019). *A First Course in Probability* (10.ª ed.). Pearson.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
