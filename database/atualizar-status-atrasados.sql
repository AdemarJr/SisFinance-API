-- Atualiza status de contas vencidas (substitui RPC do Supabase)
CREATE OR REPLACE FUNCTION public.atualizar_status_atrasados()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.contas_pagar
  SET status = 'Atrasado', updated_at = now()
  WHERE status IN ('Em Aberto', 'Parcial')
    AND data_vencimento < CURRENT_DATE
    AND (valor_pago IS NULL OR valor_pago < valor_total);

  UPDATE public.contas_receber
  SET status = 'Atrasado', updated_at = now()
  WHERE status IN ('Previsto', 'Parcial')
    AND data_vencimento < CURRENT_DATE
    AND (valor_recebido IS NULL OR valor_recebido < valor_total);
END;
$$;
