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

### T0.4 — Configurar serverless.yml base + serverless-offline

Se pidió instalar Serverless Framework y `serverless-offline` como
devDependencies, crear `serverless.yml` (provider AWS, runtime `nodejs20.x`,
región, plugin `serverless-offline`, variables de entorno referenciando
`.env`) y verificar que `npx serverless offline` levante sin errores, sin
definir todavía la sección `functions:` (llega en T1-T3).

- **Decisión de arquitectura — Serverless Framework v3 en vez de v4**: antes
  de instalar, se probó Serverless Framework v4 (versión `latest`, `4.41.0`)
  en un proyecto de scratch aislado para confirmar si `serverless offline`
  funciona sin cuenta. No fue así: v4 exige login o license key incluso para
  uso 100% local (`✖ Error: You must sign in or use a license key with
Serverless Framework V.4...`), algo incompatible con este proyecto —que
  nunca hace deploy real a AWS, todo el desarrollo es local con
  `serverless-offline`— y con un entorno no interactivo sin browser para
  completar el login. Se instaló en su lugar `serverless@3.40.0` —la última
  versión de la serie 3.x, totalmente open source y sin ese requisito— junto
  con `serverless-offline@13.10.1` (la última versión de la 13.x, compatible
  vía peerDependency con `serverless ^3.2.0`; la serie 14.x del plugin ya
  requiere `serverless ^4`). Ambas versiones se fijaron exactas
  (`--save-exact`, sin `^`) en vez de dejarlas abiertas a `latest`, dado que
  v3 está en modo mantenimiento y no conviene que un `npm install` futuro
  suba de mayor sin decisión explícita.
- `serverless.yml`: `service: challenge-searchmas`, `provider.name: aws`,
  `runtime: nodejs20.x`, `region: us-east-1`, plugin `serverless-offline`,
  `useDotenv: true` + `provider.environment.DATABASE_URL: ${env:DATABASE_URL}`
  para que las Lambdas reciban la misma `DATABASE_URL` que usa Prisma
  localmente. Sin sección `functions:`, según lo pedido.
- Se corrigió `.nvmrc`, que había quedado con el comando de shell literal
  (`echo "20.20.2" > .nvmrc`) en vez del número de versión.
- Se verificó `npx serverless offline`: levanta (`Starting Offline at stage
dev (us-east-1)`), se mantiene corriendo sin crashear ni pedir login, y
  `npx serverless print` confirma que `DATABASE_URL` se resuelve
  correctamente desde `.env`. Sin `functions:` definidas no expone rutas
  HTTP todavía, como se esperaba.

## Bloque 1 — Sincronización (sync)

### T1.1 — `JsonPlaceholderClient`

Se pidió el cliente HTTP puro en `src/infrastructure/http/JsonPlaceholderClient.ts`,
con `getPosts()` tipado según la forma real de JSONPlaceholder, manejo de
errores descriptivo (red caída, timeout, status no-2xx) y URL base
configurable. Explícitamente fuera de alcance: `PostRepository` y
`SyncDataUseCase` (T1.2 y T1.4).

- Se usó el `fetch` global de Node 20 (disponible también en el runtime
  `nodejs20.x` de Lambda) en vez de agregar `axios` como dependencia —no
  hacía falta nada más que una llamada GET simple, y evita una dependencia
  extra sin necesidad real.
- URL base configurable vía `JSONPLACEHOLDER_BASE_URL` (env var) con
  `https://jsonplaceholder.typicode.com` como constante de default —ninguna
  de las dos queda hardcodeada en medio del método, y el constructor la
  acepta como parámetro para tests que necesiten apuntar a otro host.
- Timeout de 10s con `AbortSignal.timeout()` (nativo, sin dependencias) para
  cubrir el caso de red colgada, no solo caída/status de error.
- Errores de red y de status no-2xx se envuelven en un `Error` con mensaje
  descriptivo (URL, causa) en vez de dejar propagar la excepción cruda de
  `fetch` o un `Response` sin contexto.
- Se validó contra la API real: 100 posts con la forma esperada
  (`id`/`userId`/`title`/`body`), un 404 forzado (URL base inválida) y una
  falla de red real (puerto sin nada escuchando) — ambos casos lanzan el
  error descriptivo esperado. Se hizo con un script temporal, borrado
  después de verificar.
