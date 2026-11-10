# Prueba de Wilcoxon pareada

## Definición formal

Contrasta si las diferencias de pares tienden a cero a partir de sus rangos absolutos.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `dᵢ` | Diferencias de pares no idénticos |
| `W` | Suma de rangos con signo |


## Función, estadístico o regla de selección

$$
W_+=\sum_{i:d_i>0}\operatorname{rango}(|d_i|)
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_W(w)=P(W\le w)\quad\text{con distribución exacta/asintótica según SciPy}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[W_+]\approx\frac{n(n+1)}4,\quad\operatorname{Var}(W_+)\approx\frac{n(n+1)(2n+1)}{24}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Pares con diferencia cero reciben manejo especial; los tamaños y empates afectan la aproximación.

![Esquema de Prueba de Wilcoxon pareada](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Compare antes (1,2,3,4) y después (2,4,4,7).
2. Calcule diferencias, ordene magnitudes y sume rangos positivos/negativos.
3. Use la p bilateral para evaluar si la ubicación cambió.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
