# CLAUDE.md - Challenge SearchMas

## Rol del agente

Asistir en la implementación siguiendo estrictamente las specs y convenciones
definidas en este documento. Priorizar consistencia con las decisiones ya
tomadas antes que sugerir alternativas no solicitadas.

## Objetivo del proyecto

Microservicio en Node.js/TypeScript que sincroniza datos desde una API externa
(JSONPlaceholder), los persiste en PostgreSQL, y los expone vía endpoints con
paginación, filtros y exportación a CSV. Enfoque AWS Serverless.

## Stack

- **Lenguaje**: TypeScript
- **Runtime**: Node.js 20, sobre AWS Lambda (handlers nativos, sin framework HTTP)
- **DB**: PostgreSQL + Prisma
- **Infra**: Serverless Framework, simulado localmente con `serverless-offline`
- **Async**: SQS simulado (cola local) para desacoplar `sync-data` del procesamiento real
- **Testing**: Jest + ts-jest, con mocks para DB y cliente HTTP externo
- **CSV**: `json2csv` (o equivalente)

## Arquitectura: capas

- domain/ → entidades y tipos
- application/ → casos de uso (lógica de negocio pura, testeable sin AWS)
- infrastructure/ → DB (Prisma), cliente HTTP externo, cola (SQS)
- handlers/ → funciones Lambda, "finas": solo traducen event ↔ response

**Regla clave**: los handlers no contienen lógica de negocio. Solo parsean el
`event`, llaman al use case correspondiente, y formatean la respuesta. Toda la
lógica testeable vive en `application/`.

## Convenciones de código

- Clases y casos de uso: `PascalCase` (`SyncDataUseCase.ts`)
- Handlers: `camelCase` (`syncDataHandler.ts`)
- Un use case por acción de negocio — no god classes
- Preferir funciones puras y testeables en `application/`; efectos secundarios (DB, HTTP, cola) quedan aislados en `infrastructure/`
- Priorizar reutilización: si una misma lógica se repite (ej. el criterio de filtros compartido entre `/data` y `/export-csv`), extraerla en vez de duplicarla

### Manejo de errores

- Todos los handlers capturan excepciones con try/catch y devuelven un formato
  consistente: `{ statusCode, message, timestamp }`
- Nunca dejar que una excepción no controlada llegue a Lambda sin respuesta

## Specs

Antes de implementar un endpoint, revisar su spec en `/specs/`:

- `01-sync-data.md` — POST /api/sync-data (con flujo asincrónico)
- `02-query-data.md` — GET /api/data (paginación + filtros combinables)
- `03-export-csv.md` — GET /api/export-csv (reutiliza filtros de 02, incluye nota de interpretación sobre ambigüedad del enunciado)

Cada spec define request/response, flujo paso a paso, casos borde y qué queda
fuera de alcance. Implementar según lo definido ahí, no improvisar el contrato.

## Base de datos

- Modelo principal: `Post` (ver `01-sync-data.md` para el detalle de campos)
- Upsert por `externalId` para evitar duplicados en sync repetidos
- Migraciones con `npx prisma migrate dev`

## Desarrollo local

```bash
docker-compose up -d          # levanta PostgreSQL
npx prisma migrate dev        # crea tablas
npx serverless offline        # simula API Gateway + Lambdas
```

## Testing

- Testear los use cases (`application/`), mockeando repositorio y cliente HTTP
- No es necesario testear los handlers en sí (son finos, casi sin lógica) ni la infraestructura (Prisma, cliente HTTP) — foco en la lógica de negocio

## Sobre el uso de IA en este proyecto

Este proyecto documenta su proceso de desarrollo con IA en `AI_WORKFLOW.md`.
Al generar código, priorizar:

- Simplicidad sobre abstracciones innecesarias (el alcance es chico, no over-engineerizar)
- Consistencia con las specs y estas convenciones por sobre "mejores prácticas" genéricas que no apliquen al contexto
- Cuando sugieras algo que se aparte de una decisión ya tomada en una spec, señalarlo explícitamente en vez de aplicarlo silenciosamente