- Seguimiento: se agregó `JSONPLACEHOLDER_BASE_URL` (opcional) a `.env` y
  `.env.example`, y a `serverless.yml` (`provider.environment`, con fallback
  al mismo default que ya tiene el código) para que la variable llegue a las
  Lambdas cuando T1.6 instancie el cliente dentro de un handler real.

### T1.2 — `PostRepository`

Se pidió el repositorio en `src/infrastructure/db/PostRepository.ts`:
`PrismaClient` instanciado como singleton con el driver adapter
(`@prisma/adapter-pg`, según el hallazgo documentado en T0.3), upsert por
`externalId`, listado paginado con filtros combinables (`userId` + `search`
sobre `title`, mismo criterio que 02-query-data.md) y un `findAll` sin
paginar para reutilizar en T3.1. Explícitamente fuera de alcance:
`SyncDataUseCase`, `GetDataUseCase`, `ExportCsvUseCase`.

- Se creó `src/domain/Post.ts` con la entidad de dominio (`id`, `externalId`,
  `userId`, `title`, `body`, `syncedAt`) para que `PostRepository` devuelva
  ese tipo en vez del tipo generado por Prisma —cumple el pedido de "no
  exponer detalles internos de Prisma hacia quien lo consume" sin necesitar
  un mapeo manual, porque el objeto que devuelve Prisma ya es
  estructuralmente compatible con la entidad de dominio.
- El `where` de los filtros (`userId` + `search` con `contains`/
  `mode: 'insensitive'`) se arma en un único helper privado
  (`buildWhereClause`), usado tanto por `findPaginated` como por `findAll`
  —mismo criterio, sin duplicarlo entre los dos métodos ni exponerlo hacia
  afuera.
- El singleton de `PrismaClient` vive a nivel de módulo (no de instancia de
  clase): se crea una sola vez por contenedor de Lambda y se reutiliza en
  invocaciones sucesivas del mismo contenedor (evita reabrir conexión en
  cada invocación); el constructor de `PostRepository` acepta un
  `PrismaClient` opcional para poder inyectar un mock en los tests de
  T4.1-T4.3 sin tocar el singleton real.
- Se validó contra la base real: upsert crea y luego actualiza (no duplica)
  el mismo `externalId`; `findPaginated` con `userId` + `search` combinados
  devuelve el `total` correcto y respeta `skip`/`take` entre páginas;
  `findAll` con el mismo filtro devuelve todo sin paginar. Se hizo con un
  script temporal, borrado después de verificar.

### T1.3 — `SqsPublisher` (simulado)

Se pidió el mecanismo que desacopla `POST /api/sync-data` (responde `202`
de inmediato) del procesamiento real, simulando SQS sin cola real —la
sugerencia del pedido era invocar directamente al handler consumidor de
forma asíncrona. Explícitamente fuera de alcance: `SyncDataUseCase` y los
handlers (T1.4-T1.6).

- **Ajuste sobre la sugerencia**: invocar directamente al handler consumidor
  no era viable todavía porque ese handler (`syncDataConsumerHandler`, T1.6)
  no existe aún, y hacer que `infrastructure/queue` importe algo de
  `handlers/` además invertiría la dirección de dependencias de la
  arquitectura (los handlers llaman a application/infrastructure, no al
  revés). En cambio, `SqsPublisher` recibe el consumer como una función
  inyectada por constructor (`SyncJobConsumer`) —quien lo instancie (T1.4 en
  adelante) decide qué función correr. Sigue siendo la opción más simple: un
  `setImmediate` fire-and-forget, sin cola en memoria ni `EventEmitter`.
- `publish(message)` no es `async`/esperado por quien lo llama —desacopla el
  timing igual que lo haría SQS real, para que el handler HTTP pueda
  responder `202` sin esperar el procesamiento.
- Los errores que tire el consumer se capturan dentro de `publish` y se
  loggean (`console.error`), en vez de dejarlos escapar como unhandled
  rejection —dado que acá el consumer corre en el mismo proceso (a
  diferencia de SQS real, donde correría en una invocación de Lambda
  separada con su propio manejo de errores/DLQ).
- Comentario en el código aclarando que esto simula SQS y que en producción
  se reemplazaría por `@aws-sdk/client-sqs` (`SendMessageCommand`) con el
  consumer disparado por el trigger real de SQS.
