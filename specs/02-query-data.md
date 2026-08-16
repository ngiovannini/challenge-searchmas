# Spec: GET /api/data

## Objetivo

Devolver los posts almacenados en la base de datos, paginados y con filtros
combinables por `userId` y búsqueda parcial en `title`.

## Request

`GET /api/data?page=1&limit=20&userId=5&search=qui`

| Param    | Tipo   | Requerido | Default | Descripción                                       |
| -------- | ------ | --------- | ------- | ------------------------------------------------- |
| `page`   | number | no        | `1`     | página actual (empieza en 1)                      |
| `limit`  | number | no        | `20`    | cantidad de resultados por página (máx. 100)      |
| `userId` | number | no        | —       | filtra posts por dueño original                   |
| `search` | string | no        | —       | búsqueda parcial (case-insensitive) sobre `title` |

Los filtros `userId` y `search` son **combinables** (AND entre ambos si se pasan los dos).

## Response

**Éxito (200)**

```json
{
  "data": [
    {
      "id": "uuid",
      "externalId": 1,
      "userId": 5,
      "title": "...",
      "body": "...",
      "syncedAt": "2026-08-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 143,
    "totalPages": 8
  }
}
```

**Error (400)** — si `page`/`limit` no son números válidos:

```json
{ "message": "Invalid pagination parameters" }
```

## Flujo

1. `getDataHandler` recibe el `event`, parsea `page`, `limit`, `userId`, `search` de `queryStringParameters`
2. Valida que `page`/`limit` sean números positivos (si `limit` > 100, lo cappea a 100)
3. `GetDataUseCase` arma la query con Prisma:
   - `skip = (page - 1) * limit`, `take = limit`
   - `where`:

```typescript
     {
       ...(userId ? { userId } : {}),
       ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
     }
```

4. Devuelve `data` + metadata de paginación (`total` viene de un `count()` con el mismo `where`)

## Casos borde

- **No hay datos sincronizados todavía**: devuelve `data: []` con `total: 0`, no es un error
- **`page` fuera de rango**: devuelve `data: []`, no es un error
- **Filtros no matchean nada**: mismo caso, `data: []`, `total: 0`
- **`search` con string vacío** (`search=`): se trata como si no se hubiera pasado el filtro

## Fuera de alcance

- Ordenamiento (`sort`) — mejora futura si da tiempo
- Búsqueda full-text avanzada (esto es un `contains` simple, no un motor de búsqueda)
