# Prueba t de Welch · dos medias

## Definición formal

Compara medias independientes sin asumir varianzas iguales.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `s₁, s₂` | Desviaciones muestrales |
| `n₁, n₂` | Tamaños de grupo ≥2 |
| `α` | Significación |


## Función, estadístico o regla de selección

$$
T=\frac{\bar X_1-\bar X_2}{\sqrt{s_1^2/n_1+s_2^2/n_2}},\quad\nu=\frac{(s_1^2/n_1+s_2^2/n_2)^2}{(s_1^2/n_1)^2/(n_1-1)+(s_2^2/n_2)^2/(n_2-1)}
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_T(t)\approx F_{t_\nu}(t)
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}_{H_0}[T]\approx0,\quad\operatorname{Var}(T)\approx\frac\nu{\nu-2}\ (\nu>2)
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Welch es preferible a imponer varianzas iguales sin justificación. El IC se basa en grados de libertad de Satterthwaite.

![Esquema de Prueba t de Welch · dos medias](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Con $\bar x_1=10$, $\bar x_2=8$, $s_1=2$, $s_2=3$ y $n_1=n_2=16$.
2. $SE=\sqrt{4/16+9/16}=0,901$, de modo que $t\approx2,219$.
3. Evalúe la cola t con $\nu$ de Welch y compare la p con α.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
