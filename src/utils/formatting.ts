/**
 * Formateo de datos para mostrar o para llevarlos al formato que pide la validación (T-023b).
 * Si el valor no encaja, se devuelve tal cual: nunca se inventa un dato.
 */

/** "12345678" → "12.345.678". */
export function formatDNI(dni: string): string {
  const digits = dni.replace(/\D/g, "");
  if (digits.length !== 8) return dni;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
}

/** "3764123456" o "5493764123456" → "+54 9 3764 123456". */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 13 && digits.startsWith("549") ? digits.slice(3) : digits;
  if (national.length !== 10) return phone;
  return `+54 9 ${national.slice(0, 4)} ${national.slice(4)}`;
}

const moneyFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/**
 * Formatea un monto para mostrarlo: redondea al entero más cercano (en Argentina
 * los precios no llevan centavos), agrupa con separadores es-AR y antepone "$ ".
 * Acepta number, string numérico o un `Decimal` de Prisma (cualquier objeto con
 * `toString()`), que se coercionan con `Number(...)`.
 *
 * Ejemplos: `15000` → "$ 15.000"; `15000.6` → "$ 15.001".
 */
export function formatMoney(value: number | string | { toString(): string }): string {
  const rounded = Math.round(Number(value));
  return `$ ${moneyFormatter.format(rounded)}`;
}
