import { NextRequest, NextResponse } from "next/server";
import { handleEjercicioCreate, handleEjercicioList } from "@/api/ejercicios";
import { RequestWithUser } from "@/lib/auth";

/**
 * POST /api/ejercicios - Create a new ejercicio
 * Requires ADMINISTRADOR or INSTRUCTOR role
 */
export async function POST(request: NextRequest) {
  try {
    // Parse JWT from Authorization header (middleware would set this in real scenario)
    // For now, we'll simulate the request context
    const body = await request.json();

    const ejercicio = await handleEjercicioCreate(body);

    return NextResponse.json(ejercicio, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Map error messages to HTTP status codes and structured responses
    if (message.includes("Validación fallida")) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: message.replace("Validación fallida: ", ""),
        },
        { status: 400 }
      );
    }

    if (message.includes("FORBIDDEN")) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "Se requiere rol de administrador o instructor",
        },
        { status: 403 }
      );
    }

    if (message.includes("NOT_FOUND")) {
      return NextResponse.json(
        {
          code: "NOT_FOUND",
          message: "Ejercicio no encontrado",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        code: "SERVER_ERROR",
        message: "No se pudo procesar la solicitud",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ejercicios - List all ejercicios
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const muscleGroup = searchParams.get("muscleGroup") || undefined;
    const search = searchParams.get("search") || undefined;

    const ejercicios = await handleEjercicioList({
      muscleGroup: muscleGroup || undefined,
      search: search || undefined,
    });

    return NextResponse.json(ejercicios, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        code: "SERVER_ERROR",
        message: "No se pudo obtener ejercicios",
      },
      { status: 500 }
    );
  }
}
