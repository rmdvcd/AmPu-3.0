# Prueba de Mann–Whitney U

## Definición formal

Prueba no paramétrica para dos grupos independientes basada en rangos.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `n₁,n₂` | Tamaños de los dos grupos |
| `R₁` | Suma de rangos del primero |


## Función, estadístico o regla de selección

$$
U_1=R_1-\frac{n_1(n_1+1)}2
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_U(u)=P(U_1\le u)\quad\text{según la distribución de rangos de SciPy}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[U_1]=\frac{n_1n_2}{2},\quad\operatorname{Var}(U_1)\approx\frac{n_1n_2(n_1+n_2+1)}{12}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

La interpretación como comparación de medianas presupone formas distribucionales similares; SciPy controla empates.

![Esquema de Prueba de Mann–Whitney U](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Ordene conjuntamente muestras (1,2,3) y (4,5,6).
2. Los rangos del primer grupo suman 6 y $U_1=6-3·4/2=0$.
3. Compare el p-valor bilateral con α.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
