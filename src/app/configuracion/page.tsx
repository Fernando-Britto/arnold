"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { fetchConfiguracion, guardarConfiguracion } from "@/api/configuracion";
import { handleApiError } from "@/utils/api-error";
import { SectionPageLayout } from "@/components/layout/section-page-layout";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { DispositivosPanel } from "@/components/dispositivos/dispositivos-panel";
import {
  CAMPOS_CONFIGURACION,
  validarCambiosConfiguracion,
  type CampoConfiguracion,
  type CambiosConfiguracion,
} from "@/domains/configuracion/configuracion";
import type { Configuracion } from "@/lib/configuracion";

/** Solo el Administrador abre el panel (D-54 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR"];

type TabId = "parametros" | "dispositivos";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "parametros", label: "Parámetros" },
  { id: "dispositivos", label: "Dispositivos" },
];

type ValorFormulario = string | boolean;
type Formulario = Record<CampoConfiguracion, ValorFormulario>;

/** Agrupación y orden de la pantalla (T-043c). */
const GRUPOS: ReadonlyArray<{ titulo: string; campos: readonly CampoConfiguracion[] }> = [
  { titulo: "Acceso", campos: ["antiPassbackMinutos"] },
  { titulo: "Cuotas", campos: ["periodoGracia", "diaLimitePago", "diaCorteAltaTardia"] },
  { titulo: "Aforo", campos: ["capacidadMaxima", "ventanaAforoMinutos", "diasInactividad"] },
  {
    titulo: "Oferta de reactivación",
    campos: [
      "ofertaReactivacionActiva",
      "diasSinAsistirParaOferta",
      "descuentoReactivacion",
      "enfriamientoOfertaDias",
    ],
  },
];

const ETIQUETAS: Record<CampoConfiguracion, string> = {
  antiPassbackMinutos: "Anti-passback (minutos)",
  periodoGracia: "Período de gracia (días)",
  diaLimitePago: "Día límite de pago",
  diaCorteAltaTardia: "Día de corte por alta tardía",
  capacidadMaxima: "Capacidad máxima",
  ventanaAforoMinutos: "Ventana de aforo (minutos)",
  diasInactividad: "Días de inactividad",
  ofertaReactivacionActiva: "Oferta de reactivación activa",
  diasSinAsistirParaOferta: "Días sin asistir para la oferta",
  descuentoReactivacion: "Descuento de reactivación (%)",
  enfriamientoOfertaDias: "Enfriamiento de la oferta (días)",
};

/** "1–10000" para los campos numéricos; null en el booleano. */
function rangoDe(campo: CampoConfiguracion): string | null {
  const spec = CAMPOS_CONFIGURACION[campo];
  if (spec.tipo === "booleano") return null;
  return `${spec.min}–${spec.max}`;
}

/** Configuración → estado del formulario (los numéricos como texto, para poder editarlos). */
function aFormulario(config: Configuracion): Formulario {
  return {
    antiPassbackMinutos: String(config.antiPassbackMinutos),
    periodoGracia: String(config.periodoGracia),
    diaLimitePago: String(config.diaLimitePago),
    diaCorteAltaTardia: String(config.diaCorteAltaTardia),
    capacidadMaxima: String(config.capacidadMaxima),
    ventanaAforoMinutos: String(config.ventanaAforoMinutos),
    diasInactividad: String(config.diasInactividad),
    ofertaReactivacionActiva: config.ofertaReactivacionActiva,
    diasSinAsistirParaOferta: String(config.diasSinAsistirParaOferta),
    descuentoReactivacion: String(config.descuentoReactivacion),
    enfriamientoOfertaDias: String(config.enfriamientoOfertaDias),
  };
}

/** Valor de input al tipo que valida el dominio. Un número vacío queda NaN y lo rechaza la validación. */
function parsearValor(campo: CampoConfiguracion, valor: ValorFormulario): number | boolean {
  if (CAMPOS_CONFIGURACION[campo].tipo === "booleano") return valor === true;
  const texto = typeof valor === "string" ? valor.trim() : String(valor);
  return texto === "" ? NaN : Number(texto);
}

/**
 * Pantalla "Configuración" (T-043c): muestra los parámetros del sistema agrupados,
 * valida contra los mismos rangos del servidor y guarda solo lo que cambió.
 */
