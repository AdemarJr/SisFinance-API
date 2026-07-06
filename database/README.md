# Scripts SQL — Postgres no Supabase

Execute no **Supabase → SQL Editor** (Supabase usado apenas como banco Postgres).

## Ordem de execução

| # | Arquivo | Quando usar |
|---|---------|-------------|
| 1 | `supabase-multientity-setup.sql` | Banco **vazio** (todas as tabelas financeiras) |
| 2 | `supabase-auth-saas-setup.sql` | Setup completo auth/SaaS (banco vazio) |
| 2b | `supabase-auth-incremental.sql` | Banco financeiro **já existe** — só adiciona auth/SaaS |

**Recomendado (banco já com tabelas financeiras):** rode apenas `supabase-auth-incremental.sql`.

## Após o SQL

```bash
npm run create-admin
```

Ou crie o usuário em Authentication → Users e vincule em `clientes_sistema`.
