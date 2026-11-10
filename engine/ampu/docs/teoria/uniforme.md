# Uniforme continua

## Definición formal

Una variable continua con densidad constante en el intervalo $[a,b]$. En AmPu 3.0 se parametriza exactamente como en `scipy.stats`;
los eventos fuera del soporte reciben masa/densidad 0.

## Parámetros y rango

| Parámetro | Significado | Rango | Valor de ejemplo |
|---|---|---|---|
| `a` | Extremo inferior | sin límite; sin límite | `1.0` |
| `b` | Extremo superior | sin límite; sin límite | `5.0` |


## Función de densidad (PDF)

$$
f(x)=\begin{cases}\dfrac1{b-a},&a\le x\le b\\0,&\mathrm{en\ otro\ caso}\end{cases}
$$

## Función de distribución acumulada (CDF)

$$
F(x)=\begin{cases}0,&x<a\\\dfrac{x-a}{b-a},&a\le x\le b\\1,&x>b\end{cases}
$$

En general, la CDF es $F(x)=P(X\le x)$. Para una variable continua,
$P(a\le X\le b)=F(b)-F(a)$; para una discreta los extremos se incluyen
según los saltos de su CDF. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.

## Media, varianza y desviación estándar

$$
\operatorname{E}[X]=\frac{a+b}{2}
$$

$$
\operatorname{Var}(X)=\frac{(b-a)^2}{12}
$$

$$
\sigma_X=\sqrt{\operatorname{Var}(X)}
$$

En modelos multivariados los momentos anteriores son **por componente**.
Si el momento no existe, la desviación tampoco está definida.

## Propiedades y casos especiales

La probabilidad de un punto aislado es cero; se calcula el área entre extremos. Sustituye el error original $a+b$ por $b-a$ en la desviación.

![Representación de Uniforme continua](../imagenes/uniforme.png)

*Figura 1. Curva teórica o primera marginal ilustrativa para Uniforme continua; no sustituye a la densidad conjunta de un modelo multivariante.*

## Ejemplo resuelto, paso a paso

1. Configure `a=1.0`, `b=5.0` y el evento $x=3$.
2. Sustituya los parámetros en la fórmula de densidad (PDF); obtenga densidad (no probabilidad puntual) **0.25**.
3. Evalúe la CDF en ese mismo evento: **0.5**. Para una cola superior, consulte la función de supervivencia; no sume densidades continuas.
4. Interprete unidades y soporte antes de comunicar el resultado; la UI conserva todos los decimales internos.

## Referencias

- Ross, S. M. (2019). *A First Course in Probability* (10.ª ed.). Pearson.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