export function ConfiguracionPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const [config, setConfig] = useState<Configuracion | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("parametros");

  const isAuthorized = Boolean(isAuthenticated && user && ALLOWED_ROLES.includes(user.rol));

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (user && !ALLOWED_ROLES.includes(user.rol)) {
      router.push("/home-socio");
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;
    fetchConfiguracion()
      .then((data) => {
        if (cancelled) return;
        setConfig(data);
        setForm(aFormulario(data));
      })
      .catch((err) => {
        if (!cancelled) setError(handleApiError(err, "No se pudo cargar la configuración."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthorized]);

  const handleCambio = (campo: CampoConfiguracion, valor: ValorFormulario) => {
    setForm((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  };

  /** Solo los campos cuyo valor parseado difiere de la configuración cargada. */
  const calcularCambios = (): CambiosConfiguracion => {
    if (!config || !form) return {};
    const cambios: CambiosConfiguracion = {};
    for (const campo of Object.keys(CAMPOS_CONFIGURACION) as CampoConfiguracion[]) {
      const valor = parsearValor(campo, form[campo]);
      if (valor !== config[campo]) cambios[campo] = valor;
    }
    return cambios;
  };

  const handleGuardar = async () => {
    if (!config || !form) return;
    setError(null);

    const cambios = calcularCambios();
    if (Object.keys(cambios).length === 0) {
      notify("info", "No hay cambios para guardar.");
      return;
    }

    const validado = validarCambiosConfiguracion(cambios);
    if (!validado.ok) {
      setError(validado.message);
      return;
    }

    setGuardando(true);
    try {
      const actualizada = await guardarConfiguracion(validado.cambios);
      setConfig(actualizada);
      setForm(aFormulario(actualizada));
      notify("success", "Configuración guardada.");
    } catch (err) {
      setError(handleApiError(err, "No se pudo guardar la configuración."));
    } finally {
      setGuardando(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleGuardar();
  };

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Acceso Denegado</h1>
          <p className="text-gray-600">No tenés permiso para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <SectionPageLayout breadcrumb="Configuración" activeSection="configuracion">
      <h1 className="sr-only">Configuración</h1>

      <Tabs
        tabs={[...TABS]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      >
        {activeTab === "parametros" ? (
          <TabPanel id="parametros">
            {error && (
              <p
                role="alert"
                className="w-full max-w-lg rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {loading ? (
              <p className="text-gray-500">Cargando la configuración...</p>
            ) : form ? (
              <form
                onSubmit={handleSubmit}
                className="flex w-full max-w-lg flex-col gap-6 rounded-lg border border-[#E4E4E7] bg-white p-6"
              >
                {GRUPOS.map((grupo) => (
                  <section key={grupo.titulo} className="flex flex-col gap-4">
                    <h2 className="text-sm font-bold text-zinc-900">{grupo.titulo}</h2>
                    {grupo.campos.map((campo) => {
                      const spec = CAMPOS_CONFIGURACION[campo];
                      const rango = rangoDe(campo);

                      if (spec.tipo === "booleano") {
                        return (
                          <div key={campo} className="flex items-center gap-2">
                            <input
                              id={campo}
                              name={campo}
                              data-testid={`campo-${campo}`}
                              type="checkbox"
                              checked={form[campo] === true}
                              onChange={(event) => handleCambio(campo, event.target.checked)}
                              className="h-4 w-4"
                            />
                            <label htmlFor={campo} className="text-sm font-medium text-gray-700">
                              {ETIQUETAS[campo]}
                            </label>
                          </div>
                        );
                      }

                      return (
                        <div key={campo} className="flex flex-col gap-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <label htmlFor={campo} className="text-sm font-medium text-gray-700">
                              {ETIQUETAS[campo]}
                            </label>
                            {rango && <span className="text-xs text-zinc-400">{rango}</span>}
                          </div>
                          <input
                            id={campo}
                            name={campo}
                            data-testid={`campo-${campo}`}
                            type="number"
                            step={spec.tipo === "decimal" ? "0.01" : "1"}
                            value={String(form[campo])}
                            onChange={(event) => handleCambio(campo, event.target.value)}
                            className="rounded-md border border-[#E4E4E7] px-3 py-2 text-sm"
                          />
                        </div>
                      );
                    })}
                  </section>
                ))}

                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded bg-[#FC4C02] px-4 py-2 font-medium text-white hover:bg-[#C13D00] disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </form>
            ) : null}
          </TabPanel>
        ) : (
          <TabPanel id="dispositivos">
            <DispositivosPanel />
          </TabPanel>
        )}
      </Tabs>
    </SectionPageLayout>
  );
}

export default ConfiguracionPage;
