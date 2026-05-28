# RREADS — Planificación Técnica Integral

## 1. Objetivo del proyecto

RREADS es una biblioteca estática alojada en GitHub Pages para lectura privada de libros HTML cifrados.

El proyecto prioriza:

* simplicidad,
* funcionamiento completamente estático,
* compatibilidad offline básica,
* privacidad casual,
* mínimo número de archivos,
* frontend liviano en Vanilla JS.

No busca seguridad criptográfica fuerte ni resistencia ante análisis técnico avanzado.

---

# 2. Arquitectura general

## Principios

* Sin backend.
* SPA (Single Page Application).
* Descifrado completamente en navegador.
* Libros almacenados cifrados.
* Metadatos ocultos tras contraseña.
* Todo el contenido privado via XOR.
* Catálogo autogenerado desde metadatos HTML.
* Reencriptación completa al cambiar contraseña.

---

# 3. Flujo de funcionamiento

## Build local

### Flujo del desarrollador

1. Agregar HTMLs a `/src`
2. Ejecutar `main.py`
3. El script:

   * parsea metadatos,
   * genera UUIDs,
   * cifra contenido,
   * genera índice mínimo,
   * genera portadas automáticas faltantes,
   * actualiza archivos en `/enc`
4. Commit y push
5. GitHub Pages publica automáticamente

---

## Flujo del usuario

### Inicio

1. Usuario abre sitio.
2. Se solicita contraseña.
3. Frontend:

   * calcula SHA256,
   * compara con `hash.txt`.
4. Si coincide:

   * usa texto de contraseña como clave XOR,
   * descifra índice,
   * carga catálogo,
   * renderiza biblioteca.

---

## Lectura

1. Usuario abre libro.
2. Frontend descarga `.enc`
3. Descifra:

   * metadata,
   * contenido HTML.
4. Renderiza inline en el SPA.

---

# 4. Estructura del repositorio

```text
/
├── index.html
├── hash.txt
├── index.enc
│
├── enc/
│   ├── uuid1.enc
│   ├── uuid2.enc
│   └── ...
│
├── assets/
│   ├── covers/
│   ├── fonts/
│   └── icons/
│
├── themes/
│   ├── default.css
│   ├── dark.css
│   └── sepia.css
│
├── js/
│   ├── app.js
│   ├── crypto.js
│   ├── reader.js
│   ├── catalog.js
│   └── ui.js
│
├── css/
│   └── main.css
│
├── scripts/
│   ├── main.py
│   └── password.py
│
└── src/
    └── *.html
```

`src/` debe permanecer ignorado en git.

---

# 5. Formato de metadatos HTML

Cada libro HTML debe contener `<meta>`.

## Formato obligatorio

```html
<meta name="title" content="Dune">
<meta name="author" content="Frank Herbert">
<meta name="year" content="1965">
<meta name="genre" content="Science Fiction">
<meta name="tags" content="scifi,politica">
<meta name="pages" content="540">
<meta name="description" content="Novela de ciencia ficción">
<meta name="cover" content="assets/covers/dune.jpg">
```

---

## Metadatos soportados

| Campo       | Obligatorio | Descripción             |
| ----------- | ----------- | ----------------------- |
| title       | sí          | Título                  |
| author      | sí          | Autor                   |
| year        | no          | Año                     |
| genre       | no          | Género                  |
| tags        | no          | Tags separados por coma |
| pages       | no          | Número de páginas       |
| description | no          | Descripción             |
| cover       | no          | Ruta portada            |

---

# 6. Sistema de cifrado

## Objetivo

Ofuscación casual.

No pretende resistir:

* ingeniería inversa,
* análisis criptográfico,
* extracción de memoria,
* inspección de JS.

---

## Método

### XOR byte a byte

La contraseña:

* se usa directamente como clave XOR,
* repetida cíclicamente.

---

## Hash de autenticación

Archivo:

```text
/hash.txt
```

Contenido:

```text
SHA256(password)
```

Sin salt.

---

# 7. Formato de archivos `.enc`

Cada libro:

```text
enc/<uuid>.enc
```

Formato binario:

```text
[MAGIC]
[VERSION]
[METADATA_LENGTH]
[METADATA_XOR]
[HTML_XOR]
```

---

## Header

### MAGIC

Identificador fijo:

```text
RREADS
```

---

### VERSION

1 byte.

Permite compatibilidad futura.

---

### METADATA_LENGTH

4 bytes.

Longitud del bloque metadata.

---

## METADATA_XOR

JSON cifrado.

Ejemplo descifrado:

```json
{
  "uuid": "...",
  "title": "Dune",
  "author": "Frank Herbert",
  "year": 1965,
  "genre": "Science Fiction",
  "tags": ["scifi","politica"],
  "pages": 540,
  "description": "...",
  "cover": "assets/covers/dune.jpg"
}
```

---

## HTML_XOR

HTML completo cifrado.

Incluye:

* contenido,
* notas privadas,
* marcas,
* estructura visual.

---

# 8. Índice oculto

## Objetivo

Ocultar metadatos sin contraseña.

---

## Archivo

```text
/index.enc
```

---

## Contenido descifrado

```json
[
  "uuid1",
  "uuid2",
  "uuid3"
]
```

No contiene metadata visible.

---

## Construcción del catálogo

El frontend:

1. Descifra `index.enc`
2. Obtiene UUIDs
3. Descarga headers de cada libro
4. Descifra SOLO metadata
5. Construye catálogo visual

