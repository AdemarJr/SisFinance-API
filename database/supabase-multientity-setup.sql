-- =====================================================
-- SISTEMA DE GESTÃO FINANCEIRA MULTIENTIDADE
-- Gestão de Bar/Restaurante com Multi-Empresa
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- Habilitar extensões necessárias
create extension if not exists "uuid-ossp";

-- =====================================================
-- 1. TABELA DE EMPRESAS (Multi-Entidade)
-- =====================================================
create table empresas (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  tipo text not null check (tipo in ('Unidade Operacional', 'Holding', 'Franquia')),
  cnpj text,
  endereco text,
  responsavel text,
  ativo boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- 2. TABELA DE CONTAS FINANCEIRAS (COM EMPRESA)
-- =====================================================
create table contas_financeiras (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('Caixa', 'Banco', 'Cartão')),
  banco text, -- Nome do banco (ex: Itaú, Caixa Econômica)
  agencia text,
  conta text,
  saldo_inicial numeric(15,2) not null default 0,
  saldo_atual numeric(15,2) not null default 0,
  data_inicio date not null default current_date,
  ativo boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- 3. TABELA DE CLIENTES (COM EMPRESA)
-- =====================================================
create table clientes (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('Pessoa Física', 'Pessoa Jurídica')),
  documento text,
  contato text,
  email text,
  ativo boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- 4. TABELA DE FORNECEDORES (COM EMPRESA)
-- =====================================================
create table fornecedores (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  categoria text,
  contato text,
  email text,
  ativo boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- 5. TABELA DE FUNCIONÁRIOS/STAFF
-- =====================================================
create table funcionarios (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  cargo text not null check (cargo in ('Garçom', 'Atendente', 'Freelancer', 'Cozinheiro', 'Gerente', 'Outro')),
  tipo_contrato text not null check (tipo_contrato in ('CLT', 'Freelancer', 'Diária', 'Temporário')),
  documento text,
  contato text,
  salario_base numeric(15,2),
  data_admissao date,
  ativo boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- 6. TABELA DE PAGAMENTOS EXTRAS (STAFF)
-- =====================================================
create table pagamentos_extras (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  conta_origem_id uuid not null references contas_financeiras(id),
  tipo_extra text not null check (tipo_extra in ('Gorjeta', 'Diária', 'Comissão', 'Bonificação', 'Adiantamento')),
  valor numeric(15,2) not null check (valor > 0),
  data_pagamento date not null,
  descricao text,
  status text not null check (status in ('Pendente', 'Pago')) default 'Pago',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- 7. TABELA DE CATEGORIAS DE PRODUTOS (ESTOQUE)
-- =====================================================
create table categorias_produtos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamp with time zone default now()
);

-- =====================================================
-- 8. TABELA DE PRODUTOS (ESTOQUE)
-- =====================================================
create table produtos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  categoria_id uuid references categorias_produtos(id),
  codigo text,
  nome text not null,
  unidade_medida text not null check (unidade_medida in ('UN', 'KG', 'L', 'CX', 'PC')),
  estoque_minimo numeric(10,2) not null default 0,
  estoque_atual numeric(10,2) not null default 0,
  preco_custo_medio numeric(15,2) not null default 0,
  preco_venda numeric(15,2),
  ativo boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(empresa_id, codigo)
);

-- =====================================================
-- 9. TABELA DE MOVIMENTAÇÕES DE ESTOQUE
-- =====================================================
create table movimentacoes_estoque (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete cascade,
  tipo_movimentacao text not null check (tipo_movimentacao in ('Entrada', 'Saída', 'Ajuste', 'Perda')),
  quantidade numeric(10,2) not null,
  preco_unitario numeric(15,2),
  valor_total numeric(15,2),
  data_movimentacao date not null default current_date,
  documento text, -- Nota fiscal, pedido, etc
  observacao text,
  created_at timestamp with time zone default now()
);

-- =====================================================
-- 10. TABELA DE CATEGORIAS DE RECEITAS
-- =====================================================
create table categorias_receitas (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  nome text not null,
  grupo text not null check (grupo in ('Operacional', 'Financeira', 'Extraordinária')),
  ativo boolean not null default true,
  created_at timestamp with time zone default now()
);

-- =====================================================
-- 11. TABELA DE CATEGORIAS DE DESPESAS
-- =====================================================
create table categorias_despesas (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  nome text not null,
  grupo text not null check (grupo in ('Fixa', 'Variável', 'Investimento')),
  ativo boolean not null default true,
  created_at timestamp with time zone default now()
);

-- =====================================================
-- 12. TABELA DE LANÇAMENTOS FINANCEIROS (COM EMPRESA)
-- =====================================================
create table lancamentos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('Receita', 'Despesa', 'Transferência')),
  categoria_id uuid,
  cliente_id uuid references clientes(id),
  fornecedor_id uuid references fornecedores(id),
  conta_origem_id uuid not null references contas_financeiras(id),
  conta_destino_id uuid references contas_financeiras(id),
  valor numeric(15,2) not null check (valor > 0),
  forma_pagamento text,
  status text not null check (status in ('Previsto', 'Realizado', 'Pago', 'Recebido')),
  descricao text,
  observacoes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- 13. TABELA DE CONTAS A PAGAR (COM EMPRESA)
-- =====================================================
create table contas_pagar (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  fornecedor_id uuid references fornecedores(id),
  descricao text not null,
  valor_total numeric(15,2) not null check (valor_total > 0),
  valor_pago numeric(15,2) not null default 0,
  data_emissao date not null,
  data_vencimento date not null,
  data_pagamento date,
  status text not null check (status in ('Em Aberto', 'Pago', 'Atrasado', 'Parcial')),
  categoria_despesa_id uuid references categorias_despesas(id),
  conta_origem_id uuid references contas_financeiras(id),
  numero_parcela integer,
  total_parcelas integer,
  observacoes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- 14. TABELA DE CONTAS A RECEBER (COM EMPRESA)
-- =====================================================
create table contas_receber (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid references clientes(id),
  descricao text not null,
  valor_total numeric(15,2) not null check (valor_total > 0),
  valor_recebido numeric(15,2) not null default 0,
  data_emissao date not null,
  data_vencimento date not null,
  data_recebimento date,
  status text not null check (status in ('Previsto', 'Recebido', 'Atrasado', 'Parcial')),
  categoria_receita_id uuid references categorias_receitas(id),
  conta_destino_id uuid references contas_financeiras(id),
  numero_parcela integer,
  total_parcelas integer,
  observacoes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- 15. TABELA DE FECHAMENTOS DE CAIXA
-- =====================================================
create table fechamentos_caixa (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  data_fechamento date not null,
  conta_caixa_id uuid not null references contas_financeiras(id),
  saldo_inicial numeric(15,2) not null,
  total_entradas numeric(15,2) not null default 0,
  total_saidas numeric(15,2) not null default 0,
  total_gorjetas numeric(15,2) not null default 0,
  total_extras_pagos numeric(15,2) not null default 0,
  saldo_final numeric(15,2) not null,
  saldo_esperado numeric(15,2) not null,
  diferenca numeric(15,2) not null default 0,
  deposito_banco_id uuid references contas_financeiras(id),
  valor_depositado numeric(15,2),
  responsavel text,
  observacoes text,
  status text not null check (status in ('Aberto', 'Fechado', 'Conferido')) default 'Aberto',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(empresa_id, conta_caixa_id, data_fechamento)
);

-- =====================================================
-- 16. TABELA DE METAS FINANCEIRAS (COM EMPRESA)
-- =====================================================
create table metas (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  mes integer not null check (mes between 1 and 12),
  ano integer not null,
  meta_receita numeric(15,2),
  meta_despesa numeric(15,2),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(empresa_id, mes, ano)
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================
create index idx_contas_financeiras_empresa on contas_financeiras(empresa_id);
create index idx_clientes_empresa on clientes(empresa_id);
create index idx_fornecedores_empresa on fornecedores(empresa_id);
create index idx_funcionarios_empresa on funcionarios(empresa_id);
create index idx_produtos_empresa on produtos(empresa_id);
create index idx_lancamentos_empresa on lancamentos(empresa_id);
create index idx_lancamentos_data on lancamentos(data);
create index idx_lancamentos_tipo on lancamentos(tipo);
create index idx_lancamentos_status on lancamentos(status);
create index idx_contas_pagar_empresa on contas_pagar(empresa_id);
create index idx_contas_pagar_vencimento on contas_pagar(data_vencimento);
create index idx_contas_pagar_status on contas_pagar(status);
create index idx_contas_receber_empresa on contas_receber(empresa_id);
create index idx_contas_receber_vencimento on contas_receber(data_vencimento);
create index idx_contas_receber_status on contas_receber(status);
create index idx_pagamentos_extras_empresa on pagamentos_extras(empresa_id);
create index idx_pagamentos_extras_funcionario on pagamentos_extras(funcionario_id);
create index idx_movimentacoes_estoque_produto on movimentacoes_estoque(produto_id);
create index idx_fechamentos_caixa_empresa on fechamentos_caixa(empresa_id);
create index idx_fechamentos_caixa_data on fechamentos_caixa(data_fechamento);

-- =====================================================
-- FUNÇÃO PARA ATUALIZAR SALDO DAS CONTAS
-- =====================================================
create or replace function atualizar_saldo_conta()
returns trigger as $$
begin
  -- Se for lançamento realizado/pago/recebido
  if new.status in ('Realizado', 'Pago', 'Recebido') then
    
    -- Se for receita, aumenta saldo
    if new.tipo = 'Receita' and new.conta_origem_id is not null then
      update contas_financeiras 
      set saldo_atual = saldo_atual + new.valor,
          updated_at = now()
      where id = new.conta_origem_id;
    end if;
    
    -- Se for despesa, diminui saldo
    if new.tipo = 'Despesa' and new.conta_origem_id is not null then
      update contas_financeiras 
      set saldo_atual = saldo_atual - new.valor,
          updated_at = now()
      where id = new.conta_origem_id;
    end if;
    
    -- Se for transferência
    if new.tipo = 'Transferência' then
      if new.conta_origem_id is not null then
        update contas_financeiras 
        set saldo_atual = saldo_atual - new.valor,
            updated_at = now()
        where id = new.conta_origem_id;
      end if;
      
      if new.conta_destino_id is not null then
        update contas_financeiras 
        set saldo_atual = saldo_atual + new.valor,
            updated_at = now()
        where id = new.conta_destino_id;
      end if;
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql;

-- =====================================================
-- TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE SALDO
-- =====================================================
create trigger trigger_atualizar_saldo
after insert on lancamentos
for each row
execute function atualizar_saldo_conta();

-- =====================================================
-- FUNÇÃO PARA ATUALIZAR PAGAMENTOS EXTRAS NO SALDO
-- =====================================================
create or replace function atualizar_saldo_pagamento_extra()
returns trigger as $$
begin
  if new.status = 'Pago' then
    update contas_financeiras 
    set saldo_atual = saldo_atual - new.valor,
        updated_at = now()
    where id = new.conta_origem_id;
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger trigger_atualizar_saldo_extra
after insert on pagamentos_extras
for each row
execute function atualizar_saldo_pagamento_extra();

-- =====================================================
-- FUNÇÃO PARA ATUALIZAR ESTOQUE
-- =====================================================
create or replace function atualizar_estoque()
returns trigger as $$
begin
  if new.tipo_movimentacao = 'Entrada' then
    update produtos
    set 
      estoque_atual = estoque_atual + new.quantidade,
      -- Atualiza custo médio ponderado
      preco_custo_medio = ((preco_custo_medio * estoque_atual) + (new.preco_unitario * new.quantidade)) / (estoque_atual + new.quantidade),
      updated_at = now()
    where id = new.produto_id;
  elsif new.tipo_movimentacao in ('Saída', 'Perda') then
    update produtos
    set 
      estoque_atual = estoque_atual - new.quantidade,
      updated_at = now()
    where id = new.produto_id;
  elsif new.tipo_movimentacao = 'Ajuste' then
    update produtos
    set 
      estoque_atual = new.quantidade,
      updated_at = now()
    where id = new.produto_id;
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger trigger_atualizar_estoque
after insert on movimentacoes_estoque
for each row
execute function atualizar_estoque();

-- =====================================================
-- FUNÇÃO PARA CALCULAR VALOR TOTAL DO ESTOQUE
-- =====================================================
create or replace function calcular_valor_estoque(p_empresa_id uuid)
returns numeric as $$
declare
  v_total numeric;
begin
  select coalesce(sum(estoque_atual * preco_custo_medio), 0)
  into v_total
  from produtos
  where empresa_id = p_empresa_id and ativo = true;
  
  return v_total;
end;
$$ language plpgsql;

-- =====================================================
-- FUNÇÃO PARA CALCULAR PROJEÇÃO DE COMPRA (30 DIAS)
-- =====================================================
create or replace function calcular_projecao_compra(p_empresa_id uuid)
returns table(
  produto_id uuid,
  produto_nome text,
  estoque_atual numeric,
  estoque_minimo numeric,
  consumo_medio_diario numeric,
  quantidade_necessaria numeric,
  valor_projetado numeric
) as $$
begin
  return query
  select 
    p.id as produto_id,
    p.nome as produto_nome,
    p.estoque_atual,
    p.estoque_minimo,
    -- Calcula consumo médio dos últimos 30 dias
    coalesce(
      (select sum(quantidade) / 30
       from movimentacoes_estoque me
       where me.produto_id = p.id 
         and me.tipo_movimentacao = 'Saída'
         and me.data_movimentacao >= current_date - interval '30 days'),
      0
    ) as consumo_medio_diario,
    -- Quantidade necessária para 30 dias
    greatest(
      (coalesce(
        (select sum(quantidade) / 30 * 30
         from movimentacoes_estoque me
         where me.produto_id = p.id 
           and me.tipo_movimentacao = 'Saída'
           and me.data_movimentacao >= current_date - interval '30 days'),
        0
      ) + p.estoque_minimo) - p.estoque_atual,
      0
    ) as quantidade_necessaria,
    -- Valor projetado
    greatest(
      (coalesce(
        (select sum(quantidade) / 30 * 30
         from movimentacoes_estoque me
         where me.produto_id = p.id 
           and me.tipo_movimentacao = 'Saída'
           and me.data_movimentacao >= current_date - interval '30 days'),
        0
      ) + p.estoque_minimo) - p.estoque_atual,
      0
    ) * p.preco_custo_medio as valor_projetado
  from produtos p
  where p.empresa_id = p_empresa_id
    and p.ativo = true
    and p.estoque_atual < p.estoque_minimo;
end;
$$ language plpgsql;

-- =====================================================
-- VIEW PARA DASHBOARD MULTIENTIDADE
-- =====================================================
create or replace view dashboard_resumo_empresa as
select
  e.id as empresa_id,
  e.nome as empresa_nome,
  (select sum(saldo_atual) 
   from contas_financeiras cf 
   where cf.empresa_id = e.id and cf.ativo = true) as saldo_total,
  (select count(*) 
   from contas_pagar cp 
   where cp.empresa_id = e.id and cp.status = 'Atrasado') as contas_pagar_atrasadas,
  (select count(*) 
   from contas_receber cr 
   where cr.empresa_id = e.id and cr.status = 'Atrasado') as contas_receber_atrasadas,
  (select sum(valor_total - valor_pago) 
   from contas_pagar cp 
   where cp.empresa_id = e.id and cp.status in ('Em Aberto', 'Atrasado', 'Parcial')) as total_a_pagar,
  (select sum(valor_total - valor_recebido) 
   from contas_receber cr 
   where cr.empresa_id = e.id and cr.status in ('Previsto', 'Atrasado', 'Parcial')) as total_a_receber,
  calcular_valor_estoque(e.id) as valor_estoque
from empresas e
where e.ativo = true;

-- =====================================================
-- VIEW PARA SALDO POR CONTA
-- =====================================================
create or replace view saldos_por_conta as
select
  cf.id,
  cf.empresa_id,
  e.nome as empresa_nome,
  cf.nome as conta_nome,
  cf.tipo as conta_tipo,
  cf.banco,
  cf.saldo_atual,
  cf.ativo
from contas_financeiras cf
join empresas e on e.id = cf.empresa_id
where cf.ativo = true;

-- =====================================================
-- DADOS INICIAIS - EXEMPLO
-- =====================================================

-- Empresas exemplo
insert into empresas (nome, tipo, cnpj) values
  ('Unidade 01 - Centro', 'Unidade Operacional', '12.345.678/0001-01'),
  ('Unidade 02 - Shopping', 'Unidade Operacional', '12.345.678/0002-02'),
  ('Holding Gastronômica', 'Holding', '12.345.678/0003-03');

-- Pegar IDs das empresas
do $$
declare
  v_empresa_id_1 uuid;
  v_empresa_id_2 uuid;
  v_empresa_id_holding uuid;
  v_conta_caixa_1 uuid;
  v_conta_itau_1 uuid;
  v_conta_cef_1 uuid;
  v_categoria_receita_id uuid;
  v_categoria_despesa_id uuid;
  v_categoria_produto_id uuid;
begin
  -- Buscar IDs das empresas
  select id into v_empresa_id_1 from empresas where nome = 'Unidade 01 - Centro';
  select id into v_empresa_id_2 from empresas where nome = 'Unidade 02 - Shopping';
  select id into v_empresa_id_holding from empresas where nome = 'Holding Gastronômica';
  
  -- Contas Financeiras - Unidade 01
  insert into contas_financeiras (empresa_id, nome, tipo, banco, saldo_inicial, saldo_atual) values
    (v_empresa_id_1, 'Caixa Físico', 'Caixa', null, 500, 1200);
  
  insert into contas_financeiras (empresa_id, nome, tipo, banco, saldo_inicial, saldo_atual) values
    (v_empresa_id_1, 'Banco Itaú', 'Banco', 'Itaú', 10000, 15000);
    
  insert into contas_financeiras (empresa_id, nome, tipo, banco, saldo_inicial, saldo_atual) values
    (v_empresa_id_1, 'Caixa Econômica', 'Banco', 'Caixa Econômica Federal', 5000, 8000);
  
  select id into v_conta_caixa_1 from contas_financeiras where empresa_id = v_empresa_id_1 and tipo = 'Caixa';
  select id into v_conta_itau_1 from contas_financeiras where empresa_id = v_empresa_id_1 and banco = 'Itaú';
  select id into v_conta_cef_1 from contas_financeiras where empresa_id = v_empresa_id_1 and banco = 'Caixa Econômica Federal';
  
  -- Contas Financeiras - Unidade 02
  insert into contas_financeiras (empresa_id, nome, tipo, banco, saldo_inicial, saldo_atual) values
    (v_empresa_id_2, 'Caixa Físico', 'Caixa', null, 500, 900),
    (v_empresa_id_2, 'Banco Itaú', 'Banco', 'Itaú', 8000, 12000);
  
  -- Categorias de Receitas (compartilhadas)
  insert into categorias_receitas (empresa_id, nome, grupo) values
    (null, 'Vendas de Alimentos', 'Operacional');
    
  insert into categorias_receitas (empresa_id, nome, grupo) values
    (null, 'Vendas de Bebidas', 'Operacional');
    
  insert into categorias_receitas (empresa_id, nome, grupo) values
    (null, 'Taxa de Serviço (10%)', 'Operacional');
    
  insert into categorias_receitas (empresa_id, nome, grupo) values
    (null, 'Delivery', 'Operacional');
  
  select id into v_categoria_receita_id from categorias_receitas limit 1;
  
  -- Categorias de Despesas (compartilhadas)
  insert into categorias_despesas (empresa_id, nome, grupo) values
    (null, 'Aluguel', 'Fixa');
    
  insert into categorias_despesas (empresa_id, nome, grupo) values
    (null, 'Salários e Encargos', 'Fixa');
    
  insert into categorias_despesas (empresa_id, nome, grupo) values
    (null, 'Energia Elétrica', 'Fixa');
    
  insert into categorias_despesas (empresa_id, nome, grupo) values
    (null, 'Matéria Prima', 'Variável');
    
  insert into categorias_despesas (empresa_id, nome, grupo) values
    (null, 'Comissões e Gorjetas', 'Variável');
    
  insert into categorias_despesas (empresa_id, nome, grupo) values
    (null, 'Equipamentos', 'Investimento');
  
  select id into v_categoria_despesa_id from categorias_despesas limit 1;
  
  -- Funcionários - Unidade 01
  insert into funcionarios (empresa_id, nome, cargo, tipo_contrato, salario_base, data_admissao) values
    (v_empresa_id_1, 'João Silva', 'Garçom', 'CLT', 2000, '2024-01-15'),
    (v_empresa_id_1, 'Maria Santos', 'Atendente', 'CLT', 1800, '2024-02-01'),
    (v_empresa_id_1, 'Pedro Costa', 'Freelancer', 'Freelancer', 0, '2024-03-01'),
    (v_empresa_id_1, 'Ana Oliveira', 'Cozinheiro', 'CLT', 2500, '2024-01-10');
  
  -- Categorias de Produtos
  insert into categorias_produtos (empresa_id, nome, descricao) values
    (v_empresa_id_1, 'Carnes', 'Carnes e proteínas');
    
  insert into categorias_produtos (empresa_id, nome, descricao) values
    (v_empresa_id_1, 'Bebidas', 'Bebidas alcoólicas e não alcoólicas');
    
  insert into categorias_produtos (empresa_id, nome, descricao) values
    (v_empresa_id_1, 'Hortifruti', 'Frutas, legumes e verduras');
    
  insert into categorias_produtos (empresa_id, nome, descricao) values
    (v_empresa_id_1, 'Descartáveis', 'Embalagens e descartáveis');
  
  select id into v_categoria_produto_id from categorias_produtos where empresa_id = v_empresa_id_1 limit 1;
  
  -- Produtos
  insert into produtos (empresa_id, categoria_id, codigo, nome, unidade_medida, estoque_minimo, estoque_atual, preco_custo_medio, preco_venda) values
    (v_empresa_id_1, v_categoria_produto_id, 'P001', 'Picanha', 'KG', 5, 12, 45.00, 89.90),
    (v_empresa_id_1, v_categoria_produto_id, 'P002', 'Cerveja Long Neck', 'UN', 100, 250, 2.50, 8.00),
    (v_empresa_id_1, v_categoria_produto_id, 'P003', 'Alface', 'UN', 10, 25, 1.20, 0),
    (v_empresa_id_1, v_categoria_produto_id, 'P004', 'Embalagem Marmitex', 'UN', 50, 120, 0.50, 0);
  
end $$;

-- =====================================================
-- SETUP COMPLETO!
-- =====================================================
-- Funcionalidades implementadas:
-- 1. ✅ Multi-Empresa (Entidades separadas)
-- 2. ✅ Gestão de Staff com Pagamentos Extras
-- 3. ✅ Contas bancárias com origem obrigatória
-- 4. ✅ Estoque com valor financeiro e projeções
-- 5. ✅ Fechamento de caixa integrado
-- 6. ✅ Dashboard por empresa
-- =====================================================