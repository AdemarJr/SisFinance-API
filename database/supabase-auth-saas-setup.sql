-- =====================================================
-- SISTEMA DE AUTENTICAÇÃO E SaaS
-- Sistema Multientidade com Planos de Assinatura
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- Habilitar extensões necessárias
create extension if not exists "uuid-ossp";

-- =====================================================
-- 1. TABELA DE PLANOS DE ASSINATURA
-- =====================================================
create table planos_assinatura (
  id uuid primary key default uuid_generate_v4(),
  nome text not null unique check (nome in ('Gratuito', 'Iniciante', 'Profissional', 'Enterprise')),
  limite_empresas integer not null,
  preco_mensal numeric(10,2) not null default 0,
  descricao text,
  recursos jsonb, -- Array de recursos disponíveis
  ativo boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Inserir planos padrão
insert into planos_assinatura (nome, limite_empresas, preco_mensal, descricao, recursos) values
  ('Gratuito', 1, 0.00, '1 empresa, recursos básicos', '["Dashboard básico", "1 empresa", "Suporte por email"]'::jsonb),
  ('Iniciante', 3, 97.00, 'Até 3 empresas, recursos intermediários', '["Dashboard completo", "Até 3 empresas", "Relatórios básicos", "Suporte prioritário"]'::jsonb),
  ('Profissional', 10, 297.00, 'Até 10 empresas, recursos avançados', '["Dashboard avançado", "Até 10 empresas", "Relatórios avançados", "API Access", "Suporte 24/7"]'::jsonb),
  ('Enterprise', 999999, 997.00, 'Empresas ilimitadas, todos os recursos', '["Tudo do Profissional", "Empresas ilimitadas", "Customizações", "Gerente de conta dedicado", "SLA garantido"]'::jsonb);

-- =====================================================
-- 2. TABELA DE CLIENTES DO SISTEMA (Usuários SaaS)
-- =====================================================
create table clientes_sistema (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  nome_completo text not null,
  email text not null unique,
  telefone text,
  documento text, -- CPF/CNPJ
  plano_id uuid not null references planos_assinatura(id),
  limite_empresas integer not null default 1,
  data_assinatura timestamp with time zone default now(),
  data_expiracao timestamp with time zone,
  status text not null check (status in ('Ativo', 'Suspenso', 'Cancelado')) default 'Ativo',
  is_super_admin boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Criar índices para performance
create index idx_clientes_sistema_email on clientes_sistema(email);
create index idx_clientes_sistema_auth_user_id on clientes_sistema(auth_user_id);
create index idx_clientes_sistema_plano_id on clientes_sistema(plano_id);

-- =====================================================
-- 3. MODIFICAR TABELA DE EMPRESAS
-- Adicionar relacionamento com cliente do sistema
-- =====================================================
-- Adicionar coluna cliente_sistema_id se não existir
alter table empresas 
  add column if not exists cliente_sistema_id uuid references clientes_sistema(id) on delete cascade;

-- Criar índice
create index if not exists idx_empresas_cliente_sistema_id on empresas(cliente_sistema_id);

-- =====================================================
-- 4. TABELA DE LOG DE AÇÕES (Auditoria)
-- =====================================================
create table log_acoes (
  id uuid primary key default uuid_generate_v4(),
  cliente_sistema_id uuid references clientes_sistema(id) on delete cascade,
  acao text not null,
  entidade text, -- Nome da tabela afetada
  entidade_id uuid, -- ID do registro afetado
  dados_anteriores jsonb,
  dados_novos jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone default now()
);

-- Criar índice para consultas de auditoria
create index idx_log_acoes_cliente_sistema_id on log_acoes(cliente_sistema_id);
create index idx_log_acoes_created_at on log_acoes(created_at desc);

-- =====================================================
-- 5. FUNÇÃO PARA VERIFICAR LIMITE DE EMPRESAS
-- =====================================================
create or replace function verificar_limite_empresas()
returns trigger as $$
declare
  v_cliente_id uuid;
  v_limite integer;
  v_total_empresas integer;
begin
  -- Obter cliente_sistema_id e limite
  select cliente_sistema_id into v_cliente_id from empresas where id = NEW.id;
  
  if v_cliente_id is null then
    v_cliente_id := NEW.cliente_sistema_id;
  end if;
  
  select limite_empresas into v_limite 
  from clientes_sistema 
  where id = v_cliente_id;
  
  -- Contar empresas ativas do cliente
  select count(*) into v_total_empresas
  from empresas
  where cliente_sistema_id = v_cliente_id
    and ativo = true;
  
  -- Verificar se excede o limite
  if v_total_empresas >= v_limite and TG_OP = 'INSERT' then
    raise exception 'Limite de empresas atingido. Plano atual permite até % empresas.', v_limite;
  end if;
  
  return NEW;
end;
$$ language plpgsql;

-- Criar trigger para verificar limite
drop trigger if exists trigger_verificar_limite_empresas on empresas;
create trigger trigger_verificar_limite_empresas
  before insert on empresas
  for each row
  execute function verificar_limite_empresas();

-- =====================================================
-- 6. POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS nas tabelas principais
alter table clientes_sistema enable row level security;
alter table empresas enable row level security;
alter table planos_assinatura enable row level security;

-- Políticas para clientes_sistema
create policy "Clientes podem ver seus próprios dados"
  on clientes_sistema for select
  using (auth.uid() = auth_user_id or is_super_admin = true);

create policy "Super Admin pode ver todos os clientes"
  on clientes_sistema for select
  using (
    exists (
      select 1 from clientes_sistema
      where auth_user_id = auth.uid()
      and is_super_admin = true
    )
  );

create policy "Super Admin pode gerenciar clientes"
  on clientes_sistema for all
  using (
    exists (
      select 1 from clientes_sistema
      where auth_user_id = auth.uid()
      and is_super_admin = true
    )
  );

-- Políticas para empresas
create policy "Clientes podem ver suas empresas"
  on empresas for select
  using (
    cliente_sistema_id in (
      select id from clientes_sistema
      where auth_user_id = auth.uid()
    )
    or
    exists (
      select 1 from clientes_sistema
      where auth_user_id = auth.uid()
      and is_super_admin = true
    )
  );

create policy "Clientes podem gerenciar suas empresas"
  on empresas for all
  using (
    cliente_sistema_id in (
      select id from clientes_sistema
      where auth_user_id = auth.uid()
    )
    or
    exists (
      select 1 from clientes_sistema
      where auth_user_id = auth.uid()
      and is_super_admin = true
    )
  );

-- Políticas para planos_assinatura
create policy "Todos podem ver planos"
  on planos_assinatura for select
  using (true);

create policy "Apenas Super Admin pode gerenciar planos"
  on planos_assinatura for all
  using (
    exists (
      select 1 from clientes_sistema
      where auth_user_id = auth.uid()
      and is_super_admin = true
    )
  );

-- =====================================================
-- 7. INSERIR SUPER ADMIN PADRÃO
-- =====================================================
-- IMPORTANTE: Após criar o usuário no Supabase Auth com email admin@sisfinance.com
-- e senha Admin@123456, execute o INSERT abaixo substituindo o UUID do auth.users

-- Primeiro, crie o usuário manualmente no Supabase Auth ou via SQL:
-- Depois, insira na tabela clientes_sistema:

-- EXEMPLO (ajuste o auth_user_id após criar o usuário):
-- insert into clientes_sistema (
--   auth_user_id,
--   nome_completo,
--   email,
--   plano_id,
--   limite_empresas,
--   is_super_admin,
--   status
-- )
-- select
--   (select id from auth.users where email = 'admin@sisfinance.com'),
--   'Super Admin',
--   'admin@sisfinance.com',
--   (select id from planos_assinatura where nome = 'Enterprise'),
--   999999,
--   true,
--   'Ativo'
-- where not exists (
--   select 1 from clientes_sistema where email = 'admin@sisfinance.com'
-- );

-- =====================================================
-- 8. VIEWS ÚTEIS
-- =====================================================

-- View para resumo de clientes e seus planos
create or replace view vw_clientes_resumo as
select 
  c.id,
  c.nome_completo,
  c.email,
  c.status,
  p.nome as plano_nome,
  p.limite_empresas as plano_limite,
  c.limite_empresas as limite_atual,
  (select count(*) from empresas e where e.cliente_sistema_id = c.id and e.ativo = true) as total_empresas,
  c.data_assinatura,
  c.data_expiracao,
  c.is_super_admin
from clientes_sistema c
join planos_assinatura p on c.plano_id = p.id
order by c.created_at desc;

-- View para dashboards de uso
create or replace view vw_uso_sistema as
select 
  p.nome as plano,
  count(c.id) as total_clientes,
  sum(case when c.status = 'Ativo' then 1 else 0 end) as clientes_ativos,
  sum((select count(*) from empresas e where e.cliente_sistema_id = c.id and e.ativo = true)) as total_empresas
from planos_assinatura p
left join clientes_sistema c on c.plano_id = p.id
group by p.id, p.nome
order by p.preco_mensal;

-- =====================================================
-- 9. FUNÇÕES AUXILIARES
-- =====================================================

-- Função para obter cliente do sistema logado
create or replace function get_cliente_sistema_atual()
returns uuid as $$
  select id from clientes_sistema
  where auth_user_id = auth.uid()
  limit 1;
$$ language sql security definer;

-- Função para verificar se é super admin
create or replace function is_super_admin()
returns boolean as $$
  select exists(
    select 1 from clientes_sistema
    where auth_user_id = auth.uid()
    and is_super_admin = true
  );
$$ language sql security definer;

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================

-- Comentários nas tabelas
comment on table clientes_sistema is 'Clientes do sistema SaaS (usuários que contratam o serviço)';
comment on table planos_assinatura is 'Planos de assinatura disponíveis no sistema';
comment on table log_acoes is 'Log de auditoria de todas as ações no sistema';

-- Sucesso!
select 'Schema de autenticação e SaaS criado com sucesso!' as status;
