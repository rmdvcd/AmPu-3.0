# Asignación óptima con costes

## Definición formal

Distribuye la muestra entre estratos usando tamaño, desviación esperada y coste por observación. La interfaz normaliza los pesos al tamaño total solicitado.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `N_h` | Tamaño de estrato |
| `S_h` | Desviación esperada |
| `c_h` | Coste positivo por unidad |

## Fórmula y procedimiento

$$
n_h\approx n\frac{N_hS_h/\sqrt{c_h}}{\sum_j N_jS_j/\sqrt{c_j}}
$$

## Qué optimiza y qué no

La regla $n_h\propto N_hS_h/\sqrt{c_h}$ corresponde a la asignación de coste óptimo bajo una restricción presupuestaria. AmPu normaliza esos pesos a un $n$ total indicado: es una asignación ponderada por costes, no un optimizador de presupuesto. Si solo se fija $n$ y se ignoran costes, la regla de varianza mínima es Neyman.

## Propiedades y casos especiales

Se requieren costes positivos. Si los costes son iguales, los pesos se reducen a Neyman. El redondeo de cuotas debe conservar el tamaño total y respetar la capacidad de cada estrato.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa A: $(N,S,c)=(100;8;1)$ y B: $(200;4;4)$, con tamaño total 60.
2. **Pesos de coste.** $N_AS_A/\sqrt{c_A}=800$ y $N_BS_B/\sqrt{c_B}=400$.
3. **Asignación.** Al normalizar para sumar 60, se obtienen **40** unidades de A y **20** de B. Selecciona sin reemplazo, con semilla 42.
4. **Interpretación.** AmPu normaliza estos pesos a un tamaño total fijado. No resuelve un presupuesto monetario fijo: ese problema determina además el tamaño total óptimo.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
