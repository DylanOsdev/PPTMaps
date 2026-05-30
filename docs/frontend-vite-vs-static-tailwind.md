# Estrategia de Frontend: Vite vs FastAPI Static + Tailwind CSS

> Documento de decisión técnica para el equipo MoviMed (PPTMaps).
> Estado: **PROPUESTA** — pendiente de discусión y aprobación del equipo.
> Contexto: el equipo quiere incorporar Tailwind CSS al frontend.

---

## 1. Resumen ejecutivo

Hoy el frontend tiene **dos mecanismos compitiendo** para servir los mismos
archivos (Vite y FastAPI StaticFiles), y nadie decidió cuál es el oficial. Ese
solapamiento ya está causando inconsistencias. Encima, el equipo quiere sumar
Tailwind, lo que reabre la pregunta de fondo: **¿cómo servimos y cómo
construimos el frontend?**

Este documento separa dos problemas que suelen confundirse:

1. **Cómo SERVIMOS los archivos** → Vite dev-server vs FastAPI StaticFiles.
2. **Cómo GENERAMOS el CSS de Tailwind** → CDN vs CLI standalone vs plugin de Vite.

La tesis del documento: **son decisiones independientes**. Se puede usar Tailwind
sin Vite. Confundirlas lleva a meter Vite "porque Tailwind lo necesita", lo cual
es falso.

**Recomendación**: servir con **FastAPI StaticFiles** + generar el CSS con el
**CLI standalone de Tailwind v4** (binario, sin Node). Justificación abajo.

---

## 2. Punto de partida: qué hay hoy en el repo

Estado actual del frontend (rama `main`):

- Frontend en **JavaScript vanilla con ES Modules**. No hay React, Vue, Svelte,
  ni JSX. Es HTML + CSS + JS plano (`import { CONFIG } from "..."`).
- Existe `frontend/vite.config.js` con un dev-server en el puerto `5173` que
  proxea `/api`, `/health` y `/ws` hacia el backend en `:8000`.
- Existe en `backend/app/main.py` un montaje estático:
  ```python
  app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
  ```
  Es decir, el backend en `:8000` **también** sirve el frontend.
- La config de URLs (`constants.js`) usa rutas **relativas**:
  `apiBase = "/api/v1"`, `backendUrl = ""`. Esto está bien: funciona tanto por
  Vite (proxy) como por FastAPI (mismo origen).

### Problemas concretos detectados

| # | Problema | Severidad |
|---|----------|-----------|
| 1 | Doble serving: Vite (`:5173`) y FastAPI StaticFiles (`:8000`) sirven el mismo frontend. Nadie definió el oficial. | 🔴 Alta |
| 2 | El proxy `/ws` de Vite apunta a un endpoint que **ya no existe** (el WebSocket router se eliminó en la limpieza de backend). | 🔴 Alta |
| 3 | `api.js` llama a `/telemetry/latest`, dominio **eliminado** del backend → 404. El frontend quedó desincronizado. | 🟡 Media |
| 4 | `apiBase` / `backendUrl` relativos. | ✅ Correcto |

El problema #1 es la raíz: mientras existan los dos caminos, cualquier cambio
puede aplicarse a uno y no al otro, y nadie sabe cuál es "la verdad".

---

## 3. El problema de fondo: SERVIR no es lo mismo que CONSTRUIR

Antes de comparar, hay que entender por qué Vite existe. Vite es dos cosas:

1. **Un bundler / transpilador**: toma código moderno (JSX, TS, imports de
   frameworks, etc.) y produce JS optimizado que el navegador entiende.
2. **Un dev-server con HMR** (Hot Module Replacement): recarga en caliente.

**Punto clave**: nuestro frontend es vanilla. No transpilamos NADA. El navegador
ejecuta nuestros ES Modules tal cual. Por lo tanto, de las dos funciones de Vite,
solo estaríamos usando la #2 (dev-server con proxy), y muy parcialmente.

Es traer una grúa de obra para colgar un cuadro.

---

## 4. Opción A — Servir con Vite

### Cómo funciona
- `npm install` (requiere **Node.js + npm**).
- `npm run dev` levanta el dev-server en `:5173` con HMR y proxy al backend.
- Para producción: `npm run build` genera una carpeta `dist/` que después hay
  que servir con algo (FastAPI, Nginx, etc.).

