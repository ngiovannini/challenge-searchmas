# AI_WORKFLOW.md

## Herramientas de IA y tareas

Se usó Claude Code (Claude Sonnet) durante todo el desarrollo, aplicando
Spec Driven Development: cada bloque de trabajo partió de una spec escrita
(`/specs/`) y un plan de tareas (`PLAN.md`) antes de generar código, con
`CLAUDE.md` como contexto persistente de convenciones del proyecto.

Se usó para:

- Setup del proyecto (TypeScript, Docker Compose, Prisma, Serverless Framework)
- Implementación de los 3 endpoints (sincronización, consulta paginada,
  exportación CSV) y sus capas de dominio/aplicación/infraestructura
- Generación de la suite de tests unitarios (Jest) de los tres casos de uso
  principales

## Ejemplo concreto de corrección

Al implementar el mecanismo que desacopla `POST /api/sync-data` del
procesamiento real (simulando SQS sin infraestructura real), la IA propuso
que el publisher invocara directamente al handler consumidor. Rechacé esa
sugerencia porque invertía la dirección de dependencias ya establecida en
el proyecto (los handlers llaman a application/infrastructure, nunca al
revés) — en su lugar, el publisher recibe el consumer inyectado.

Ese ajuste generó un problema nuevo: el consumer real es un método del
mismo caso de uso que se estaba construyendo, lo que producía una
referencia circular en el momento de instanciar las dependencias. La
primera solución de la IA para esto —una variable declarada con `let` y
asignada después, capturada por closure— funcionaba, pero dependía de un
detalle de timing interno (que la publicación fuera asíncrona) para no
fallar. Es un patrón frágil y difícil de justificar en una revisión de
código real, así que lo reemplacé por un método `subscribe()` explícito:
se crean las dependencias primero, y recién después se conectan, sin
depender de ningún orden de ejecución implícito. Con el cambio, además,
usar el publisher sin haber suscripto un consumer pasó a fallar con un
error explícito, en vez de fallar en silencio.

## CI (fuera del alcance original — agregado como mejora)

No estaba pedido en la consigna del challenge, se agregó como mejora
adicional: `.github/workflows/ci.yml`, disparado en cada `push` a `main` y
en cada `pull_request`.

Pasos: checkout → setup de Node (versión leída de `.nvmrc`, con cache de
npm) → `npm ci` → `npx prisma generate` → `npm run typecheck` → `npm run
build` → `npm test`. El orden importa: falla rápido en errores de tipos
antes de gastar tiempo en build y tests, y `prisma generate` corre antes
del build/typecheck porque el cliente generado es necesario para que
compile.

No corre contra una base de datos real (los tests son unitarios con mocks,
según lo definido en el Bloque 4) — no hace falta levantar Postgres en el
runner de CI para este alcance.

Corriendo en verde en `main` y en los PRs del proyecto.
