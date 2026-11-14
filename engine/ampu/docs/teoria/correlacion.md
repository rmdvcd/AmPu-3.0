# Correlación de Pearson y Spearman

## Definición formal

Pearson mide asociación lineal; Spearman mide asociación monótona usando rangos.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `xᵢ,yᵢ` | Observaciones pareadas, n≥3 |
| `r` | Coeficiente de Pearson |
| `ρₛ` | Coeficiente de Spearman |

## Fórmula y procedimiento

$$
r=\frac{\sum_i(x_i-\bar x)(y_i-\bar y)}{\sqrt{\sum_i(x_i-\bar x)^2\sum_i(y_i-\bar y)^2}}
$$

## Referencia y supuestos

Para Pearson, bajo normalidad bivariada y $H_0:\rho=0$, el estadístico $T=r\sqrt{(n-2)/(1-r^2)}$ sigue una $t_{n-2}$. Spearman aplica Pearson a los rangos medios; su p-valor de SciPy es aproximado y debe interpretarse con cautela en muestras pequeñas.

## Propiedades y casos especiales

Pearson evalúa asociación lineal y es sensible a valores extremos; Spearman evalúa asociación monótona. Ninguno demuestra causalidad. Ambos coeficientes son indefinidos si una variable es constante.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa X: `1 2 3 4 5` e Y: `2 4 5 4 5`, manteniendo el orden de los pares. Elige Pearson.
2. **Cálculo.** Las sumas centradas son $S_{xx}=10$, $S_{yy}=6$ y $S_{xy}=6$. Por tanto, $r=6/\sqrt{60}\approx$ **0,774597**.
3. **Referencia.** Con 3 grados de libertad, el p-valor bilateral es **0,124027**.
4. **Conclusión.** Aunque la correlación observada es positiva, no rechaces $H_0:\rho=0$ al 5 %. Ni una correlación grande ni una pequeña muestra permiten concluir causalidad.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
