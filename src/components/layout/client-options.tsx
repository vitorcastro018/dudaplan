"use client";

import * as React from "react";

export interface ClientOption {
  id: string;
  name: string;
}

const ClientOptionsContext = React.createContext<ClientOption[]>([]);

/**
 * Os clientes ativos, entregues pelo layout do app.
 *
 * Quase todo formulário (projeto, tarefa, reunião) tem um seletor de cliente;
 * passar a lista por props atravessaria meia dúzia de componentes só para chegar
 * ao `<select>`. O layout já carrega a lista da barra lateral a cada navegação,
 * então esta sai junto, sem consulta extra por página.
 */
export function ClientOptionsProvider({
  clients,
  children,
}: {
  clients: ClientOption[];
  children: React.ReactNode;
}) {
  return <ClientOptionsContext.Provider value={clients}>{children}</ClientOptionsContext.Provider>;
}

export function useClientOptions(): ClientOption[] {
  return React.useContext(ClientOptionsContext);
}

/**
 * O `<select>` de cliente, igual em todos os formulários.
 *
 * Cliente arquivado sai das opções mas o registro continua apontando para ele;
 * sem a entrada extra o formulário desvincularia em silêncio ao salvar.
 */
export function ClientSelectOptions({ value }: { value: string }) {
  const clients = useClientOptions();
  return (
    <>
      <option value="">Sem cliente</option>
      {value && !clients.some((client) => client.id === value) && (
        <option value={value}>Cliente arquivado</option>
      )}
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.name}
        </option>
      ))}
    </>
  );
}