### Ventajas
- HMR real (recarga instantánea sin perder estado).
- Si algún día migramos a React/Vue/Svelte, Vite ya está listo.
- Ecosistema de plugins enorme.
- Si Tailwind entra por el plugin de Vite, queda integrado en el pipeline.

### Desventajas (en NUESTRO contexto)
- **Requiere Node.js + npm instalados** en cada máquina. Contradice la regla del
  proyecto: "tiene que correr en cualquier PC".
- **Dos procesos en dev**: `uvicorn` (backend) + `npm run dev` (frontend). Más
  cosas que arrancar, más cosas que fallan en una demo.
- **Paso de build para producción** (`dist/`): hay que acordarse de buildear; si
  no, se sirve código viejo. Clásico "en mi máquina funciona".
- El HMR aporta poco con HTML/CSS/JS plano: un F5 hace casi lo mismo.
- Sumamos `node_modules/` (cientos de MB) al entorno de desarrollo.

---

## 5. Opción B — Servir con FastAPI StaticFiles

### Cómo funciona
- El backend ya monta el frontend (`app.mount("/", StaticFiles(...))`).
- `uvicorn app.main:app` → backend **y** frontend en `:8000`. Un solo proceso.
- "Lo que ves es lo que se sirve": no hay carpeta `dist/` ni paso de build.

### Ventajas (en NUESTRO contexto)
- **Un solo proceso, un solo comando, un solo puerto.** Simplicidad operativa.
- **Sin Node.js para servir.** Cumple "corre en cualquier PC".
- Mismo origen → sin problemas de CORS entre frontend y API.
- Menos piezas móviles = menos superficie de fallo en la demo del hackatón.

### Desventajas
- Sin HMR: hay que refrescar el navegador a mano (costo bajo con vanilla).
- FastAPI/StaticFiles no es un servidor de archivos de alto rendimiento para
  producción a gran escala (irrelevante para el alcance Valle de Aburrá / demo;
  si algún día escala, se pone Nginx delante).

---

## 6. Comparativa directa

| Criterio | Vite | FastAPI Static |
|----------|------|----------------|
| Procesos en dev | 2 (uvicorn + vite) | 1 (uvicorn) |
| Requiere Node.js para servir | Sí | **No** |
| Paso de build para prod | Sí (`dist/`) | No |
| HMR | Sí | No (F5) |
| Listo para framework futuro | Sí | No |
| Complejidad operativa | Alta | **Baja** |
| Encaja con "corre en cualquier PC" | No | **Sí** |
| Riesgo en demo | Mayor | **Menor** |

---

## 7. Dónde entra Tailwind (y el malentendido común)

**El error frecuente**: "vamos a usar Tailwind, entonces necesitamos Vite."
**Es falso.** Generar el CSS de Tailwind y servir los archivos son problemas
distintos e independientes.

Aclaración importante: Tailwind **no es como un CSS normal** que enlazás con un
`<link>` y listo. Tailwind **necesita un paso de generación**: escanea tu
HTML/JS, detecta qué clases usás (`flex`, `p-4`, `bg-blue-500`...) y **genera**
solo ese CSS. Sin ese paso, o no tenés estilos, o cargás el framework entero.

Tailwind v4 ofrece **tres formas** de hacer esa generación, y solo una necesita
Vite:

| Forma | ¿Build? | ¿Node? | ¿Apto producción? | Cuándo usarla |
|-------|---------|--------|-------------------|---------------|
| **Play CDN** (`<script src=…tailwindcss>`) | No | No | ❌ No (sin purga, pesado, FOUC) | Prototipar rápido / demo |
| **CLI standalone** (binario único) | Sí (real) | **No** | ✅ Sí | ⭐ Recomendado |
| **Plugin de Vite** | Sí (full) | Sí | ✅ Sí | Solo si ya usás Vite/framework |

### 7.1. Play CDN
Un `<script>` en el `<head>` y empezás a usar clases en 30 segundos. Cero
instalación. **Pero**: no purga clases sin usar (CSS gigante), puede haber FOUC
(flash de contenido sin estilo) y el equipo Tailwind dice explícitamente que **no
es para producción**. Útil para iterar visualmente durante el hackatón.

### 7.2. CLI standalone (la opción recomendada)
Desde v4, Tailwind publica un **ejecutable independiente** (un binario por SO)
que da el poder completo del CLI **sin Node ni npm**. Datos verificados de la
documentación oficial y discusiones del repo de Tailwind:

