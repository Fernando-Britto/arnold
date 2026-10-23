import { Cliente, ClienteRepository, CreateClienteResult, type ClienteInput } from "@/domains/cliente/cliente";
import { throwIfNotOk } from "@/utils/api-error";
import { CLAVES, conCache, invalidarCache } from "@/lib/cache-cliente";

/**
 * Cliente input type for create/update operations.
 * Lives in the domain so the repository and the API layer share one shape (`pin` incluido, D-47).
 */
export type { ClienteInput };

/**
 * Handle POST /api/clientes
 * Creates a new cliente
 * @returns CreateClienteResult with Cliente + plaintext tempPassword (ephemeral)
 */
export async function handleClienteCreate(data: ClienteInput): Promise<CreateClienteResult> {
  const clienteRepo = new ClienteRepository();
  return clienteRepo.create({
    nombre: data.nombre,
    dni: data.dni,
    email: data.email,
    telefono: data.telefono,
    membresiaAsignada: data.membresiaAsignada,
    estadoCuenta: data.estadoCuenta,
    pin: data.pin,
  });
}

/**
 * Handle GET /api/clientes
 * Lists all clientes
 */
export async function handleClienteList(): Promise<Cliente[]> {
  const clienteRepo = new ClienteRepository();
  return clienteRepo.list();
}

/**
 * Handle GET /api/clientes/:id
 * Retrieves a single cliente by ID
 */
export async function handleClienteGet(id: string): Promise<Cliente | null> {
  const clienteRepo = new ClienteRepository();
  return clienteRepo.getById(id);
}

/**
 * Handle PUT /api/clientes/:id
 * Updates a cliente
 * AC-007: id and fechaAlta are read-only (never editable)
 */
export async function handleClienteUpdate(
  id: string,
  data: Partial<ClienteInput>
): Promise<Cliente | null> {
  const clienteRepo = new ClienteRepository();
  return clienteRepo.update(id, data);
}

/**
 * Handle DELETE /api/clientes/:id
 * Deletes a cliente
 */
export async function handleClienteDelete(id: string): Promise<void> {
  const clienteRepo = new ClienteRepository();
  return clienteRepo.delete(id);
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for page.tsx)
 * ============================================
 */

/**
 * Client-side API call: fetch all clientes
 */
export function fetchClientes(): Promise<Cliente[]> {
  return conCache(CLAVES.clientes, async () => {
    const response = await fetch("/api/clientes");
    await throwIfNotOk(response, "No se pudieron cargar los clientes");
    return response.json();
  });
}

/**
 * Client-side API call: create a new cliente
 * Adapts API response to standard contract: { cliente, tempPassword }
 * Supports both wrapped format { cliente, tempPassword } and flat format { ...cliente, tempPassword }
 * @returns { cliente, tempPassword } where tempPassword is UNA SOLA VEZ
 */
export async function createCliente(
  data: ClienteInput
): Promise<{ cliente: Cliente; tempPassword: string }> {
  const response = await fetch("/api/clientes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  await throwIfNotOk(response, "No se pudo crear el cliente");

  const json = await response.json();
  invalidarCache(CLAVES.clientes);

  // B1 fix: Support both wrapped { cliente, tempPassword } and flat { ...cliente, tempPassword }
  if (json.cliente) {
    // Already wrapped format
    return json;
  }

  // Flat format: extract tempPassword and drop transport-only fields; the rest is cliente data
  const { tempPassword, ...clienteData } = json;
  delete clienteData.status;
  return {
    cliente: clienteData as Cliente,
    tempPassword,
  };
}

/**
 * Client-side API call: update a cliente
 */
export async function updateCliente(
  id: string,
  data: Partial<ClienteInput>
): Promise<Cliente> {
  const response = await fetch(`/api/clientes/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  await throwIfNotOk(response, "No se pudo actualizar el cliente");
  const cliente = (await response.json()) as Cliente;
  invalidarCache(CLAVES.clientes);
  return cliente;
}

/**
 * Client-side API call: delete a cliente
 */
export async function deleteCliente(id: string): Promise<void> {
  const response = await fetch(`/api/clientes/${id}`, {
    method: "DELETE",
  });
  await throwIfNotOk(response, "No se pudo eliminar el cliente");
  invalidarCache(CLAVES.clientes);
}
