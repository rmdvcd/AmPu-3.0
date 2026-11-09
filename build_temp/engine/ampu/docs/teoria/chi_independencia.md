# Chi-cuadrado · independencia

## Definición formal

Contrasta independencia entre dos variables categóricas en tabla de contingencia.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `Oᵢⱼ` | Frecuencias observadas en la tabla |
| `Eᵢⱼ` | Total fila × total columna / total |
| `r,c` | Número de filas y columnas |


## Función, estadístico o regla de selección

$$
X^2=\sum_{i=1}^{r}\sum_{j=1}^{c}\frac{(O_{ij}-E_{ij})^2}{E_{ij}},\quad\nu=(r-1)(c-1)
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_{X^2}(x)=\frac{\gamma(\nu/2,x/2)}{\Gamma(\nu/2)}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[X^2]=\nu,\quad\operatorname{Var}(X^2)=2\nu,\quad\sigma=\sqrt{2\nu}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

AmPu evita corrección de Yates automáticamente; cuando esperadas <5, interpretar con cautela o usar prueba exacta.

![Esquema de Chi-cuadrado · independencia](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Para la tabla ((18,12),(10,20)), los totales de fila son 30,30 y columna 28,32.
2. Espere ((14,16),(14,16)) y sume $X^2\approx4,286$.
3. Con $\nu=1$, p $\approx0,0384$; rechace independencia a α=0,05.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
