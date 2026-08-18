# Spec: POST /api/sync-data

## Objetivo

Disparar la sincronización de datos desde la API externa (JSONPlaceholder) hacia
la base de datos propia, de forma no bloqueante (procesamiento asincrónico).

## Request

`POST /api/sync-data`

Sin body requerido (o body opcional para futuros filtros, ej. `{ "resource": "posts" }`).

## Response

**Éxito (202 Accepted)** — indica que la tarea fue encolada, no que ya terminó:

```json
{
  "message": "Sync job accepted",
  "jobId": "uuid-generado"
}
```

**Error (500)** — si falla al encolar (no si falla la sincronización en sí, eso pasa después, async):

```json
{ "message": "Failed to enqueue sync job" }
```

## Flujo

1. Cliente hace `POST /api/sync-data`
2. `syncDataHandler` recibe el request, genera un `jobId`, publica un mensaje a la cola (SQS simulado)
3. Responde inmediatamente `202 Accepted` con el `jobId` — el cliente NO espera a que termine la sincronización real
4. `syncDataConsumerHandler` (disparado por la cola) consume el mensaje:
   - Llama a `JsonPlaceholderClient.getPosts()`
   - Transforma cada post al modelo interno (`Post`)
   - Hace upsert en la base (por `externalId`, para evitar duplicados si se sincroniza más de una vez)
   - Loggea resultado (cantidad de registros procesados, errores si hubo)

## Modelo de datos (`Post`)

| Campo        | Tipo           | Descripción                                                     |
| ------------ | -------------- | --------------------------------------------------------------- |
| `id`         | UUID (interno) | PK propia                                                       |
| `externalId` | Int            | `id` original de JSONPlaceholder (usado para upsert)            |
| `userId`     | Int            | dueño del post en la API externa (usado como filtro en `/data`) |
| `title`      | String         |                                                                 |
| `body`       | String         |                                                                 |
| `syncedAt`   | DateTime       | cuándo se sincronizó por última vez                             |

## Casos borde

- **La API externa falla o está caída**: el consumer loggea el error y no rompe el proceso completo — idealmente reintenta o marca el job como fallido (para el challenge, alcanza con loggear claramente)
- **Se sincroniza dos veces**: el upsert por `externalId` evita duplicados, solo actualiza `syncedAt` y los campos si cambiaron
- **La cola no está disponible**: el handler HTTP devuelve 500, el cliente puede reintentar el POST

## Fuera de alcance

- Reintentos automáticos con backoff (se menciona como mejora futura)
- Sincronización incremental (traer solo lo nuevo) — se trae todo el dataset cada vez
- Autenticación del endpoint
