# SisFinance API

Backend REST do SisFinance. O browser **não** acessa o banco — só esta API (JWT + Postgres).

- **Deploy preferido:** EasyPanel (`Dockerfile` + `easypanel.env.example`)
- **Frontend:** repositório `SisFinance` (EasyPanel)

## Arquitetura

```text
SisFinance (React)  →  esta API  →  Postgres (EasyPanel / pyrou-finace)
                         ↑
                    JWT + pg
```

## Desenvolvimento local

```bash
cp .env.example .env
npm install
npm run dev
```

`GET http://localhost:3001/api/health`

## Banco de dados

No EasyPanel: dump em `SisFinance/sisfinance-db/` + `post-import-easypanel.sql`, depois:

```bash
npm run set-admin-password
```

Scripts legados em [`database/`](./database/).

## Deploy EasyPanel

1. Push este repo no GitHub
2. App no projeto `apps-pyrou`, source GitHub, **Build = Dockerfile**
3. Domínio na porta **3001**, health `/api/health`
4. Env: copiar [`easypanel.env.example`](./easypanel.env.example) (usar `PG*` se a senha tiver `@`/`*`)
5. Após o dump: `npm run set-admin-password` (com `ADMIN_EMAIL` / `ADMIN_PASSWORD`)

Guia do front + cutover: `SisFinance/EASYPANEL.md`.

**Não** use `SERVE_STATIC` no EasyPanel (front é serviço nginx separado).

## Deploy Railway (legado)

Ver [`RAILWAY-ENV.md`](./RAILWAY-ENV.md). Build/start: `npm install && npm run build` / `npm start`.

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

No build EasyPanel do front:

```env
VITE_API_URL=https://SEU-DOMINIO-API/api
```
