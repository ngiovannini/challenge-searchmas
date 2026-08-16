# Spec: GET /api/export-csv

## Nota de interpretación

El enunciado no especifica filtros para este endpoint ("Genera y permite la
descarga de un archivo .csv estructurado con la información almacenada").
Se implementa el caso base (exportar todo, sin parámetros) y se agregan
filtros opcionales (`userId`, `search`), reutilizando el mismo criterio que
`/api/data`, para mantener consistencia entre ambos endpoints de consulta
y evitar duplicar lógica de filtrado.

## Objetivo

Exportar a un archivo `.csv` los posts almacenados. Sin parámetros, exporta
todos los registros. Con parámetros opcionales, aplica los mismos filtros
que `GET /api/data` (ver 02-query-data.md).

## Request

`GET /api/export-csv` — exporta todo
`GET /api/export-csv?userId=5&search=qui` — exporta filtrado (opcional)

| Param    | Tipo   | Requerido | Descripción                 |
| -------- | ------ | --------- | --------------------------- |
| `userId` | number | no        | mismo filtro que en `/data` |
| `search` | string | no        | mismo filtro que en `/data` |

No recibe `page`/`limit` — exporta todos los resultados que matcheen (o todos, si no hay filtros).

## Response

**Éxito (200)**

- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="posts-export.csv"`
- Body: contenido CSV, con headers `id,externalId,userId,title,body,syncedAt`

**Error (500)** — si falla la generación:

```json
{ "message": "Failed to generate CSV export" }
```

## Flujo

1. `exportCsvHandler` recibe el `event`, parsea `userId`, `search` si vienen (ambos opcionales)
2. `ExportCsvUseCase`:
   a. Reutiliza el mismo `where` que `GetDataUseCase` (mismo criterio de filtros, o `{}` si no hay filtros)
   b. Trae **todos** los registros que matcheen (sin `skip`/`take`)
   c. Convierte el resultado a formato CSV
3. Devuelve el CSV como archivo descargable

## Casos borde

- **Sin parámetros**: exporta el dataset completo
- **No hay resultados que matcheen** (con filtros): devuelve un CSV válido solo con headers, sin filas
- **Dataset muy grande**: fuera de alcance para el challenge, se menciona como mejora futura (S3 + URL firmada)

## Fuera de alcance

- Exportar a otros formatos (Excel, JSON) — solo CSV
- Streaming del archivo para datasets muy grandes (mejora futura)