No necesita descifrar libros completos para la galería.

---

# 9. Generación de UUID

Cada libro posee UUID persistente.

## Reglas

* generado solo una vez,
* almacenado en metadata interna del build,
* nunca reutilizado.

Formato:

```text
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

# 10. Script `main.py`

## Responsabilidades

### Parseo

* leer HTMLs,
* extraer `<meta>`.

---

### Validación

Verificar:

* title,
* author,
* HTML válido básico.

---

### UUID

* reutilizar existente,
* generar nuevo si falta.

---

### Portadas

Si no existe `cover`:

Generar SVG automático:

* color estable derivado del título,
* título centrado,
* autor debajo.

Guardar en:

```text
/assets/covers/generated/
```

---

### Cifrado

Generar:

* archivos `.enc`,
* `index.enc`.

---

### Limpieza

Eliminar:

* archivos huérfanos,
* covers no usadas opcionalmente.

---

# 11. Script `password.py`

## Objetivo

Cambiar contraseña global.

---

## Flujo

1. Solicitar contraseña antigua.
2. Verificar hash.
3. Descifrar todos los libros.
4. Solicitar nueva contraseña.
5. Reencriptar:

   * libros,
   * índice.
6. Regenerar:

   * `hash.txt`

---

# 12. Frontend SPA

## Arquitectura

Vanilla JS modular.

---

## Módulos

| Archivo    | Función           |
| ---------- | ----------------- |
| app.js     | bootstrap         |
| crypto.js  | XOR + SHA256      |
| catalog.js | galería           |
| reader.js  | lector            |
| ui.js      | overlays, modales |

---

# 13. Diseño UI

## Estilo

Minimal moderno.

---

## Layout

### Biblioteca

Grid responsive.

Cada tarjeta:

* portada,
* título,
* autor,
* año opcional.

---

### Barra superior

Contiene:

* búsqueda,
* ordenamiento,
* selector tema,
* logout.

---

# 14. Búsqueda

## Tipo

Búsqueda simple local.

---

## Campos indexados

* título,
* autor,
* tags,
* género.

---

## Características

* instantánea,
* sin fuzzy search,
* sin full-text.

---

# 15. Ordenamiento

Opciones:

* título,
* autor,
* año,
* fecha añadida.

---

# 16. Lector

## Tipo

Scroll continuo inline.

---

## Renderizado

El HTML descifrado:

* se inserta en contenedor aislado.

---

## Configuración visual

Usuario puede cambiar:

* tamaño fuente,
* ancho lectura,
* interlineado,
* tema.

No se guarda entre sesiones.

---

# 17. Temas

## Carpeta

```text
/themes/
```

---

## Temas iniciales

* default
* dark
* sepia

---

## Carga

Dinámica mediante `<link>`.

---

# 18. Animaciones

## Reglas

* mínimas,
* desactivables.

---

## Permitidas

* fade overlays,
* hover suave,
* transición tema.

---

# 19. Compatibilidad offline

## Objetivo

Funcionar luego de carga inicial.

---

## Estrategia

Sin service worker complejo.

Solo:

* archivos estáticos cacheables,
* arquitectura completamente local.

---

# 20. Seguridad esperada

## Protege contra

* acceso casual,
* lectura accidental,
* scraping trivial.

---

## No protege contra

* inspección JS,
* extracción de clave,
* análisis de tráfico,
* modificación local,
* ingeniería inversa.

---

# 21. Consideraciones de privacidad

## Todo contenido privado debe permanecer:

* dentro del HTML,
* cifrado.

Nunca:

* exponer metadata pública,
* usar catálogo JSON visible,
* incluir notas fuera del cifrado.

---

# 22. Rendimiento

No prioritario.

Optimizar solo:

* evitar descifrar libros completos para catálogo.

---

# 23. GitHub Pages

## Deploy

Automático desde:

* `main`.

---

## Requisitos

Todo debe funcionar:

* sin backend,
* sin build server,
* sin dependencias runtime.

---

# 24. Filosofía técnica

RREADS prioriza:

* simplicidad,
* portabilidad,
* autonomía,
* legibilidad del código,
* pocos archivos,
* mínimo tooling.

Evitar:

* frameworks,
* pipelines complejos,
* dependencias innecesarias,
* abstracciones excesivas.

---

# 25. Roadmap sugerido

## Fase 1

Base funcional:

* login,
* XOR,
* galería,
* lector.

---

## Fase 2

Mejoras UX:

* temas,
* búsqueda,
* ordenamiento,
* responsive.

---

## Fase 3

Pulido:

* animaciones,
* SVG covers,
* refinamiento visual.

---

# 26. Decisiones finales consolidadas

| Área               | Decisión          |
| ------------------ | ----------------- |
| Frontend           | Vanilla JS        |
| Backend            | ninguno           |
| Hosting            | GitHub Pages      |
| Cifrado            | XOR               |
| Hash               | SHA256 simple     |
| Sesión persistente | no                |
| Offline            | básico            |
| Viewer             | inline SPA        |
| Catálogo           | oculto            |
| Metadatos          | `<meta>`          |
| Índice             | UUID-only         |
| Portadas           | auto SVG fallback |
| Temas              | CSS dinámicos     |
| Notas privadas     | dentro HTML       |
| Build              | Python scripts    |
| Seguridad          | casual            |
| Persistencia UI    | ninguna           |
