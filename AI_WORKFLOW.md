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
- **Ajuste 3 — Postgres ignoró el cambio de credenciales**: al actualizar `.env` con nuevas credenciales (`root`/`root`/`searchmas-challenge`), Postgres las ignoró — `initdb` solo aplica usuario/password/db la primera vez que corre, con el volumen vacío; en reinicios posteriores, el volumen ya inicializado conserva las credenciales originales. Fix: `docker compose down -v` (sin pérdida real, todavía no había migraciones corridas) y `up -d` de nuevo para que `initdb` corriera desde cero con las credenciales correctas.

### T0.3 — Inicializar Prisma y definir el modelo `Post`

Se pidió `prisma init`, definir el modelo `Post` (con `externalId` único para upsert), correr la primera migración y generar el cliente. Explícitamente fuera de alcance: `PostRepository` y casos de uso (T1.2+).

`npm install prisma` sin fijar versión trajo la `7.9.1` — un salto mayor respecto a las versiones de Prisma más documentadas/conocidas, con cambios de comportamiento relevantes para las convenciones ya definidas en CLAUDE.md:

- **Ajuste 1 — bloat no solicitado**: `prisma init` instaló automáticamente carpetas de "skills" para integraciones de IA (`.claude/skills/`,
  `.windsurf/skills/`, `.agents/skills/`, `skills-lock.json`) — documentación de referencia para editores, no código del proyecto. Se eliminaron por no haber sido pedidas y no aportar nada al challenge.
- **Ajuste 2 — generator y module format**: Prisma 7 cambia el generator por defecto a `prisma-client` (antes `prisma-client-js`), que ya no se instala en `node_modules` sino que requiere un `output` explícito, y por defecto
  genera módulos ESM. Se agregó `moduleFormat = "cjs"` en el generator para que coincida con la decisión ya tomada en T0.1 (`module: commonjs` en
  `tsconfig.json`) — sin este ajuste, el cliente generado no hubiera sido compatible con el resto del proyecto. Como parte
  del mismo salto de versión, el campo `url` del bloque `datasource` en `schema.prisma` quedó deprecado y ahora vive en `prisma.config.ts` (generado automáticamente por `prisma init`, requiere `dotenv` como devDependency); `DATABASE_URL` se sigue leyendo desde `.env`, sin cambios en esa parte del contrato.
- **Hallazgo relevante para T1.2**: Prisma 7 eliminó el motor de conexión
  integrado en `PrismaClient` — ahora requiere pasar un _driver adapter_
  explícito (`@prisma/adapter-pg` + `pg`) al constructor
  (`new PrismaClient({ adapter })`), si no, tira
  `PrismaClientInitializationError` al instanciar. Se instaló
  `@prisma/adapter-pg` para poder validar el setup end-to-end. Esto es un
  cambio de arquitectura respecto a cómo se instanciaba `PrismaClient`
  tradicionalmente (sin argumentos) — falta tenerlo en cuenta cuando se
  implemente `PostRepository` en T1.2.
- Se validó todo el flujo con un script temporal (create → upsert por
  `externalId` → delete) contra la base real, confirmando que la migración,
  el modelo y el cliente generado funcionan correctamente; se borró después
  de verificar.