- Se descarga el binario desde los releases de GitHub de Tailwind. Para Linux x64
  es `tailwindcss-linux-x64` (y `tailwindcss-linux-x64-musl` para Alpine/musl).
- En v4 **ya no existe** el comando `init` ni hace falta `tailwind.config.js`
  para un setup simple. La config es **CSS-first**.
- Archivo de entrada mínimo (p. ej. `input.css`) con una sola línea:
  ```css
  @import "tailwindcss";
  ```
- Si las fuentes (HTML/JS) están en otra carpeta que el CSS, se indica con
  `@source` o con el flag `--cwd`.
- Se genera el CSS con:
  ```bash
  ./tailwindcss -i input.css -o output.css --watch
  ```
- **Gotcha verificado**: Tailwind **ignora por defecto los archivos que están en
  `.gitignore`** al detectar clases. Si tus fuentes están gitignoreadas, hay que
  registrarlas explícitamente con `@source "..."` en el `input.css`.
- Para plugins (v4): se cargan con `@plugin "nombre";` en el `input.css`, NO en
  un config JS.

El `output.css` resultante es un archivo CSS común y corriente, que **FastAPI
StaticFiles sirve igual que cualquier otro**. Es decir: el CLI standalone genera
el CSS, y el serving sigue siendo un solo proceso. Las dos decisiones quedan
desacopladas.

### 7.3. Plugin de Vite
Integra Tailwind en el pipeline de Vite. Tiene sentido **solo si ya decidimos
usar Vite** (y por lo tanto Node). Para nuestro caso, reintroduce justamente la
dependencia que queremos evitar.

---

## 8. Recomendación

**Servir: FastAPI StaticFiles. Generar Tailwind: CLI standalone v4.**

Razones, en orden de peso:

1. **"Corre en cualquier PC"**: ni el serving ni Tailwind requieren Node. El CLI
   standalone es un binario; FastAPI ya sirve los estáticos.
2. **Simplicidad operativa**: un proceso para servir (`uvicorn`) y, opcionalmente,
   un `--watch` del binario de Tailwind mientras se desarrolla CSS.
3. **Sin sorpresas en producción**: no hay `dist/` que olvidarse de buildear; el
   `output.css` se commitea o se genera en el arranque.
4. **Apto para el alcance real**: hackatón + Valle de Aburrá, no necesitamos el
   pipeline de un SPA con framework.

### Camino sugerido por fase
- **Iterar rápido durante el hackatón**: Tailwind por **Play CDN** (cero setup).
  Aceptamos que no es prod-quality.
- **Para entregar / dejar prolijo**: pasar al **CLI standalone**, generar
  `output.css` purgado, servirlo por FastAPI.
- **Reconsiderar Vite SOLO si**: el equipo decide migrar el frontend a un
  framework (React/Vue/Svelte). Ahí la grúa se justifica.

---

## 9. Trabajo de limpieza derivado (independiente de Tailwind)

Decidamos lo que decidamos sobre Tailwind, hay que resolver el solapamiento
actual:

1. **Elegir UN mecanismo de serving.** Si es FastAPI static: eliminar
   `vite.config.js`, `package.json`, `package-lock.json` del `frontend/` y la
   regla `node_modules/` del `.gitignore`. (Si fuese Vite: quitar el
   `app.mount(...)` del backend.)
2. **Arreglar el proxy/llamadas muertas**: sacar la config `/ws` (endpoint
   eliminado) y la llamada `/telemetry/latest` de `api.js` (dominio eliminado).
3. **Verificar** que `uvicorn` sirva el `index.html` y que las llamadas
   relativas `/api/v1/...` respondan.

---

## 10. Decisión del equipo

> _Completar tras la discusión:_
>
> - **Serving elegido**: ☐ FastAPI Static ☐ Vite
> - **Tailwind**: ☐ Play CDN (corto plazo) ☐ CLI standalone ☐ Plugin Vite
> - **Responsable de la limpieza (sección 9)**:
> - **Fecha**:

---

### Referencias
- Tailwind CSS v4 — Standalone CLI (sin Node.js): documentación oficial y
  release notes de Tailwind v4.
- Releases de binarios: repositorio oficial `tailwindlabs/tailwindcss` en GitHub.
- Guía comunitaria del setup standalone v4 (config CSS-first, `@source`,
  `@plugin`, gotcha de `.gitignore`).
