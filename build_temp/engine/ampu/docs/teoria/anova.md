# ANOVA de una vía

## Definición formal

Prueba igualdad de medias de 2 o más grupos independientes mediante la razón de variaciones.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `k` | Número de grupos ≥2 |
| `nᵢ` | Tamaños de grupo |
| `α` | Significación |


## Función, estadístico o regla de selección

$$
F=\frac{SS_{\mathrm{entre}}/(k-1)}{SS_{\mathrm{dentro}}/(N-k)}
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_F(x)=I_{(k-1)x/[(k-1)x+N-k]}\left(\frac{k-1}{2},\frac{N-k}{2}\right)
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[F]=\frac{N-k}{N-k-2}\ (N-k>2),\quad\sigma_F=\sqrt{\operatorname{Var}(F)}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Requiere independencia y varianzas similares; rechazar H₀ no identifica qué pares difieren.

![Esquema de ANOVA de una vía](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Compare tres grupos con medias 3, 6 y 10.
2. Calcule sumas de cuadrados entre y dentro, y sus grados de libertad 2 y $N-3$.
3. Divida medias cuadráticas, consulte cola F y compare p con α.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
