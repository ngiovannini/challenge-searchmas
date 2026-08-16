# Plan de Implementación — Challenge SearchMas

Ver contexto técnico y convenciones en [`CLAUDE.md`](./CLAUDE.md).
Ver contrato de cada endpoint en `/specs/` (`01-sync-data.md`, `02-query-data.md`, `03-export-csv.md`).

Orden de ejecución: Setup → Sync → Query → Export → Tests → Docs.
Cada bloque depende del anterior.

## Bloque 0 — Setup del proyecto

- [x] T0.1 Inicializar proyecto (`npm init`, TypeScript, `tsconfig.json`)
- [ ] T0.2 Configurar `docker-compose.yml` con PostgreSQL
- [ ] T0.3 Inicializar Prisma, definir modelo `Post`, primera migración
- [ ] T0.4 Configurar `serverless.yml` base + `serverless-offline`

## Bloque 1 — Sincronización (sync)

- [ ] T1.1 `JsonPlaceholderClient`: cliente HTTP para traer los posts
- [ ] T1.2 `PostRepository`: acceso a datos con Prisma (upsert por `externalId`)
- [ ] T1.3 `SqsPublisher` (simulado): encola el trabajo de sync
- [ ] T1.4 `SyncDataUseCase`: orquesta el flujo (trigger → publica a la cola)
- [ ] T1.5 `syncDataHandler.ts`: handler HTTP, responde `202 Accepted`
- [ ] T1.6 `syncDataConsumerHandler.ts`: consume el mensaje, trae y guarda los datos

## Bloque 2 — Consulta (query)

- [ ] T2.1 `GetDataUseCase`: paginación + filtros combinables (`userId`, `search`)
- [ ] T2.2 `getDataHandler.ts`: parsea query params, devuelve JSON + metadata

## Bloque 3 — Exportación CSV

- [ ] T3.1 `ExportCsvUseCase`: reutiliza el `where` de T2.1 (sin paginar), convierte a CSV
- [ ] T3.2 `exportCsvHandler.ts`: devuelve el archivo como descarga

## Bloque 4 — Tests

- [ ] T4.1 Tests de `SyncDataUseCase` (mock de cliente HTTP y repositorio)
- [ ] T4.2 Tests de `GetDataUseCase` (mock de repositorio)
- [ ] T4.3 Tests de `ExportCsvUseCase`

## Bloque 5 — Documentación y cierre

- [ ] T5.1 `README.md` con instrucciones de instalación/ejecución
- [ ] T5.2 `AI_WORKFLOW.md` — alimentar de forma incremental mientras se resuelven los bloques anteriores, no al final
