import { getAdminClient } from '../supabase-admin.js';

export async function initializeDatabase() {
  const supabase = getAdminClient();

  try {
    const { data: planosExistentes, error: checkPlanosError } = await supabase
      .from('planos_assinatura')
      .select('id')
      .limit(1);

    if (!checkPlanosError && (!planosExistentes || planosExistentes.length === 0)) {
      await supabase.from('planos_assinatura').insert([
        {
          nome: 'Gratuito',
          limite_empresas: 1,
          preco_mensal: 0.0,
          descricao: '1 empresa, recursos básicos',
          recursos: ['Dashboard básico', '1 empresa', 'Suporte por email'],
        },
        {
          nome: 'Iniciante',
          limite_empresas: 3,
          preco_mensal: 97.0,
          descricao: 'Até 3 empresas, recursos intermediários',
          recursos: ['Dashboard completo', 'Até 3 empresas', 'Relatórios básicos', 'Suporte prioritário'],
        },
        {
          nome: 'Profissional',
          limite_empresas: 10,
          preco_mensal: 297.0,
          descricao: 'Até 10 empresas, recursos avançados',
          recursos: ['Dashboard avançado', 'Até 10 empresas', 'Relatórios avançados', 'API Access', 'Suporte 24/7'],
        },
        {
          nome: 'Enterprise',
          limite_empresas: 999999,
          preco_mensal: 997.0,
          descricao: 'Empresas ilimitadas, todos os recursos',
          recursos: [
            'Tudo do Profissional',
            'Empresas ilimitadas',
            'Customizações',
            'Gerente de conta dedicado',
            'SLA garantido',
          ],
        },
      ]);
    }

    const { error: checkClientesError } = await supabase.from('clientes_sistema').select('id').limit(1);

    if (checkClientesError) {
      return {
        success: false,
        message: 'Tabelas do sistema não encontradas. Execute o SQL manualmente no Supabase Dashboard.',
        sql_file: '/supabase-auth-saas-setup.sql',
      };
    }

    const { data: adminExistente } = await supabase
      .from('clientes_sistema')
      .select('*')
      .eq('email', 'admin@sisfinance.com')
      .maybeSingle();

    return {
      success: true,
      message: 'Banco de dados inicializado com sucesso',
      details: {
        planos_criados: !planosExistentes || planosExistentes.length === 0,
        clientes_sistema_existe: !checkClientesError,
        admin_existe: !!adminExistente,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao inicializar banco de dados',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkDatabaseStatus() {
  const supabase = getAdminClient();
  const status = {
    planos_assinatura: false,
    clientes_sistema: false,
    empresas: false,
    admin_exists: false,
  };

  try {
    const { error: planosError } = await supabase.from('planos_assinatura').select('id').limit(1);
    status.planos_assinatura = !planosError;

    const { error: clientesError } = await supabase.from('clientes_sistema').select('id').limit(1);
    status.clientes_sistema = !clientesError;

    const { error: empresasError } = await supabase.from('empresas').select('id').limit(1);
    status.empresas = !empresasError;

    if (status.clientes_sistema) {
      const { data: adminData } = await supabase
        .from('clientes_sistema')
        .select('id')
        .eq('email', 'admin@sisfinance.com')
        .maybeSingle();
      status.admin_exists = !!adminData;
    }
  } catch (error) {
    console.error('Erro ao verificar status:', error);
  }

  return status;
}
