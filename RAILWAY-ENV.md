# Variáveis para Railway (`sisfinance-api.up.railway.app`)

Configure em **Railway → seu serviço → Variables**.

## Postgres Easypanel (recomendado)

| Variável | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(mesmo segredo que já usa — 64 chars)* |
| `DATABASE_URL` | `postgresql://pyrouwebdb:SENHA_URL_ENCODED@easypanel.pyrou.com.br:5432/pyrou-finace?sslmode=disable` |

**Senha com caracteres especiais:** na URL encode `@` → `%40` e `*` → `%2A`.

Exemplo (substitua `SENHA_URL_ENCODED` pela senha real, com encode):

```text
postgresql://pyrouwebdb:SENHA_URL_ENCODED@easypanel.pyrou.com.br:5432/pyrou-finace?sslmode=disable
```

## Remover do Railway (modo Supabase legado)

Se migrar 100% para Easypanel, **apague** estas variáveis:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Após deploy

1. Health: `GET https://sisfinance-api.up.railway.app/api/health`  
   Deve retornar `"postgres": true`
2. Login: `admin@sisfinance.com` / `Admin@123456`  
   *(requer coluna `senha_hash` — ver abaixo)*

## Senha do admin no Postgres

Rode **uma vez** no Easypanel (SQL) ou localmente:

```bash
cd SisFinance-API
npm run set-admin-password
```

Ou SQL manual após deploy da migration `database/add-senha-hash.sql`.
