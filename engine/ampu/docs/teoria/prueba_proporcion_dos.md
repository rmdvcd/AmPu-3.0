# Prueba z · dos proporciones

## Definición formal

Contrasta la igualdad de dos proporciones independientes con tasa agrupada bajo H₀.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `x₁,x₂` | Éxitos de cada grupo |
| `n₁,n₂` | Tamaños positivos |
| `α` | Significación |


## Función, estadístico o regla de selección

$$
Z=\frac{\hat p_1-\hat p_2}{\sqrt{\hat p(1-\hat p)(1/n_1+1/n_2)}},\quad\hat p=\frac{x_1+x_2}{n_1+n_2}
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_Z(z)\approx\Phi(z)\quad\text{bajo igualdad de proporciones}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}_{H_0}[Z]\approx0,\quad\operatorname{Var}_{H_0}(Z)\approx1
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

La diferencia IC usa error **no agrupado**. Si todos son éxitos o todos fracasos, la varianza nula impide esta aproximación.

![Esquema de Prueba z · dos proporciones](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Compare 40/100 frente a 20/100: $\hat p=0,3$.
2. $SE_0=\sqrt{0,3(0,7)(0,01+0,01)}=0,0648$.
3. $z=(0,4-0,2)/0,0648\approx3,09$; p bilateral $\approx0,002$.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
