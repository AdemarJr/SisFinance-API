import { Hono } from 'hono';
import * as kv from '../lib/kv-store.js';
import { initializeDatabase, checkDatabaseStatus } from '../lib/init-db.js';
import { requireAuth } from './auth.js';

export const legacyRoutes = new Hono();

// Health check endpoint
legacyRoutes.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Database initialization endpoint
legacyRoutes.post('/init-db', async (c) => {
  try {
    const result = await initializeDatabase();
    return c.json(result);
  } catch (error) {
    console.error('Erro ao inicializar banco:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// Database status check endpoint
legacyRoutes.get('/db-status', async (c) => {
  try {
    const status = await checkDatabaseStatus();
    return c.json({
      success: true,
      status,
      message: status.clientes_sistema
        ? 'Banco de dados configurado corretamente'
        : 'Tabelas do sistema não encontradas. Execute /init-db ou o SQL manualmente.',
    });
  } catch (error) {
    console.error('Erro ao verificar status do banco:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

legacyRoutes.use('/produtos', requireAuth);
legacyRoutes.use('/produtos/*', requireAuth);
legacyRoutes.use('/movimentacoes', requireAuth);
legacyRoutes.use('/movimentacoes/*', requireAuth);
legacyRoutes.use('/projecao/*', requireAuth);
legacyRoutes.use('/estoque/*', requireAuth);
legacyRoutes.use('/categorias-produtos', requireAuth);
legacyRoutes.use('/categorias-produtos/*', requireAuth);
legacyRoutes.use('/pyroustock/*', requireAuth);

// ========================================
// ENDPOINTS DE ESTOQUE
// ========================================

// 1. Listar produtos por empresa
legacyRoutes.get('/produtos/:empresa_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const produtos = await kv.getByPrefix(`produto:${empresaId}:`);

    return c.json({
      success: true,
      data: produtos,
      total: produtos.length,
    });
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 2. Buscar produto específico
legacyRoutes.get('/produtos/:empresa_id/:produto_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const produtoId = c.req.param('produto_id');
    const key = `produto:${empresaId}:${produtoId}`;
    const produto = await kv.get(key);

    if (!produto) {
      return c.json(
        {
          success: false,
          error: 'Produto não encontrado',
        },
        404,
      );
    }

    return c.json({ success: true, data: produto });
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 3. Criar novo produto
legacyRoutes.post('/produtos', async (c) => {
  try {
    const produto: any = await c.req.json();

    // Validações básicas
    if (!produto.empresa_id || !produto.codigo || !produto.nome) {
      return c.json(
        {
          success: false,
          error: 'Campos obrigatórios: empresa_id, codigo, nome',
        },
        400,
      );
    }

    // Gerar ID se não existir
    if (!produto.id) {
      produto.id = crypto.randomUUID();
    }

    // Valores padrão
    produto.ativo = produto.ativo ?? true;
    produto.estoque_minimo = produto.estoque_minimo ?? 0;
    produto.estoque_atual = produto.estoque_atual ?? 0;
    produto.preco_custo_medio = produto.preco_custo_medio ?? 0;
    produto.preco_venda = produto.preco_venda ?? 0;

    const key = `produto:${produto.empresa_id}:${produto.id}`;
    await kv.set(key, produto);

    return c.json({
      success: true,
      data: produto,
      message: 'Produto criado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 4. Atualizar produto
legacyRoutes.put('/produtos/:empresa_id/:produto_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const produtoId = c.req.param('produto_id');
    const dadosAtualizacao: any = await c.req.json();

    const key = `produto:${empresaId}:${produtoId}`;
    const produtoExistente: any = await kv.get(key);

    if (!produtoExistente) {
      return c.json(
        {
          success: false,
          error: 'Produto não encontrado',
        },
        404,
      );
    }

    // Merge dos dados
    const produtoAtualizado = {
      ...produtoExistente,
      ...dadosAtualizacao,
      id: produtoId, // Garante que o ID não mude
      empresa_id: empresaId, // Garante que a empresa não mude
    };

    await kv.set(key, produtoAtualizado);

    return c.json({
      success: true,
      data: produtoAtualizado,
      message: 'Produto atualizado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 5. Deletar produto
legacyRoutes.delete('/produtos/:empresa_id/:produto_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const produtoId = c.req.param('produto_id');
    const key = `produto:${empresaId}:${produtoId}`;

    const produtoExistente = await kv.get(key);
    if (!produtoExistente) {
      return c.json(
        {
          success: false,
          error: 'Produto não encontrado',
        },
        404,
      );
    }

    await kv.del(key);

    return c.json({
      success: true,
      message: 'Produto deletado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 6. Registrar movimentação de estoque
legacyRoutes.post('/movimentacoes', async (c) => {
  try {
    const mov: any = await c.req.json();

    // Validações
    if (!mov.empresa_id || !mov.produto_id || !mov.tipo_movimentacao || !mov.quantidade) {
      return c.json(
        {
          success: false,
          error: 'Campos obrigatórios: empresa_id, produto_id, tipo_movimentacao, quantidade',
        },
        400,
      );
    }

    // Validar tipo de movimentação
    const tiposValidos = ['Entrada', 'Saída', 'Ajuste', 'Perda'];
    if (!tiposValidos.includes(mov.tipo_movimentacao)) {
      return c.json(
        {
          success: false,
          error: `Tipo de movimentação inválido. Use: ${tiposValidos.join(', ')}`,
        },
        400,
      );
    }

    // Gerar ID da movimentação
    if (!mov.id) {
      mov.id = crypto.randomUUID();
    }

    // Calcular valor total
    mov.valor_total = (mov.quantidade || 0) * (mov.preco_unitario || 0);

    // Buscar produto
    const prodKey = `produto:${mov.empresa_id}:${mov.produto_id}`;
    const produto: any = await kv.get(prodKey);

    if (!produto) {
      return c.json(
        {
          success: false,
          error: 'Produto não encontrado',
        },
        404,
      );
    }

    // Salvar estoque anterior
    const estoqueAnterior = produto.estoque_atual;

    // Atualizar estoque baseado no tipo de movimentação
    if (mov.tipo_movimentacao === 'Entrada') {
      produto.estoque_atual += mov.quantidade;

      // Calcular novo preço de custo médio ponderado
      if (mov.preco_unitario > 0) {
        const valorAnterior = estoqueAnterior * produto.preco_custo_medio;
        const valorNovo = mov.quantidade * mov.preco_unitario;
        const estoqueTotal = produto.estoque_atual;
        produto.preco_custo_medio = (valorAnterior + valorNovo) / estoqueTotal;
      }
    } else if (mov.tipo_movimentacao === 'Saída' || mov.tipo_movimentacao === 'Perda') {
      if (produto.estoque_atual < mov.quantidade) {
        return c.json(
          {
            success: false,
            error: `Estoque insuficiente. Disponível: ${produto.estoque_atual}`,
          },
          400,
        );
      }
      produto.estoque_atual -= mov.quantidade;
    } else if (mov.tipo_movimentacao === 'Ajuste') {
      produto.estoque_atual = mov.quantidade;
    }

    // Salvar movimentação
    const movKey = `movimentacao:${mov.empresa_id}:${mov.id}`;
    await kv.set(movKey, {
      ...mov,
      estoque_anterior: estoqueAnterior,
      estoque_novo: produto.estoque_atual,
      created_at: new Date().toISOString(),
    });

    // Atualizar produto
    await kv.set(prodKey, produto);

    return c.json({
      success: true,
      data: {
        movimentacao: mov,
        produto: produto,
        estoque_anterior: estoqueAnterior,
        estoque_novo: produto.estoque_atual,
      },
      message: 'Movimentação registrada com sucesso',
    });
  } catch (error) {
    console.error('Erro ao registrar movimentação:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 7. Listar movimentações por empresa
legacyRoutes.get('/movimentacoes/:empresa_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const movimentacoes: any[] = await kv.getByPrefix(`movimentacao:${empresaId}:`);

    // Ordenar por data (mais recentes primeiro)
    movimentacoes.sort((a: any, b: any) => {
      const dateA = new Date(a.data_movimentacao || a.created_at);
      const dateB = new Date(b.data_movimentacao || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    return c.json({
      success: true,
      data: movimentacoes,
      total: movimentacoes.length,
    });
  } catch (error) {
    console.error('Erro ao listar movimentações:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 8. Listar movimentações de um produto específico
legacyRoutes.get('/movimentacoes/:empresa_id/:produto_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const produtoId = c.req.param('produto_id');
    const todasMovimentacoes: any[] = await kv.getByPrefix(`movimentacao:${empresaId}:`);

    // Filtrar por produto
    const movimentacoesProduto = todasMovimentacoes.filter((m: any) => m.produto_id === produtoId);

    // Ordenar por data
    movimentacoesProduto.sort((a: any, b: any) => {
      const dateA = new Date(a.data_movimentacao || a.created_at);
      const dateB = new Date(b.data_movimentacao || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    return c.json({
      success: true,
      data: movimentacoesProduto,
      total: movimentacoesProduto.length,
    });
  } catch (error) {
    console.error('Erro ao listar movimentações do produto:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 9. Calcular projeção de compra
legacyRoutes.get('/projecao/:empresa_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const produtos: any[] = await kv.getByPrefix(`produto:${empresaId}:`);
    const todasMovimentacoes: any[] = await kv.getByPrefix(`movimentacao:${empresaId}:`);

    // Calcular consumo médio diário por produto
    const consumoPorProduto: any = {};

    // Data de 30 dias atrás
    const data30DiasAtras = new Date();
    data30DiasAtras.setDate(data30DiasAtras.getDate() - 30);

    todasMovimentacoes.forEach((mov: any) => {
      const dataMov = new Date(mov.data_movimentacao || mov.created_at);
      if (dataMov >= data30DiasAtras) {
        if (mov.tipo_movimentacao === 'Saída' || mov.tipo_movimentacao === 'Perda') {
          if (!consumoPorProduto[mov.produto_id]) {
            consumoPorProduto[mov.produto_id] = [];
          }
          consumoPorProduto[mov.produto_id].push(mov.quantidade);
        }
      }
    });

    // Calcular média
    Object.keys(consumoPorProduto).forEach((produtoId) => {
      const valores = consumoPorProduto[produtoId];
      const soma = valores.reduce((acc: number, val: number) => acc + val, 0);
      consumoPorProduto[produtoId] = soma / 30; // Média diária
    });

    // Gerar projeções para produtos abaixo do mínimo
    const projecoes = produtos
      .filter((p: any) => p.estoque_atual < p.estoque_minimo && p.ativo)
      .map((p: any) => {
        const consumoMedioDiario = consumoPorProduto[p.id] || 2.0; // Padrão: 2 unidades/dia
        const diasProjecao = 30;
        const quantidadeNecessaria =
          p.estoque_minimo - p.estoque_atual + consumoMedioDiario * diasProjecao;

        return {
          produto_id: p.id,
          produto_nome: p.nome,
          produto_codigo: p.codigo,
          estoque_atual: p.estoque_atual,
          estoque_minimo: p.estoque_minimo,
          consumo_medio_diario: Number(consumoMedioDiario.toFixed(2)),
          quantidade_necessaria: Number(quantidadeNecessaria.toFixed(2)),
          valor_projetado: Number((quantidadeNecessaria * p.preco_custo_medio).toFixed(2)),
          preco_unitario: p.preco_custo_medio,
        };
      });

    // Calcular total
    const valorTotal = projecoes.reduce((sum, p) => sum + p.valor_projetado, 0);

    return c.json({
      success: true,
      data: projecoes,
      total_produtos: projecoes.length,
      valor_total_projetado: Number(valorTotal.toFixed(2)),
      dias_projecao: 30,
    });
  } catch (error) {
    console.error('Erro ao calcular projeção:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 10. Estatísticas de estoque
legacyRoutes.get('/estoque/stats/:empresa_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const produtos: any[] = await kv.getByPrefix(`produto:${empresaId}:`);

    const produtosAtivos = produtos.filter((p: any) => p.ativo);

    const stats = {
      total_produtos: produtosAtivos.length,
      valor_total_estoque: produtosAtivos.reduce(
        (sum: number, p: any) => sum + p.estoque_atual * p.preco_custo_medio,
        0,
      ),
      produtos_abaixo_minimo: produtosAtivos.filter((p: any) => p.estoque_atual < p.estoque_minimo)
        .length,
      produtos_zerados: produtosAtivos.filter((p: any) => p.estoque_atual === 0).length,
      produtos_ok: produtosAtivos.filter((p: any) => p.estoque_atual >= p.estoque_minimo).length,
    };

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 11. Listar categorias de produtos
legacyRoutes.get('/categorias-produtos/:empresa_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const categorias = await kv.getByPrefix(`categoria_produto:${empresaId}:`);

    return c.json({
      success: true,
      data: categorias,
      total: categorias.length,
    });
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 12. Criar categoria de produto
legacyRoutes.post('/categorias-produtos', async (c) => {
  try {
    const categoria: any = await c.req.json();

    if (!categoria.empresa_id || !categoria.nome) {
      return c.json(
        {
          success: false,
          error: 'Campos obrigatórios: empresa_id, nome',
        },
        400,
      );
    }

    if (!categoria.id) {
      categoria.id = crypto.randomUUID();
    }

    categoria.ativo = categoria.ativo ?? true;

    const key = `categoria_produto:${categoria.empresa_id}:${categoria.id}`;
    await kv.set(key, categoria);

    return c.json({
      success: true,
      data: categoria,
      message: 'Categoria criada com sucesso',
    });
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// ========================================
// INTEGRAÇÃO PYROUSTOCK
// ========================================

// 1. Salvar API Key do PyrouStock
legacyRoutes.post('/pyroustock/config', async (c) => {
  try {
    const config: any = await c.req.json();

    if (!config.empresa_id || !config.api_key || !config.project_id) {
      return c.json(
        {
          success: false,
          error: 'Campos obrigatórios: empresa_id, api_key, project_id',
        },
        400,
      );
    }

    // Salvar configuração
    const key = `pyroustock_config:${config.empresa_id}`;
    await kv.set(key, {
      empresa_id: config.empresa_id,
      api_key: config.api_key,
      project_id: config.project_id,
      company_id: config.company_id || null,
      nome_integracao: config.nome_integracao || 'PyrouStock',
      sincronizacao_ativa: config.sincronizacao_ativa ?? true,
      ultima_sincronizacao: null,
      created_at: new Date().toISOString(),
    });

    return c.json({
      success: true,
      message: 'Configuração salva com sucesso',
    });
  } catch (error) {
    console.error('Erro ao salvar configuração PyrouStock:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 2. Buscar configuração do PyrouStock
legacyRoutes.get('/pyroustock/config/:empresa_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const key = `pyroustock_config:${empresaId}`;
    const config: any = await kv.get(key);

    if (!config) {
      return c.json(
        {
          success: false,
          error: 'Configuração não encontrada',
        },
        404,
      );
    }

    // Não retornar a API key completa por segurança
    const configSafe = {
      ...config,
      api_key: config.api_key ? '***' + config.api_key.slice(-4) : null,
    };

    return c.json({
      success: true,
      data: configSafe,
    });
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 3. Sincronizar dados do PyrouStock
legacyRoutes.post('/pyroustock/sync', async (c) => {
  try {
    const { empresa_id, start_date, end_date }: any = await c.req.json();

    if (!empresa_id) {
      return c.json(
        {
          success: false,
          error: 'Campo obrigatório: empresa_id',
        },
        400,
      );
    }

    // Buscar configuração
    const configKey = `pyroustock_config:${empresa_id}`;
    const config: any = await kv.get(configKey);

    if (!config) {
      return c.json(
        {
          success: false,
          error: 'Configuração PyrouStock não encontrada. Configure primeiro.',
        },
        404,
      );
    }

    // Construir URL
    const baseUrl = `https://${config.project_id}.supabase.co/functions/v1/make-server-8a20b27d/integration`;
    const params = new URLSearchParams();

    if (config.company_id) params.append('companyId', config.company_id);
    if (start_date) params.append('startDate', start_date);
    if (end_date) params.append('endDate', end_date);

    const url = `${baseUrl}/financial-export?${params.toString()}`;

    // Fazer requisição ao PyrouStock
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.api_key}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao sincronizar PyrouStock:', errorText);
      return c.json(
        {
          success: false,
          error: `Erro ao sincronizar: ${response.status} - ${errorText}`,
        },
        response.status as any,
      );
    }

    const pyrouData: any = await response.json();

    if (!pyrouData.success) {
      return c.json(
        {
          success: false,
          error: 'PyrouStock retornou erro: ' + (pyrouData.error || 'Erro desconhecido'),
        },
        400,
      );
    }

    // Processar e salvar dados
    const resultado: { produtos_sincronizados: number; vendas_sincronizadas: number; caixas_sincronizados: number; erros: string[] } =
      {
        produtos_sincronizados: 0,
        vendas_sincronizadas: 0,
        caixas_sincronizados: 0,
        erros: [],
      };

    // 1. Sincronizar Produtos (Inventory)
    if (pyrouData.inventory && Array.isArray(pyrouData.inventory)) {
      for (const prodPyrou of pyrouData.inventory as any[]) {
        try {
          const produtoKey = `produto_pyrou:${empresa_id}:${prodPyrou.id}`;

          await kv.set(produtoKey, {
            id: prodPyrou.id,
            empresa_id: empresa_id,
            codigo: prodPyrou.id.slice(-8), // Usar últimos 8 chars como código
            nome: prodPyrou.name,
            categoria: prodPyrou.category,
            unidade_medida: prodPyrou.measurementUnit?.toUpperCase() || 'UN',
            estoque_atual: prodPyrou.currentStock,
            estoque_minimo: prodPyrou.minStock,
            preco_custo_medio: prodPyrou.averageCost,
            preco_venda: prodPyrou.sellingPrice,
            margem_lucro: prodPyrou.profitMargin,
            valor_estoque: prodPyrou.stockValue,
            receita_potencial: prodPyrou.potentialRevenue,
            lucro_potencial: prodPyrou.potentialProfit,
            origem: 'pyroustock',
            sincronizado_em: new Date().toISOString(),
          });

          resultado.produtos_sincronizados++;
        } catch (err: any) {
          resultado.erros.push(`Erro ao sincronizar produto ${prodPyrou.name}: ${err.message}`);
        }
      }
    }

    // 2. Sincronizar Vendas (Sales)
    if (pyrouData.sales && Array.isArray(pyrouData.sales)) {
      for (const vendaPyrou of pyrouData.sales as any[]) {
        try {
          const vendaKey = `venda_pyrou:${empresa_id}:${vendaPyrou.id}`;

          await kv.set(vendaKey, {
            id: vendaPyrou.id,
            empresa_id: empresa_id,
            data: vendaPyrou.date,
            total: vendaPyrou.total,
            forma_pagamento: vendaPyrou.paymentMethod,
            custo_total: vendaPyrou.totalCost,
            lucro_total: vendaPyrou.totalProfit,
            margem_lucro: vendaPyrou.profitMargin,
            usuario_id: vendaPyrou.userId,
            usuario_nome: vendaPyrou.userName,
            caixa_id: vendaPyrou.cashierId,
            numero_recibo: vendaPyrou.receiptNumber,
            itens: vendaPyrou.items || [],
            origem: 'pyroustock',
            sincronizado_em: new Date().toISOString(),
          });

          resultado.vendas_sincronizadas++;
        } catch (err: any) {
          resultado.erros.push(`Erro ao sincronizar venda ${vendaPyrou.id}: ${err.message}`);
        }
      }
    }

    // 3. Sincronizar Fechamentos de Caixa
    if (pyrouData.cashierClosures && Array.isArray(pyrouData.cashierClosures)) {
      for (const caixaPyrou of pyrouData.cashierClosures as any[]) {
        try {
          const caixaKey = `caixa_pyrou:${empresa_id}:${caixaPyrou.id}`;

          await kv.set(caixaKey, {
            id: caixaPyrou.id,
            empresa_id: empresa_id,
            data_abertura: caixaPyrou.openDate,
            data_fechamento: caixaPyrou.closeDate,
            duracao: caixaPyrou.duration,
            saldo_abertura: caixaPyrou.openingBalance,
            saldo_fechamento: caixaPyrou.closingBalance,
            total_vendas: caixaPyrou.totalSales,
            total_esperado: caixaPyrou.totalExpected,
            total_contado: caixaPyrou.totalCounted,
            diferenca: caixaPyrou.difference,
            formas_pagamento: caixaPyrou.paymentBreakdown || {},
            retiradas: caixaPyrou.withdrawals || [],
            reforcos: caixaPyrou.reinforcements || [],
            origem: 'pyroustock',
            sincronizado_em: new Date().toISOString(),
          });

          resultado.caixas_sincronizados++;
        } catch (err: any) {
          resultado.erros.push(`Erro ao sincronizar caixa ${caixaPyrou.id}: ${err.message}`);
        }
      }
    }

    // Atualizar última sincronização
    config.ultima_sincronizacao = new Date().toISOString();
    await kv.set(configKey, config);

    return c.json({
      success: true,
      data: {
        ...resultado,
        periodo: pyrouData.period,
        resumo_pyroustock: pyrouData.summary,
      },
      message: `Sincronização concluída: ${resultado.produtos_sincronizados} produtos, ${resultado.vendas_sincronizadas} vendas, ${resultado.caixas_sincronizados} caixas`,
    });
  } catch (error) {
    console.error('Erro ao sincronizar PyrouStock:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 4. Listar produtos sincronizados do PyrouStock
legacyRoutes.get('/pyroustock/produtos/:empresa_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const produtos = await kv.getByPrefix(`produto_pyrou:${empresaId}:`);

    return c.json({
      success: true,
      data: produtos,
      total: produtos.length,
    });
  } catch (error) {
    console.error('Erro ao listar produtos PyrouStock:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 5. Listar vendas sincronizadas do PyrouStock
legacyRoutes.get('/pyroustock/vendas/:empresa_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const vendas: any[] = await kv.getByPrefix(`venda_pyrou:${empresaId}:`);

    // Ordenar por data (mais recentes primeiro)
    vendas.sort((a: any, b: any) => {
      const dateA = new Date(a.data);
      const dateB = new Date(b.data);
      return dateB.getTime() - dateA.getTime();
    });

    return c.json({
      success: true,
      data: vendas,
      total: vendas.length,
    });
  } catch (error) {
    console.error('Erro ao listar vendas PyrouStock:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 6. Listar fechamentos de caixa sincronizados
legacyRoutes.get('/pyroustock/caixas/:empresa_id', async (c) => {
  try {
    const empresaId = c.req.param('empresa_id');
    const caixas: any[] = await kv.getByPrefix(`caixa_pyrou:${empresaId}:`);

    // Ordenar por data de fechamento (mais recentes primeiro)
    caixas.sort((a: any, b: any) => {
      const dateA = new Date(a.data_fechamento);
      const dateB = new Date(b.data_fechamento);
      return dateB.getTime() - dateA.getTime();
    });

    return c.json({
      success: true,
      data: caixas,
      total: caixas.length,
    });
  } catch (error) {
    console.error('Erro ao listar caixas PyrouStock:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// 7. Importar dados do PyrouStock para o sistema financeiro
legacyRoutes.post('/pyroustock/importar', async (c) => {
  try {
    const { empresa_id, tipo, ids }: any = await c.req.json();

    if (!empresa_id || !tipo) {
      return c.json(
        {
          success: false,
          error: 'Campos obrigatórios: empresa_id, tipo',
        },
        400,
      );
    }

    const resultado: { importados: number; erros: string[] } = {
      importados: 0,
      erros: [],
    };

    if (tipo === 'vendas') {
      // Importar vendas como contas a receber
      const vendas = ids
        ? await Promise.all(ids.map((id: string) => kv.get(`venda_pyrou:${empresa_id}:${id}`)))
        : await kv.getByPrefix(`venda_pyrou:${empresa_id}:`);

      for (const venda of vendas as any[]) {
        if (!venda) continue;

        try {
          const contaId = crypto.randomUUID();
          const dataVencimento = new Date(venda.data);

          // Criar conta a receber
          await kv.set(`conta_receber:${empresa_id}:${contaId}`, {
            id: contaId,
            empresa_id: empresa_id,
            cliente_id: null,
            cliente_nome: venda.usuario_nome || 'Cliente PyrouStock',
            descricao: `Venda PyrouStock #${venda.numero_recibo || venda.id.slice(-8)}`,
            valor: venda.total,
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            data_recebimento: dataVencimento.toISOString().split('T')[0], // Já recebido
            status: 'Recebido',
            forma_pagamento: venda.forma_pagamento,
            observacoes: `Importado do PyrouStock. Lucro: R$ ${venda.lucro_total?.toFixed(2)}`,
            origem_pyroustock: true,
            pyroustock_venda_id: venda.id,
            created_at: new Date().toISOString(),
          });

          resultado.importados++;
        } catch (err: any) {
          resultado.erros.push(`Erro ao importar venda ${venda.id}: ${err.message}`);
        }
      }
    } else if (tipo === 'caixas') {
      // Importar fechamentos de caixa como lançamentos
      const caixas = ids
        ? await Promise.all(ids.map((id: string) => kv.get(`caixa_pyrou:${empresa_id}:${id}`)))
        : await kv.getByPrefix(`caixa_pyrou:${empresa_id}:`);

      for (const caixa of caixas as any[]) {
        if (!caixa) continue;

        try {
          const lancamentoId = crypto.randomUUID();
          const dataFechamento = new Date(caixa.data_fechamento);

          // Criar lançamento de receita
          await kv.set(`lancamento:${empresa_id}:${lancamentoId}`, {
            id: lancamentoId,
            empresa_id: empresa_id,
            tipo: 'Receita',
            categoria: 'Vendas',
            descricao: `Fechamento de Caixa PyrouStock (${caixa.duracao})`,
            valor: caixa.total_vendas,
            data: dataFechamento.toISOString().split('T')[0],
            conta_origem_id: null,
            conta_destino_id: null,
            status: 'Efetivado',
            observacoes: `Diferença: R$ ${caixa.diferenca?.toFixed(2)}`,
            origem_pyroustock: true,
            pyroustock_caixa_id: caixa.id,
            created_at: new Date().toISOString(),
          });

          resultado.importados++;
        } catch (err: any) {
          resultado.erros.push(`Erro ao importar caixa ${caixa.id}: ${err.message}`);
        }
      }
    }

    return c.json({
      success: true,
      data: resultado,
      message: `${resultado.importados} ${tipo} importados com sucesso`,
    });
  } catch (error) {
    console.error('Erro ao importar dados PyrouStock:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
