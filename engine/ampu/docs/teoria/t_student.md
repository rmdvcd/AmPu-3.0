# t de Student

## Definición formal

Cociente de una normal estándar y la raíz de una chi-cuadrado independiente dividida por $\nu$. En AmPu 3.0 se parametriza exactamente como en `scipy.stats`;
los eventos fuera del soporte reciben masa/densidad 0.

## Parámetros y rango

| Parámetro | Significado | Rango | Valor de ejemplo |
|---|---|---|---|
| `gl` | Grados de libertad | > 0; sin límite | `5.0` |


## Función de densidad (PDF)

$$
f(x)=\frac{\Gamma((\nu+1)/2)}{\sqrt{\nu\pi}\,\Gamma(\nu/2)}\left(1+\frac{x^2}{\nu}\right)^{-(\nu+1)/2}
$$

## Función de distribución acumulada (CDF)

$$
F(x)=\int_{-\infty}^{x}f(t)\,\mathrm{d}t
$$

En general, la CDF es $F(x)=P(X\le x)$. Para una variable continua,
$P(a\le X\le b)=F(b)-F(a)$; para una discreta los extremos se incluyen
según los saltos de su CDF. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.

## Media, varianza y desviación estándar

$$
\operatorname{E}[X]=0\ (\nu>1)
$$

$$
\operatorname{Var}(X)=\frac\nu{\nu-2}\ (\nu>2)
$$

$$
\sigma_X=\sqrt{\operatorname{Var}(X)}
$$

En modelos multivariados los momentos anteriores son **por componente**.
Si el momento no existe, la desviación tampoco está definida.

## Propiedades y casos especiales

Para $\nu=1$ es Cauchy, sin media ni varianza; para $1<\nu\le2$ no hay varianza. Al crecer $\nu$ tiende a la normal.

![Representación de t de Student](../imagenes/t_student.png)

*Figura 1. Curva teórica o primera marginal ilustrativa para t de Student; no sustituye a la densidad conjunta de un modelo multivariante.*

## Ejemplo resuelto, paso a paso

1. Configure `gl=5.0` y el evento $x=1$.
2. Sustituya los parámetros en la fórmula de densidad (PDF); obtenga densidad (no probabilidad puntual) **0.21968**.
3. Evalúe la CDF en ese mismo evento: **0.818391**. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.
4. Interprete unidades y soporte antes de comunicar el resultado; la UI conserva todos los decimales internos.

## Referencias

- Ross, S. M. (2019). *A First Course in Probability* (10.ª ed.). Pearson.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
