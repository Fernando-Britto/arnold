import React, { useState, useMemo } from "react";
import { type EstadoCuenta } from "@/domains/cliente/cliente";

export interface ClienteListProps {
  clientes: Array<{
    id: string;
    nombre: string;
    dni: string;
    email: string;
    telefono?: string | null;
    membresiaAsignada: string;
    estadoCuenta: EstadoCuenta;
    fechaAlta: Date;
  }>;
  onModify: (cliente: any) => void;
  onDelete: (id: string) => Promise<void>;
  membresiaLabels?: Record<string, string>;
  isLoading?: boolean;
}

type SortField = "nombre" | "dni" | "email" | "membresiaAsignada" | "estadoCuenta";

function getEstadoCuentaBadgeClass(estado: EstadoCuenta): string {
  switch (estado) {
    case "Activo":
      return "bg-green-100 text-green-800";
    case "Inactivo":
      return "bg-yellow-100 text-yellow-800";
    case "Bloqueado":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function ClienteList({
  clientes,
  onModify,
  onDelete,
  membresiaLabels = {},
  isLoading = false,
}: ClienteListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("nombre");
  const [sortAsc, setSortAsc] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter clientes by search term (nombre, dni, email)
  const filteredClientes = useMemo(() => {
    return clientes.filter((cliente) => {
      const search = searchTerm.toLowerCase();
      return (
        cliente.nombre.toLowerCase().includes(search) ||
        cliente.dni.toLowerCase().includes(search) ||
        cliente.email.toLowerCase().includes(search)
      );
    });
  }, [clientes, searchTerm]);

  // Sort clientes
  const sortedClientes = useMemo(() => {
    const sorted = [...filteredClientes];
    sorted.sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];

      if (sortField === "estadoCuenta") {
        // Maintain a consistent order for estado: Activo > Inactivo > Bloqueado
        const order: Record<EstadoCuenta, number> = {
          Activo: 0,
          Inactivo: 1,
          Bloqueado: 2,
        };
        aVal = order[aVal as EstadoCuenta];
        bVal = order[bVal as EstadoCuenta];
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortAsc
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    });

    return sorted;
  }, [filteredClientes, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que querés eliminar este cliente?")) {
      setDeletingId(id);
      try {
        await onDelete(id);
      } catch (error) {
        console.error("Delete error:", error);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="flex-1 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3">Clientes</h2>
        <input
          type="text"
          placeholder="Buscar por nombre, DNI o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : sortedClientes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {clientes.length === 0
            ? "No hay clientes registrados"
            : "No se encontraron resultados"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left font-semibold">
                  <button
                    onClick={() => handleSort("nombre")}
                    className="flex items-center gap-1 hover:text-blue-600"
                  >
                    Nombre
                    {sortField === "nombre" && (
                      <span>{sortAsc ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-2 text-left font-semibold">
                  <button
                    onClick={() => handleSort("dni")}
                    className="flex items-center gap-1 hover:text-blue-600"
                  >
                    DNI
                    {sortField === "dni" && (
                      <span>{sortAsc ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-2 text-left font-semibold">
                  <button
                    onClick={() => handleSort("email")}
                    className="flex items-center gap-1 hover:text-blue-600"
                  >
                    Email
                    {sortField === "email" && (
                      <span>{sortAsc ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-2 text-left font-semibold">
                  <button
                    onClick={() => handleSort("membresiaAsignada")}
                    className="flex items-center gap-1 hover:text-blue-600"
                  >
                    Membresía
                    {sortField === "membresiaAsignada" && (
                      <span>{sortAsc ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-2 text-left font-semibold">
                  <button
                    onClick={() => handleSort("estadoCuenta")}
                    className="flex items-center gap-1 hover:text-blue-600"
                  >
                    Estado
                    {sortField === "estadoCuenta" && (
                      <span>{sortAsc ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-2 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedClientes.map((cliente) => (
                <tr
                  key={cliente.id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">{cliente.nombre}</td>
                  <td className="px-4 py-3">{cliente.dni}</td>
                  <td className="px-4 py-3">{cliente.email}</td>
                  <td className="px-4 py-3">
                    {membresiaLabels[cliente.membresiaAsignada] ||
                      cliente.membresiaAsignada}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getEstadoCuentaBadgeClass(
                        cliente.estadoCuenta
                      )}`}
                    >
                      {cliente.estadoCuenta}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onModify(cliente)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-3"
                      disabled={deletingId === cliente.id}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(cliente.id)}
                      disabled={deletingId === cliente.id}
                      className="text-red-600 hover:text-red-800 font-medium text-sm disabled:text-gray-400"
                    >
                      {deletingId === cliente.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