- Se validó con un script temporal: `publish()` no bloquea (el código
  posterior a la llamada corre antes que el consumer) y un consumer que
  tira una excepción no genera un unhandled rejection —se captura y
  loggea. Se borró después de verificar.

**Nota**: el diseño de constructor con consumer inyectado se reemplazó por
`subscribe()` al implementar T1.4 — ver esa sección para el detalle.

### T1.4 — `SyncDataUseCase`

Se pidió el use case que orquesta el flujo completo, dividido en dos
responsabilidades según la spec: `trigger()` (genera `jobId`, publica a la
cola, devuelve enseguida para el `202`) y `processSyncJob()` (lo que corre
el consumer: trae posts, los transforma, hace upsert). Explícitamente fuera
de alcance: `syncDataHandler`/`syncDataConsumerHandler` (T1.5-T1.6).

- Las tres dependencias (`JsonPlaceholderClient`, `PostRepository`,
  `SqsPublisher`) se inyectan por constructor, sin instanciarlas dentro del
  use case —para mockearlas en T4.1.
- **Nota de wiring**: inyectar el consumer por constructor de `SqsPublisher`
  (diseño original de T1.3) generaba una referencia circular con
  `SyncDataUseCase` (el consumer _es_ `useCase.processSyncJob`, pero
  `useCase` no existe todavía cuando se construye `SqsPublisher`). La
  solución inicial fue un `let` + closure, que funcionaba solo porque
  `publish()` es asíncrono (`setImmediate`) —frágil y difícil de justificar
  en una revisión de código. Se reemplazó por un método `subscribe(consumer)`
  en `SqsPublisher`, que separa explícitamente "crear" de "conectar": ahora
  `publish()` sin `subscribe()` previo lanza `SqsPublisher: no consumer
subscribed` en vez de fallar en silencio, y el wiring queda lineal (crear
  publisher → crear use case con ese publisher → `publisher.subscribe(...)`).
  Se revalidó con un script temporal: el error explícito sin `subscribe()`,
  y el flujo completo con el wiring nuevo (trigger → consumer → 100 posts
  persistidos). Se borró después de verificar.
- Si `getPosts()` o algún upsert fallan, `processSyncJob` loggea el error
  con el `jobId` para poder correlacionarlo (`console.error`) y no
  re-lanza —no tumba el proceso, sin reintentos automáticos, según la
  spec. En éxito, loggea la cantidad de posts procesados
  (`console.log`), tal como pide el paso "d" del flujo en la spec.
- Se validó de punta a punta contra la API real y la base real: `trigger()`
  devuelve el `jobId` de inmediato, el consumer corre después de forma
  asíncrona y persiste los 100 posts de JSONPlaceholder; con un cliente HTTP
  apuntando a un puerto sin nada escuchando, el error se loggea correlacionado
  con su `jobId` y no genera unhandled rejection. Se hizo con un script
  temporal, borrado después de verificar (los 100 posts sincronizados sí
  quedaron en la base de desarrollo, útiles para las tareas de consulta/CSV).

### T1.5 — `syncDataHandler.ts` (fusiona T1.6)

Se pidió el handler HTTP de `POST /api/sync-data`: composition root a nivel
de módulo (una sola vez por contenedor Lambda), el handler solo llama a
`useCase.trigger()` y responde `202` con `{ message, jobId }`, manejo de
errores según la convención de CLAUDE.md (`{ statusCode, message,
timestamp }`, `500` si falla al encolar), y registrar la función en
`serverless.yml` (`POST /api/sync-data`).

- **T1.6 fusionada con T1.5, sin implementarse como tarea separada**: en
  este diseño, `SqsPublisher.publish()` invoca directamente a
  `processSyncJob` vía `subscribe()` (sin trigger real de SQS), así que no
  hay un segundo handler Lambda que dispare el consumer —`processSyncJob`
  en `SyncDataUseCase` ya cumple ese rol dentro del mismo proceso. Reflejado
  en `PLAN.md` (T1.6 tachada con la nota del motivo).
