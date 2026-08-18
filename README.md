# Challenge SearchMas

Microservicio Node.js/TypeScript que sincroniza datos desde una API externa
(JSONPlaceholder), los persiste en PostgreSQL, y los expone vía endpoints
con paginación, filtros y exportación a CSV. Enfoque AWS Serverless.

## Stack

- **Lenguaje**: TypeScript
- **Runtime**: Node.js 20, sobre AWS Lambda (handlers nativos, sin framework HTTP)
- **DB**: PostgreSQL + Prisma
- **Infra**: Serverless Framework v3 + `serverless-offline`
- **Testing**: Jest + ts-jest

## Cómo correr el proyecto localmente

```bash
# 0. Usar la versión de Node del proyecto (ver .nvmrc)
nvm use

# 1. Levantar PostgreSQL
docker-compose up -d

# 2. Configurar variables de entorno
cp .env.example .env
# completar DATABASE_URL, POSTGRES_USER/PASSWORD/DB, DB_PORT según tu entorno
# JSONPLACEHOLDER_BASE_URL es opcional: si no se completa, usa
# https://jsonplaceholder.typicode.com por default

# 3. Instalar dependencias
npm install

# 4. Crear las tablas
npx prisma migrate dev

# 5. Compilar TypeScript
npm run build
```

**Sobre el paso 5**: `serverless-offline` no transpila TypeScript por sí
solo — el `handler` de cada función en `serverless.yml` apunta a
`dist/handlers/*.js`, no a `src/`. Hay que correr `npm run build` (o
dejarlo corriendo con `tsc --watch` en otra terminal) antes de levantar el
servidor, y de nuevo cada vez que cambies un handler o algo de lo que
depende.

```bash
# 6. Levantar el servidor local
npx serverless offline
```

El servidor queda escuchando en `http://localhost:3000`, con los endpoints
bajo el prefijo `/dev` (el stage por default). Este es el puerto de la API
(fijo, lo define `serverless-offline`) — no confundir con `DB_PORT` del
`.env`, que es el puerto de PostgreSQL y sí es configurable por entorno.

## Endpoints

### `POST /api/sync-data`

Dispara la sincronización (asincrónica) desde JSONPlaceholder. Responde de
inmediato con `202` y un `jobId`; el procesamiento real corre después, en
el mismo proceso.

```bash
curl -X POST http://localhost:3000/dev/api/sync-data
```

### `GET /api/data`

Lista los posts sincronizados, con paginación y filtros combinables
(`userId`, `search` sobre `title`, case-insensitive).

```bash
curl "http://localhost:3000/dev/api/data?page=1&limit=20&userId=1&search=qui"
```

### `GET /api/export-csv`

Exporta los posts a un archivo `.csv` descargable. Sin parámetros exporta
todo; acepta los mismos filtros opcionales que `/api/data` (`userId`,
`search`).

```bash
curl "http://localhost:3000/dev/api/export-csv?userId=1" -o posts-export.csv
```

## Tests

```bash
npm test
```

Tests unitarios (Jest) de los tres casos de uso principales
(`SyncDataUseCase`, `GetDataUseCase`, `ExportCsvUseCase`), con las
dependencias (cliente HTTP, repositorio, publisher) mockeadas — no
requieren una base de datos real corriendo.

## CI

Corre en GitHub Actions (`.github/workflows/ci.yml`) en cada `push` a
`main` y en cada Pull Request: `prisma generate` → `typecheck` → `build` →
`test`.

## Decisiones de arquitectura

- **Serverless Framework v3, no v4**: v4 requiere login/license key incluso
  para uso 100% local con `serverless-offline`, algo incompatible con un
  proyecto que nunca hace deploy real a AWS.
- **PostgreSQL + Prisma**: tipado end-to-end del modelo de datos, migraciones
  versionadas, y un cliente con buen soporte de TypeScript — encaja con el
  resto del stack sin agregar una capa de mapeo manual.
- **Sin framework HTTP** (Express, Fastify, etc.): los handlers son
  funciones Lambda nativas y finas (parsean el `event`, llaman al use case,
  formatean la respuesta); toda la lógica de negocio vive en `application/`,
  testeable sin necesidad de un servidor HTTP real.

Más detalle de convenciones y arquitectura en [`CLAUDE.md`](./CLAUDE.md), y
el contrato completo de cada endpoint en [`/specs/`](./specs/).

## Sobre el proceso de desarrollo con IA

Este proyecto se construyó con asistencia de IA. [`AI_WORKFLOW.md`](./AI_WORKFLOW.md)
documenta cómo se usó, y un ejemplo concreto de una sugerencia de la IA que
se corrigió durante el desarrollo.
