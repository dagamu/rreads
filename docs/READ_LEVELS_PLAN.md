# RREADS — Planificación Feature “Read Levels”

## 1. Objetivo del feature

El sistema de “Read Levels” permite marcar secciones importantes dentro de los libros HTML para habilitar distintos niveles de lectura resumida.

La idea central es transformar un libro completo en múltiples capas de densidad lectora:

* Nivel 0 → libro completo
* Niveles superiores → versiones progresivamente más condensadas
* Nivel máximo → sólo las ideas más esenciales

El sistema está diseñado para:

* relectura rápida,
* revisión de conceptos clave,
* estudio incremental,
* extracción personal de conocimiento importante.

---

# 2. Filosofía conceptual

RREADS (“Recursive Reads” / “Re-Reads”) utiliza niveles para indicar importancia de contenido.

## Regla semántica

Mientras mayor es el nivel:

* más importante es el contenido,
* más esencial es para relecturas futuras,
* más condensada se vuelve la experiencia.

---

## Ejemplo conceptual

| Nivel | Contenido visible |
| ----- | ----------------- |
| 0     | Todo              |
| 1     | 1+                |
| 2     | 2+                |
| 3     | 3+                |
| 5     | Sólo 5+           |

El contenido sin nivel explícito pertenece implícitamente al nivel 0.

---

# 3. Principio fundamental

El sistema NO modifica:

* cifrado,
* estructura `.enc`,
* scripts Python,
* build pipeline,
* metadatos.

Es exclusivamente una nueva interpretación visual del HTML desde el frontend.

---

# 4. Sintaxis HTML

## Formato oficial

```html id="b1y6d6"
<div data-read-level="3">
    ...
</div>
```

---

# 5. Reglas de niveles

## Nivel implícito

Todo contenido sin atributo:

```html id="fcbd7k"
<p>Texto normal</p>
```

pertenece automáticamente al:

```text id="tgnbyh"
read-level = 0
```

---

## Niveles explícitos

```html id="7ztj2m"
<div data-read-level="5">
    Idea extremadamente importante
</div>
```

---

# 6. Reglas de visualización

## Regla principal

Un nodo es visible si:

```text id="0ywn3o"
node_level >= selected_level
```

---

## Ejemplo

### HTML

```html id="f3f88z"
<p>Contenido base</p>

<div data-read-level="2">
    Contexto importante
</div>

<div data-read-level="5">
    Idea esencial
</div>
```

---

### Resultado

| Nivel seleccionado | Visible       |
| ------------------ | ------------- |
| 0                  | todo          |
| 2                  | niveles 2 y 5 |
| 5                  | sólo nivel 5  |

---

# 7. Nesting (anidamiento)

## Requisito central

Los niveles pueden anidarse libremente.

Ejemplo:

```html id="5ex3n3"
<div data-read-level="2">

    Explicación general

    <div data-read-level="5">
        Idea esencial
    </div>

</div>
```

---

# 8. Problema principal

La lógica DOM tradicional implica:

```text id="3t0tny"
si el padre tiene display:none
→ hijos también desaparecen
```

Pero RREADS requiere:

```text id="h68e4x"
un hijo importante debe sobrevivir aunque el padre desaparezca
```

---

# 9. Solución arquitectónica

## Estrategia

El sistema NO debe depender directamente del DOM original para ocultar niveles.

En cambio:

1. Se parsea el HTML descifrado.
2. Se construye un árbol lógico de niveles.
3. Se genera dinámicamente un nuevo DOM filtrado.
4. Sólo se renderizan nodos válidos para el nivel actual.

---

# 10. Modelo conceptual

El HTML original se considera:

```text id="8twhgs"
source tree
```

El lector genera:

```text id="a9fg4u"
render tree
```

dependiendo del nivel seleccionado.

---

# 11. Algoritmo de filtrado

## Regla de inclusión

Un nodo debe renderizarse si:

### Caso A

El nodo tiene:

```text id="i1n4s9"
data-read-level >= selected_level
```

---

### Caso B

El nodo contiene descendientes válidos.

Esto permite rescatar hijos importantes.

---

# 12. Ejemplo complejo

## HTML original

```html id="cn93c5"
<div data-read-level="2">

    Texto secundario

    <div data-read-level="4">

        Texto importante

        <div data-read-level="5">
            Idea esencial
        </div>

    </div>

</div>
```

---

## Nivel seleccionado = 5

## Resultado renderizado

```html id="sx54m5"
<div data-read-level="5">
    Idea esencial
</div>
```

Todo ancestro irrelevante desaparece.

---

# 13. Regla de preservación estructural

## Problema

Eliminar padres puede romper:

* layout,
* listas,
* tablas,
* semántica HTML.

---

## Solución

El sistema debe:

### conservar wrappers estructurales mínimos

cuando:

* contienen hijos válidos,
* son necesarios para mantener HTML correcto.

---

# 14. Nodos estructurales

## Ejemplos

Deben preservarse cuando contienen hijos visibles:

