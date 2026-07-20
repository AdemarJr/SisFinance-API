# Variáveis para Railway (`sisfinance-api.up.railway.app`)

Configure em **Railway → seu serviço → Variables**.

## Forma recomendada (evita timeout por senha com `@`)

Use variáveis **separadas** — a API monta a URL com encode automático:

| Variável | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(seu segredo de 64 chars)* |
| `PGHOST` | `easypanel.pyrou.com.br` |
| `PGPORT` | `5432` |
| `PGDATABASE` | `pyrou-finace` |
| `PGUSER` | `pyrouwebdb` |
| `PGPASSWORD` | `p!r@uW3b*26` *(senha literal, sem encode)* |
| `PGSSLMODE` | `disable` |

> **Não** use `DATABASE_URL` se a senha tiver `@` ou `*` — o parser interpreta o host errado e o login dá **Connection terminated due to connection timeout**.

Se ainda quiser `DATABASE_URL`, a senha **precisa** estar encoded:

- `@` → `%40`
- `*` → `%2A`

```text
postgresql://pyrouwebdb:p!r%40uW3b%2A26@easypanel.pyrou.com.br:5432/pyrou-finace?sslmode=disable
```

## Remover do Railway (modo Supabase legado)

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Se existir um plugin Postgres do Railway gerando `DATABASE_URL` automática, **desvincule** ou sobrescreva com as variáveis `PG*` acima.

## Firewall Easypanel

No serviço Postgres do Easypanel, confira se a porta **5432** está exposta publicamente (External / Domains).  
O Railway precisa alcançar `easypanel.pyrou.com.br:5432` da internet.

## Após deploy — validar

```bash
curl https://sisfinance-api.up.railway.app/api/health
```

Esperado:

```json
{
  "status": "ok",
  "postgres": true,
  "db": { "ok": true, "database": "pyrou-finace", "latencyMs": 50 }
}
```

Se `db.ok` for `false` e `error` tiver `timeout`, a URL/firewall ainda está errado.

## Login

`admin@sisfinance.com` / `Admin@123456`  
(requer `senha_hash` — `npm run set-admin-password`)
