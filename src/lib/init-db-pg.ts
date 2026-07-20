import { pgQuery } from '../db-pool.js';

export async function initializeDatabase() {
  try {
    const planos = await pgQuery(`SELECT id FROM public.planos_assinatura LIMIT 1`);
    const clientes = await pgQuery(`SELECT id FROM public.clientes_sistema LIMIT 1`);
    const admin = await pgQuery(
      `SELECT id FROM public.clientes_sistema WHERE email = $1 LIMIT 1`,
      ['admin@sisfinance.com'],
    );

    if (clientes.rowCount === 0) {
      return {
        success: false,
        message: 'Tabelas do sistema não encontradas. Importe o dump SQL no Postgres.',
      };
    }

    return {
      success: true,
      message: 'Banco de dados acessível',
      details: {
        planos_criados: (planos.rowCount ?? 0) > 0,
        clientes_sistema_existe: (clientes.rowCount ?? 0) > 0,
        admin_existe: (admin.rowCount ?? 0) > 0,
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
  const status = {
    planos_assinatura: false,
    clientes_sistema: false,
    empresas: false,
    admin_exists: false,
  };

  try {
    const [planos, clientes, empresas, admin] = await Promise.all([
      pgQuery(`SELECT 1 FROM public.planos_assinatura LIMIT 1`),
      pgQuery(`SELECT 1 FROM public.clientes_sistema LIMIT 1`),
      pgQuery(`SELECT 1 FROM public.empresas LIMIT 1`),
      pgQuery(`SELECT 1 FROM public.clientes_sistema WHERE email = $1 LIMIT 1`, [
        'admin@sisfinance.com',
      ]),
    ]);

    status.planos_assinatura = (planos.rowCount ?? 0) > 0;
    status.clientes_sistema = (clientes.rowCount ?? 0) > 0;
    status.empresas = (empresas.rowCount ?? 0) > 0;
    status.admin_exists = (admin.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Erro ao verificar status:', error);
  }

  return status;
}