- Composition root a nivel de módulo: `JsonPlaceholderClient`,
  `PostRepository`, `SqsPublisher` y `SyncDataUseCase` se instancian una
  sola vez fuera de la función handler, y `publisher.subscribe(...)` se
  llama ahí mismo —mismo criterio que el singleton de `PrismaClient` en
  T1.2, para no reabrir nada en cada invocación dentro del mismo contenedor.
- Se agregó `@types/aws-lambda` como devDependency (solo tipos, sin costo en
  runtime) para tipar `APIGatewayProxyEvent`/`APIGatewayProxyResult` sin
  salirse de "handlers nativos, sin framework HTTP" de CLAUDE.md.
- **Ajuste — handler apuntando a `dist/`, no a `src/`**: `serverless-offline`
  no transpila TypeScript por sí solo (no hay plugin tipo
  `serverless-esbuild` instalado); si el `handler` en `serverless.yml`
  apunta a `src/handlers/syncDataHandler.ts`, Node no puede requerirlo
  directamente. Se apuntó a `dist/handlers/syncDataHandler.syncDataHandler`
  (la salida de `npm run build`) —hace falta compilar antes de levantar
  `serverless offline`, algo a documentar en el `README.md` de T5.1.
- Se validó de punta a punta: `npm run build` + `npx serverless offline`,
  `POST http://localhost:3000/dev/api/sync-data` real devuelve `202` con
  `jobId` de inmediato (el log de "processed 100 posts successfully" del
  consumer aparece después, en el mismo proceso, confirmando que la
  respuesta no espera el procesamiento), y los 100 posts quedan persistidos
  en la base.
- El camino de error (`500`) también se forzó en vivo: se comentó
  temporalmente `sqsPublisher.subscribe(...)` en el composition root, se
  rebuildeó y se hizo el mismo `POST` real contra `serverless offline`. La
  respuesta fue exactamente `{"statusCode":500,"message":"Failed to enqueue
sync job","timestamp":"2026-08-17T19:09:34.231Z"}` con status HTTP `500`,
  y el log del servidor mostró la excepción real capturada por el `catch`
  (`Error: SqsPublisher: no consumer subscribed`, la misma que agrega T1.3).
  Se restauró el `subscribe()`, se rebuildeó de nuevo y se reconfirmó el
  camino feliz (`202`) para dejar todo como estaba antes de la prueba.

## Bloque 2 — Consulta (query)

### T2.1 — `GetDataUseCase`

Se pidió el use case de `GET /api/data`: recibe `PostRepository` inyectado,
toma `page`/`limit`/`userId`/`search`, valida y normaliza según
02-query-data.md, calcula `skip`/`take`, y devuelve
`{ data, pagination: { page, limit, total, totalPages } }`. Explícitamente
fuera de alcance: `getDataHandler.ts` (T2.2).

