/**
 * Client-side data access for Home_Socio.
 * Re-exports from api-home-socio for a clean public API.
 */

export type {
  PuntoProgresoDTO,
  ProgresoActualDTO,
  HoraOcupacionDTO,
  AforoDTO,
  EjercicioEnRutinaDTO,
  RutinaActivaDTO,
  RachaDTO,
  MembresiaDTO,
  HomeSocioViewModel,
} from "./api-home-socio";

export { fetchHomeSocioData } from "./api-home-socio";
