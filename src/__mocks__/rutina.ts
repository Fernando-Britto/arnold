import { Rutina, NivelDeDificultad } from "@prisma/client";

/**
 * Mock Rutina with 0 exercises
 * Shape matches API response: Rutina & { _count: { ejercicios: number } }
 */
export const mockRutina: Rutina & { _count: { ejercicios: number } } = {
  id: "rutina-001",
  nombre: "Fuerza Full Body",
  objetivoPrincipal: "Fuerza",
  frecuenciaSemanal: 3,
  duracionEstimada: 60,
  nivelDeDificultad: NivelDeDificultad.BASICO,
  descripcion: "Rutina completa de fuerza para todo el cuerpo",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  _count: { ejercicios: 0 },
};

/**
 * Mock Rutina with 3 exercises
 * Shape matches API response: Rutina & { _count: { ejercicios: number } }
 */
export const mockRutinaWithEjercicios: Rutina & {
  _count: { ejercicios: number };
} = {
  id: "rutina-002",
  nombre: "Hipertrofia Avanzada",
  objetivoPrincipal: "Hipertrofia",
  frecuenciaSemanal: 4,
  duracionEstimada: 90,
  nivelDeDificultad: NivelDeDificultad.AVANZADO,
  descripcion: "Programa de hipertrofia muscular avanzado",
  createdAt: new Date("2024-01-02"),
  updatedAt: new Date("2024-01-02"),
  _count: { ejercicios: 3 },
};
