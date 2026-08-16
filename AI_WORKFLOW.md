# AI_WORKFLOW.md

Registro incremental del proceso de desarrollo asistido por IA en este proyecto.
Ver convenciones en [`CLAUDE.md`](./CLAUDE.md) y plan en [`PLAN.md`](./PLAN.md).

## Bloque 0 — Setup del proyecto

### T0.1 — Inicializar proyecto (npm init, TypeScript, tsconfig.json)

Se pidió inicializar el proyecto con `npm init`, instalar TypeScript y configurar
`tsconfig.json` para Node 20 / Lambda (target ES2022, module commonjs, strict).

- **Ajuste**: `npm install typescript` sin versión fijada instaló la serie `7.0.x`
  — la nueva versión GA del compilador, reescrito en Go (lanzada en julio 2026).
  Aunque es una versión estable y oficial, TypeScript 7.0 convierte varias
  deprecaciones de la 6.0 en errores duros y cambia valores por defecto, lo que
  generó un error de compilación con la configuración pensada originalmente para
  la serie 5.x. Evalué que, para un proyecto pensado para correr en AWS Lambda,
  priorizar estabilidad y soporte documentado sobre la versión más nueva era el
  criterio correcto, y fijé la versión a `5.9.3` — la última release estable de
  la serie más probada en este momento.
- Se creó la estructura de carpetas por capas (`src/domain`, `src/application`,
  `src/infrastructure`, `src/handlers`) según la arquitectura definida en CLAUDE.md,
  con `.gitkeep` porque aún no hay código (llega en Bloque 1+).
- Se validó la config compilando un archivo de prueba temporal: `strict` rechaza
  accesos inseguros a `undefined`, y la salida compilada usa `commonjs`
  (`exports`/`require`), compatible con el runtime de Lambda.

### T0.2 — Configurar docker-compose.yml con PostgreSQL (puerto y credenciales configurables)

Se pidió un `docker-compose.yml` con PostgreSQL (imagen `postgres:16`),
variables de entorno para credenciales, puerto expuesto y volumen persistente,
más un `.env.example` con `DATABASE_URL` de plantilla para Prisma.
Explícitamente fuera de alcance: instalar Prisma (queda para T0.3).

- Se creó `docker-compose.yml` con el servicio `db` y un volumen nombrado
  (`db_data`) montado en `/var/lib/postgresql/data` para persistencia entre
  reinicios. `.env` ya estaba en `.gitignore` desde T0.1.
- **Ajuste 1 — puerto fijo**: el puerto `5432` por defecto está ocupado por
  otro proyecto en mi máquina de desarrollo. Se parametrizó en
  `docker-compose.yml` (`"${DB_PORT:-5432}:5432"`) con `5432` como default,
  para que cualquiera que clone el repo pueda ajustarlo a su entorno sin
  tocar el archivo versionado.
- **Ajuste 2 — credenciales hardcodeadas**: la primera versión dejó
  `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` con valores fijos
  directamente en `docker-compose.yml`. Es inconsistente con el criterio ya
  aplicado al puerto (portabilidad entre entornos) y mala práctica aunque
  sean credenciales de desarrollo. Se movieron las tres a variables de
  entorno sin valor por defecto en el compose — si `.env` no las define, el
  servicio no arranca con credenciales adivinadas en silencio.
- `.env.example` documenta las 5 variables (`DB_PORT`, `POSTGRES_USER`,
  `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`) sin comentarios
  extensos — placeholders autoexplicativos.
