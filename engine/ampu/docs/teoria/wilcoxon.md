# Prueba de Wilcoxon pareada

## Definición formal

Contrasta si las diferencias de pares tienden a cero a partir de sus rangos absolutos.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `dᵢ` | Diferencias de pares no idénticos |
| `W` | Suma de rangos con signo |

## Fórmula y procedimiento

$$
W_+=\sum_{i:d_i>0}\operatorname{rango}(|d_i|)
$$

## Referencia y supuestos

Para una alternativa bilateral, AmPu informa $W=\min(W_+,W_-)$. Las diferencias deben ser aproximadamente simétricas bajo la hipótesis de ubicación. AmPu usa referencia exacta con hasta 50 diferencias no nulas, sin ceros ni empates en valor absoluto. En los demás casos usa una aproximación normal y advierte de sus limitaciones.

## Propiedades y casos especiales

La hipótesis de simetría es importante: sin ella, la prueba no se interpreta simplemente como una comparación de medianas. AmPu omite las diferencias nulas según la convención de SciPy.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa mediciones pareadas A: `1 2 3 4` y B: `2 4 6 8`, con alternativa bilateral.
2. **Rangos con signo.** Las diferencias $A-B$ son −1, −2, −3 y −4. Sus rangos absolutos son 1, 2, 3 y 4; $W_+=0$ y $W_-=10$.
3. **Resultado.** El estadístico bilateral es $\min(W_+,W_-)=$ **0**, con p-valor exacto **0,125**.
4. **Conclusión.** No rechaces al 5 %. La prueba presupone pares independientes entre sí y una distribución aproximadamente simétrica de sus diferencias.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