- **Aparte explícito de la letra de la spec**: 02-query-data.md divide el
  flujo en "1-2. el handler parsea y valida page/limit" y "3. el use case
  arma la query" —es decir, ubica la validación de "page/limit son números
  válidos" del lado del handler. El pedido de esta tarea, en cambio, puso
  esa validación en `GetDataUseCase`. Se siguió el pedido de la tarea en vez
  de la división literal de la spec, porque coincide mejor con la regla ya
  establecida en CLAUDE.md ("los handlers no contienen lógica de negocio...
  toda la lógica testeable vive en application/") y con la sección de
  Testing ("testear los use cases mockeando repositorio... no hace falta
  testear los handlers"): si la validación viviera en el handler, quedaría
  fuera del alcance de los tests de T4.2. `getData()` nunca lanza por
  input inválido —normaliza en silencio (`page`/`limit` no positivos o no
  enteros caen al default, `limit` se cappea a 100, `search` vacío se trata
  como filtro ausente)—, coherente con el criterio de la spec de no tratar
  como error los casos de "filtro/página fuera de rango". La validación de
  "`page`/`limit` no son números" (el 400 `Invalid pagination parameters`)
  sigue siendo trabajo del handler en T2.2, porque ahí es donde llegan como
  string crudo desde `queryStringParameters` —`GetDataUseCase` ya recibe
  `number | undefined`, no strings.
- El `where` combinable se arma reutilizando el mismo `PostFilters` de T1.2
  (no se duplica el criterio de filtros).
- Se validó contra los 100 posts reales ya sincronizados (T1.4/T1.5): page
  por default, `limit` cappeado a 100, `page`/`limit` inválidos
  (negativos, cero, no-enteros) cayendo al default, `search` vacío
  devolviendo el total completo, filtros `userId`+`search` combinados (AND,
  case-insensitive), `totalPages` calculado correctamente, página fuera de
  rango devolviendo `data: []` sin error, y un filtro sin matches
  devolviendo `total: 0`. Se hizo con un script temporal, borrado después
  de verificar.

### T2.2 — `getDataHandler.ts`

Se pidió el handler de `GET /api/data`: composition root a nivel de módulo
(mismo patrón que `syncDataHandler`), parsea `queryStringParameters`
(`page`, `limit`, `userId`, `search`), devuelve `400 Invalid query
parameters` si `page`/`limit`/`userId` vienen presentes pero no son
parseables como número —sin llamar al use case—, y si son válidos (o no
vienen) llama a `GetDataUseCase.getData(...)` y devuelve `200` con el
resultado tal cual. Manejo general de errores con el formato de CLAUDE.md.
Explícitamente fuera de alcance: `exportCsvHandler.ts` (Bloque 3).

- `userId` recibe la misma validación 400 que `page`/`limit`
  (`Number(...)` y chequeo de `NaN`), en vez de dejarlo pasar sin validar
  como en la primera versión. **Corrección**: la versión original dejaba pasar un
  `userId` no numérico como `NaN` hasta Prisma, que terminaba tirando un
  `500` (error de servidor) para lo que en realidad es un input inválido
  del cliente —debía ser `400`, igual que `page`/`limit`. Se corrigió para
  mantener consistencia entre los tres parámetros numéricos.
- El mensaje del 400 pasó de `"Invalid pagination parameters"` a
  `"Invalid query parameters"`, ya que ahora cubre `userId` además de la
  paginación —el nombre anterior quedaba incompleto.
- La validación de rangos/defaults (page ≤0, limit >100, etc.) no vive acá
  —ya la resuelve `GetDataUseCase` (T2.1) recibiendo `number | undefined`;
  este handler solo distingue "no es un número" (`400`, antes de llamar al
  use case) de "es un número, aunque esté fuera de rango" (se lo pasa al
  use case, que lo normaliza).
- Se agregó la función `getData` a `serverless.yml` (`GET /api/data`,
  mismo `handler` apuntando a `dist/` que `syncData`, por la misma razón
  documentada en T1.5: `serverless-offline` no transpila TS).
- Se validó de punta a punta con `npm run build` + `serverless offline`
  real contra los 100 posts ya sincronizados: defaults (`page:1, limit:20,
total:100, totalPages:5`), filtros `userId`+`search` combinados (`200`,
  resultado correcto), y los tres casos de `400` (`page=abc`, `limit=xyz`,
  `userId=abc` —este último confirmado que pasó de `500` a `400`) con el
  formato y mensaje nuevo. Se detuvo el servidor y se limpió el build
  después de verificar.

## Bloque 3 — Exportación CSV

### T3.1 — `ExportCsvUseCase`

Se pidió el use case de `GET /api/export-csv`: reutiliza el mismo
`PostFilters` que `GetDataUseCase`/`PostRepository` (T1.2/T2.1, sin
paginar), convierte el resultado a CSV con columnas
`id,externalId,userId,title,body,syncedAt`, y devuelve un CSV válido con
solo headers si no hay resultados. Explícitamente fuera de alcance:
`exportCsvHandler.ts` (T3.2).

- **Elección de librería — `@json2csv/plainjs` en vez de `json2csv`**:
  CLAUDE.md sugiere `json2csv`, pero ese paquete sin scope tiene como
  `latest` un alpha (`6.0.0-alpha.2`) — el proyecto se movió a paquetes con
  scope (`@json2csv/*`) y el nombre viejo quedó sin release estable
  reciente. Se usó `@json2csv/plainjs@7.0.8` (versión estable, API
  sincrónica en memoria, suficiente para el volumen de este challenge).
- Se usa `fields` explícito (las 6 columnas) al construir el `Parser`, en
  vez de dejar que infiera las columnas de los datos —así el CSV mantiene
  el header fijo aunque el array de posts esté vacío (caso borde de la
  spec: sin resultados, CSV válido solo con headers).
- No hizo falta lidiar con el escapado de comas/comillas/saltos de línea
  dentro de `body` a mano —el `Parser` sigue RFC 4180 automáticamente
  (comillas dobles y contenido multilínea correctamente citado); es
  justamente la razón práctica para no reimplementar la serialización CSV
  a mano.
- Se validó contra los 100 posts reales sincronizados: export completo,
  export filtrado (`userId`+`search`, mismo resultado que T2.1), CSV con
  solo headers cuando el filtro no matchea nada, y `syncedAt` como ISO
  string. El primer intento de contar filas con `split('\n')` dio un
  conteo incorrecto por saltos de línea dentro de campos citados (CSV
  válido, no un bug) — se corrigió el método de verificación, no el
  código. Scripts temporales, borrados después de verificar.

### T3.2 — `exportCsvHandler.ts`

Se pidió el handler de `GET /api/export-csv`: composition root a nivel de
módulo (mismo patrón que los demás handlers), parsea `userId`/`search` de
`queryStringParameters` con la misma validación que `getDataHandler`
(`userId` no numérico → `400 Invalid query parameters`, sin llamar al use
case), llama a `exportCsvUseCase.exportToCsv(...)` y devuelve `200` con
`Content-Type: text/csv` y `Content-Disposition: attachment;
filename="posts-export.csv"`. Con esto quedan implementados los 3 endpoints
del challenge.

- Sin filtros obligatorios, según la nota de interpretación de
  03-export-csv.md: `userId`/`search` son opcionales, mismo criterio que
  `/api/data`.
- Se agregó la función `exportCsv` a `serverless.yml` (`GET
/api/export-csv`), mismo criterio de `handler` apuntando a `dist/` que
  las otras dos funciones.
- Se validó de punta a punta con `npm run build` + `serverless offline`
  real contra los 100 posts sincronizados: headers HTTP correctos
  (`content-type: text/csv`, `content-disposition: attachment;
filename="posts-export.csv"`), export completo (100 filas de datos),
  export filtrado por `userId`+`search` (4 filas, mismo resultado que
  T2.1/T3.1), `400` real en `userId=abc`, y CSV solo-headers cuando el
  filtro no matchea nada. Se detuvo el servidor y se limpiaron los archivos
  de prueba después de verificar.

## Bloque 4 — Tests

### T4.1 — Tests de `SyncDataUseCase`

Se pidió el primer archivo de tests del proyecto
(`tests/application/SyncDataUseCase.test.ts`), con mocks manuales
(`jest.fn()`) para las tres dependencias inyectadas, no `jest.mock()` de
módulo completo. Jest/ts-jest todavía no estaban instalados —era la primera
tarea del Bloque 4—, así que hubo que darles de alta.

- **Setup de Jest**: se instalaron `jest`, `ts-jest`, `@types/jest`
  (versiones `latest` reales y estables esta vez —`jest@30.4.2`,
  `ts-jest@29.4.12`—, se chequeó `peerDependencies`/`engines` antes de
  instalar dado el historial de sorpresas con `latest` en este proyecto).
  Config generada con `npx ts-jest config:init` (el flujo actual
  recomendado por la propia librería) en vez de armarla a mano.
- **`tsconfig.test.json` separado del build**: los tests viven en
  `tests/`, fuera de `src/`, y el `tsconfig.json` de producción tiene
  `rootDir: "src"` / `include: ["src/**/*.ts"]` a propósito (decisión de
  T0.1, pensada para el build de Lambda). Meter `tests/` en ese mismo
  `include` haría que `tsc`/`npm run build` intentara compilar los tests
  al `dist/` que se despliega —mismo criterio ya aplicado en T1.5 con
  `prisma.config.ts` quedando fuera del build. Se creó `tsconfig.test.json`
  (extiende el de producción, agrega `tests/**/*.ts` al `include`, con
  `rootDir: "."` y `noEmit: true`) usado solo por `ts-jest` vía
  `jest.config.js`; `tsc --noEmit` y `npm run build` se verificaron sin
  cambios de comportamiento ni de contenido en `dist/`.
- Mocks manuales tipados como `{ metodoUsado: jest.fn() } as unknown as
jest.Mocked<Clase>` —solo se stubean los métodos que `SyncDataUseCase`
  realmente llama (`getPosts`, `upsertByExternalId`, `publish`), no todos
  los de cada clase.
- 4 casos, los 4 pedidos explícitamente: `trigger()` publica `{ jobId }` y
  devuelve el mismo `jobId` sin depender de que el consumer corra;
  `processSyncJob()` camino feliz hace upsert una vez por post con el
  mapeo correcto (`id`→`externalId`); camino de error (`getPosts` rechaza)
  no relanza y loggea con el `jobId` correlacionado (`console.error`
  espiado); caso borde de array vacío no llama a `upsertByExternalId`.
- No se testeó `JsonPlaceholderClient`/`PostRepository`/`SqsPublisher` en
  sí mismos, según lo pedido —ya se validaron a mano contra servicios
  reales en T1.1-T1.3.
- `npx jest` corre los 4 tests en verde.

### T4.2 — Tests de `GetDataUseCase`

Se pidió `tests/application/GetDataUseCase.test.ts`, mockeando
`PostRepository.findPaginated` con `jest.fn()` (mismo patrón manual que
T4.1), cubriendo las reglas de normalización ya documentadas en T2.1:
defaults, `page`/`limit` inválidos, cap de `limit` en 100, `search` vacío
tratado como filtro ausente, filtros combinados, cálculo de `skip`/`take`,
y la forma exacta de la respuesta con `totalPages` redondeado hacia arriba.

- **Bug propio detectado y corregido durante la escritura**: la primera
  versión usaba una sola tabla `it.each` mezclando casos de `page` inválido
  y `limit` inválido, reutilizando la misma columna `expectedSkip` para
  ambos. Para los casos de `limit` inválido, el `skip` esperado real es
  `0` (porque `page` no se pasó y cae a su default 1), pero la tabla tenía
  `20` hardcodeado —error del test, no del código bajo prueba. Falló
  reproduciblemente al correrlo (3 tests en rojo) y se corrigió separando
  en dos `it.each` distintos, uno por campo, cada uno afirmando lo que
  realmente corresponde.
- No se testeó el armado del `where`/`buildWhereClause` en sí —eso es
  responsabilidad de `PostRepository` (T1.2)—, solo que
  `GetDataUseCase` le pase el `PostFilters`/`skip`/`take` correctos al
  método mockeado.
- Nota aparte (no accionable): la primera corrida de `npx jest` con ambos
  archivos de test mostró un warning de Jest ("worker process failed to
  exit gracefully") que no reapareció en corridas posteriores ni bajo
  `--detectOpenHandles` —consistente con el cache en frío de `ts-jest` en
  la primera compilación, no con un leak real de recursos (no hay
  instancias reales de `PrismaClient`/`fetch` en estos tests, todo está
  mockeado con `import type`).
- `npx jest` corre los 16 tests acumulados (T4.1 + T4.2) en verde.

### T4.3 — Tests de `ExportCsvUseCase`

Se pidió `tests/application/ExportCsvUseCase.test.ts`, mockeando
`PostRepository.findAll` con `jest.fn()` (mismo patrón manual que T4.1/T4.2).
Con esto se completa el Bloque 4.

- Antes de escribir la aserción de escapado RFC 4180, se confirmó
  empíricamente el formato exacto que produce `@json2csv/plainjs` con un
  script temporal (`title: 'Hello, world'` → `"Hello, world"`;
  `body: 'A "quoted" body, with a comma'` →
  `"A ""quoted"" body, with a comma"`, comillas internas duplicadas) en vez
  de asumirlo — mismo criterio que en T3.1, donde ya se había visto que un
  conteo de filas "a ojo" puede fallar por cómo el CSV cita contenido con
  saltos de línea/comas. El test valida el output, no reimplementa el
  escapado.
- 4 casos: sin filtros (repositorio llamado con `{}`, CSV con header +
  una fila por post mockeado); filtros `userId`+`search` pasados
  correctamente al repositorio; array vacío → CSV solo con header, sin
  tirar error; y el caso de escapado de comas/comillas.
- No se testeó `PostRepository` en sí —ya validado en T1.2 y
  T4.1/T4.2—, solo que `ExportCsvUseCase` le pase los filtros correctos.
- `npx jest` corre los 20 tests acumulados (T4.1+T4.2+T4.3) en verde;
  `tsc --noEmit` y `npm run build` confirmados sin cambios y sin archivos
  de test filtrados a `dist/`.
