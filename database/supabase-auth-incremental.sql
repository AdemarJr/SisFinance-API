-- =============================================================================
-- SisFinance — Auth/SaaS INCREMENTAL
-- =============================================================================
-- Use quando o banco financeiro JÁ EXISTE (empresas, lancamentos, etc.)
-- e só faltam as tabelas de login, planos e multi-tenant.
--
-- Seguro para rodar mais de uma vez (idempotente).
-- Execute no Supabase → SQL Editor.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Planos de assinatura
-- -----------------------------------------------------------------------------
create table if not exists public.planos_assinatura (
  id uuid primary key default uuid_generate_v4(),
  nome text not null unique check (nome in ('Gratuito', 'Iniciante', 'Profissional', 'Enterprise')),
  limite_empresas integer not null,
  preco_mensal numeric(10,2) not null default 0,
  descricao text,
  recursos jsonb,
  ativo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.planos_assinatura (nome, limite_empresas, preco_mensal, descricao, recursos) values
  ('Gratuito', 1, 0.00, '1 empresa, recursos básicos', '["Dashboard básico", "1 empresa", "Suporte por email"]'::jsonb),
  ('Iniciante', 3, 97.00, 'Até 3 empresas, recursos intermediários', '["Dashboard completo", "Até 3 empresas", "Relatórios básicos", "Suporte prioritário"]'::jsonb),
  ('Profissional', 10, 297.00, 'Até 10 empresas, recursos avançados', '["Dashboard avançado", "Até 10 empresas", "Relatórios avançados", "API Access", "Suporte 24/7"]'::jsonb),
  ('Enterprise', 999999, 997.00, 'Empresas ilimitadas, todos os recursos', '["Tudo do Profissional", "Empresas ilimitadas", "Customizações", "Gerente de conta dedicado", "SLA garantido"]'::jsonb)
on conflict (nome) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Clientes do sistema (usuários SaaS)
-- -----------------------------------------------------------------------------
create table if not exists public.clientes_sistema (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  nome_completo text not null,
  email text not null unique,
  telefone text,
  documento text,
  plano_id uuid not null references public.planos_assinatura(id),
  limite_empresas integer not null default 1,
  data_assinatura timestamptz default now(),
  data_expiracao timestamptz,
  status text not null default 'Ativo' check (status in ('Ativo', 'Suspenso', 'Cancelado')),
  is_super_admin boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_clientes_sistema_email on public.clientes_sistema(email);
create index if not exists idx_clientes_sistema_auth_user_id on public.clientes_sistema(auth_user_id);
create index if not exists idx_clientes_sistema_plano_id on public.clientes_sistema(plano_id);

-- -----------------------------------------------------------------------------
-- 3. Vínculo empresas → cliente do sistema
-- -----------------------------------------------------------------------------
alter table public.empresas
  add column if not exists cliente_sistema_id uuid references public.clientes_sistema(id) on delete cascade;

create index if not exists idx_empresas_cliente_sistema_id on public.empresas(cliente_sistema_id);

-- -----------------------------------------------------------------------------
-- 4. Log de auditoria
-- -----------------------------------------------------------------------------
create table if not exists public.log_acoes (
  id uuid primary key default uuid_generate_v4(),
  cliente_sistema_id uuid references public.clientes_sistema(id) on delete cascade,
  acao text not null,
  entidade text,
  entidade_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists idx_log_acoes_cliente_sistema_id on public.log_acoes(cliente_sistema_id);
create index if not exists idx_log_acoes_created_at on public.log_acoes(created_at desc);

-- -----------------------------------------------------------------------------
-- 5. Limite de empresas por plano
-- -----------------------------------------------------------------------------
create or replace function public.verificar_limite_empresas()
returns trigger
language plpgsql
as $$
declare
  v_cliente_id uuid;
  v_limite integer;
  v_total_empresas integer;
begin
  v_cliente_id := coalesce(NEW.cliente_sistema_id, (
    select cliente_sistema_id from public.empresas where id = NEW.id
  ));

  if v_cliente_id is null then
    return NEW;
  end if;

  select limite_empresas into v_limite
  from public.clientes_sistema
  where id = v_cliente_id;

  select count(*) into v_total_empresas
  from public.empresas
  where cliente_sistema_id = v_cliente_id
    and ativo = true;

  if TG_OP = 'INSERT' and v_total_empresas >= v_limite then
    raise exception 'Limite de empresas atingido. Plano atual permite até % empresas.', v_limite;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trigger_verificar_limite_empresas on public.empresas;
create trigger trigger_verificar_limite_empresas
  before insert on public.empresas
  for each row
  execute function public.verificar_limite_empresas();

-- -----------------------------------------------------------------------------
-- 6. Funções auxiliares
-- -----------------------------------------------------------------------------
create or replace function public.get_cliente_sistema_atual()
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.clientes_sistema
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clientes_sistema
    where auth_user_id = auth.uid()
      and is_super_admin = true
  );
$$;

-- -----------------------------------------------------------------------------
-- 7. Views
-- -----------------------------------------------------------------------------
create or replace view public.vw_clientes_resumo as
select
  c.id,
  c.nome_completo,
  c.email,
  c.status,
  p.nome as plano_nome,
  p.limite_empresas as plano_limite,
  c.limite_empresas as limite_atual,
  (select count(*) from public.empresas e where e.cliente_sistema_id = c.id and e.ativo = true) as total_empresas,
  c.data_assinatura,
  c.data_expiracao,
  c.is_super_admin
from public.clientes_sistema c
join public.planos_assinatura p on c.plano_id = p.id
order by c.created_at desc;

create or replace view public.vw_uso_sistema as
select
  p.nome as plano,
  count(c.id) as total_clientes,
  sum(case when c.status = 'Ativo' then 1 else 0 end) as clientes_ativos,
  sum((select count(*) from public.empresas e where e.cliente_sistema_id = c.id and e.ativo = true)) as total_empresas
from public.planos_assinatura p
left join public.clientes_sistema c on c.plano_id = p.id
group by p.id, p.nome
order by p.preco_mensal;

-- -----------------------------------------------------------------------------
-- 8. RLS (opcional — a API usa service_role e ignora RLS)
-- -----------------------------------------------------------------------------
alter table public.planos_assinatura enable row level security;
alter table public.clientes_sistema enable row level security;
alter table public.empresas enable row level security;

drop policy if exists "Clientes podem ver seus próprios dados" on public.clientes_sistema;
create policy "Clientes podem ver seus próprios dados"
  on public.clientes_sistema for select
  using (auth.uid() = auth_user_id or is_super_admin = true);

drop policy if exists "Super Admin pode ver todos os clientes" on public.clientes_sistema;
create policy "Super Admin pode ver todos os clientes"
  on public.clientes_sistema for select
  using (public.is_super_admin());

drop policy if exists "Super Admin pode gerenciar clientes" on public.clientes_sistema;
create policy "Super Admin pode gerenciar clientes"
  on public.clientes_sistema for all
  using (public.is_super_admin());

drop policy if exists "Clientes podem ver suas empresas" on public.empresas;
create policy "Clientes podem ver suas empresas"
  on public.empresas for select
  using (
    cliente_sistema_id in (
      select id from public.clientes_sistema where auth_user_id = auth.uid()
    )
    or public.is_super_admin()
  );

drop policy if exists "Clientes podem gerenciar suas empresas" on public.empresas;
create policy "Clientes podem gerenciar suas empresas"
  on public.empresas for all
  using (
    cliente_sistema_id in (
      select id from public.clientes_sistema where auth_user_id = auth.uid()
    )
    or public.is_super_admin()
  );

drop policy if exists "Todos podem ver planos" on public.planos_assinatura;
create policy "Todos podem ver planos"
  on public.planos_assinatura for select
  using (true);

drop policy if exists "Apenas Super Admin pode gerenciar planos" on public.planos_assinatura;
create policy "Apenas Super Admin pode gerenciar planos"
  on public.planos_assinatura for all
  using (public.is_super_admin());

comment on table public.clientes_sistema is 'Clientes do sistema SaaS (usuários que contratam o serviço)';
comment on table public.planos_assinatura is 'Planos de assinatura disponíveis no sistema';
comment on table public.log_acoes is 'Log de auditoria de ações no sistema';

-- =============================================================================
-- 9. PRÓXIMO PASSO — criar o primeiro admin (rode DEPOIS do script acima)
-- =============================================================================
--
-- A) Crie o usuário em: Supabase → Authentication → Users → Add user
--    (marque "Auto Confirm User")
--
-- B) Substitua 'seu@email.com' e execute:
--
-- insert into public.clientes_sistema (
--   auth_user_id,
--   nome_completo,
--   email,
--   plano_id,
--   limite_empresas,
--   is_super_admin,
--   status
-- )
-- select
--   u.id,
--   'Administrador',
--   u.email,
--   (select id from public.planos_assinatura where nome = 'Enterprise' limit 1),
--   999999,
--   true,
--   'Ativo'
-- from auth.users u
-- where u.email = 'seu@email.com'
-- on conflict (email) do nothing;
--
-- C) (Opcional) Vincular empresas existentes ao admin:
--
-- update public.empresas e
-- set cliente_sistema_id = c.id
-- from public.clientes_sistema c
-- where c.email = 'seu@email.com'
--   and e.cliente_sistema_id is null;
--
-- =============================================================================

select
  'Auth/SaaS incremental aplicado.' as status,
  (select count(*) from public.planos_assinatura) as planos,
  (select count(*) from public.clientes_sistema) as clientes_sistema,
  (select count(*) from public.empresas where cliente_sistema_id is not null) as empresas_vinculadas;
