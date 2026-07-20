# SisFinance API

Backend REST do SisFinance. **Supabase = apenas Postgres + Auth admin** (nenhum acesso direto do browser).

- **Deploy:** [Railway](https://railway.com/new/github)
- **Frontend:** repositório `SisFinance` (Hostinger)

## Arquitetura

```text
SisFinance (React)  →  esta API  →  Postgres (Supabase)
                         ↑
                    JWT + service_role
```

## Desenvolvimento local

```bash
cp .env.example .env
npm install
npm run dev
```

`GET http://localhost:3001/api/health`

## Banco de dados

Scripts em [`database/`](./database/). Rode no Supabase SQL Editor, depois:

```bash
npm run create-admin
```

## Deploy Railway

1. Push este repo no GitHub
2. [New Project → GitHub](https://railway.com/new/github)
3. Variáveis (modo **Easypanel Postgres**):

| Variável | Descrição |
|----------|-----------|
| `JWT_SECRET` | Segredo dos tokens da API |
| `DATABASE_URL` | Postgres Easypanel (`pyrou-finace`) |
| `NODE_ENV` | `production` |

Exemplo:

```env
DATABASE_URL=postgresql://USUARIO:SENHA_URL_ENCODED@easypanel.pyrou.com.br:5432/pyrou-finace?sslmode=disable
```

Ver [`RAILWAY-ENV.md`](./RAILWAY-ENV.md) para copiar/colar no Railway.

**Modo legado Supabase** (opcional): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.

Após importar o dump no Postgres, defina a senha do admin:

```bash
npm run set-admin-password
```

4. Build: `npm install && npm run build`  
5. Start: `npm start`  
6. Health: `/api/health`  
7. Domínio: Settings → Networking → Generate Domain

**Não** use `SERVE_STATIC` no Railway.

## Endpoints

| Método | Rota |
|--------|------|
| GET | `/api/health` |
| POST | `/api/auth/login` |
| GET | `/api/auth/me` |
| POST | `/api/db/query` |
| POST | `/api/db/rpc` |
| * | `/api/make-server-b1600651/*` |

## Frontend (produção)

No build do Hostinger:

```env
VITE_API_URL=https://SEU-APP.up.railway.app/api
```
