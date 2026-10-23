import React from "react";

/**
 * Chrome compartido por las dos navegaciones (socio y gestión).
 *
 * Antes `top-nav.tsx` y `admin-top-nav.tsx` repetían el mismo header con valores
 * distintos en cada copia: dos sombras, dos formas de botón de ícono y dos colores
 * de link activo. Este es el único lugar donde viven esas decisiones.
 * Spec: odd/tasks/design-alignment.md §Chrome.
 */
export function NavShell({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex h-20 items-center justify-between bg-surface px-12 shadow-header">
      <div className="flex items-center">
        <span className="text-xl font-bold text-ink">ARNOLD</span>
        <span className="text-xl font-bold text-brand">GYM</span>
      </div>
      {children}
    </header>
  );
}

/** Clases del label de un link de nav. El activo se marca en naranja en ambas navs. */
export function navLinkLabelClass(isActive: boolean): string {
  return `text-[15px] ${isActive ? "font-bold text-brand-strong" : "font-medium text-ink-muted"}`;
}

/**
 * Zona del menú: etiqueta opcional arriba y sus destinos en una fila.
 * Compartida por las dos navs para que el agrupado se vea igual en todo el producto.
 */
export function NavCluster({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-end gap-1">
      {label && (
        <p className="text-overline font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      )}
      <div className="flex items-center gap-5">{children}</div>
    </div>
  );
}

/** Separador vertical de 1px entre zonas. */
export function NavDivider() {
  return <span aria-hidden="true" className="mb-1 h-8 w-px bg-border" />;
}

/** Subrayado del link activo. */
export function NavLinkUnderline() {
  return <span aria-hidden="true" className="h-0.5 w-6 rounded-sm bg-brand" />;
}

interface NavIconButtonProps {
  /** Nombre accesible del botón. */
  label: string;
  /** Por qué está deshabilitado; se muestra como tooltip. */
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
  /** Vacío para el placeholder de perfil, que todavía no tiene ícono ni destino. */
  children?: React.ReactNode;
}

/** Botón cuadrado de 40px para los íconos de la derecha del header. */
export function NavIconButton({
  label,
  title,
  disabled = false,
  onClick,
  children,
}: NavIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle text-ink-muted enabled:hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