* section
* article
* ul
* ol
* li
* table
* tbody
* tr
* blockquote
* details

---

# 15. Nodos descartables

Pueden omitirse completamente:

* div vacíos
* spans vacíos
* wrappers sin atributos importantes

---

# 16. Pipeline de renderizado

## Flujo completo

### Paso 1

Descifrar HTML.

---

### Paso 2

Parsear mediante:

```text id="vhp0n9"
DOMParser
```

---

### Paso 3

Construir árbol lógico.

---

### Paso 4

Aplicar filtrado recursivo.

---

### Paso 5

Generar nuevo DOM limpio.

---

### Paso 6

Insertar en reader container.

---

# 17. Persistencia

## Regla

El nivel:

* existe sólo mientras el libro está abierto.

---

## Reset

Al cerrar libro:

* vuelve automáticamente a nivel 0.

---

# 18. UI

## Selector principal

Dropdown simple.

---

## Opciones dinámicas

Los niveles disponibles se detectan automáticamente desde el HTML.

Ejemplo:

```text id="khnm6q"
Nivel 0
Nivel 1
Nivel 2
Nivel 5
```

No se asume secuencia continua.

---

# 19. Nivel máximo

El sistema:

* no impone límite fijo,
* acepta cualquier entero positivo.

---

# 20. Descubrimiento automático

Durante parseo:

```text id="x5vgkq"
querySelectorAll('[data-read-level]')
```

Recolecta:

* niveles existentes,
* ordenados ascendentemente.

---

# 21. Estilo visual

## Objetivo

Mostrar discretamente:

* profundidad,
* importancia,
* estructura editorial.

---

# 22. Indicador lateral

Cada bloque con nivel visible puede mostrar:

```text id="yl4db7"
border-left
```

---

## Ejemplo conceptual

| Nivel | Intensidad |
| ----- | ---------- |
| 1     | gris suave |
| 2     | azul       |
| 3     | verde      |
| 4     | naranja    |
| 5     | rojo       |

---

# 23. Configuración visual

## Toggle

Usuario puede desactivar:

```text id="cg3aeh"
Mostrar indicadores de nivel
```

---

## Comportamiento

Desactivar:

* elimina bordes,
* no afecta filtrado.

---

# 24. Búsqueda

## Regla

La búsqueda:

* indexa TODO el contenido descifrado,
* incluso niveles ocultos.

---

## Resultado

Una coincidencia:

* puede existir en un nivel oculto.

---

## Comportamiento esperado

El sistema:

* navega hacia coincidencia,
* opcionalmente cambia temporalmente nivel.

---

# 25. Compatibilidad HTML

## Soporte

`data-read-level` puede existir en:

* cualquier elemento block-level,
* cualquier contenedor HTML válido.

---

# 26. Restricciones editoriales

## Recomendación

Evitar:

* niveles extremadamente fragmentados,
* wrapping excesivo,
* nesting innecesariamente profundo.

---

## Filosofía ideal

Cada nivel debería representar:

* una condensación real,
* no simple decoración visual.

---

# 27. Casos edge

## Caso A — nivel inexistente

Si usuario selecciona:

```text id="pqmc57"
nivel 7
```

pero sólo existen:

```text id="fgs1kt"
0,2,5
```

El selector nunca debe ofrecer 7.

---

## Caso B — documento vacío

Si ningún nodo coincide:

* mostrar estado vacío discreto.

---

## Caso C — HTML inválido

El parser debe:

* tolerar nesting imperfecto,
* evitar crash.

---

# 28. Performance

No es prioridad.

El sistema puede:

* reconstruir DOM completo en cada cambio de nivel.

Esto simplifica muchísimo la implementación.

---

# 29. Integración con reader.js

## Nuevos módulos sugeridos

| Archivo       | Función              |
| ------------- | -------------------- |
| levels.js     | lógica de niveles    |
| renderTree.js | reconstrucción DOM   |
| levelUI.js    | dropdown y controles |

---

# 30. API interna sugerida

## Obtener niveles

```js id="cpt5r4"
extractReadLevels(document)
```

---

## Renderizar nivel

```js id="s0ubor"
renderReadLevel(document, level)
```

---

## Filtrar nodo

```js id="o0xlf6"
filterNode(node, level)
```

---

# 31. Estrategia de render

## Recomendación

NO modificar el DOM original.

Siempre:

* conservar source tree intacto,
* regenerar render tree.

Esto evita:

* estados inconsistentes,
* acumulación de estilos,
* problemas de nesting.

---

# 32. Compatibilidad futura

La arquitectura queda preparada para:

* exportación resumida,
* analytics,
* heatmaps de importancia,
* estadísticas de densidad,
* navegación por niveles.

Sin requerir cambios estructurales.

---

# 33. Filosofía final del feature

Read Levels transforma un libro lineal en un sistema de relectura jerárquica.

El objetivo no es resumir automáticamente, sino permitir que el lector:

* marque manualmente conocimiento esencial,
* construya capas progresivas de importancia,
* y acceda rápidamente a distintos niveles de profundidad intelectual.
