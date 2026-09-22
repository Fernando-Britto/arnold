import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/membresias
 * Returns list of ACTIVA memberships for form dropdowns
 * Temporary implementation for T-013 (full CRUD in T-016)
 */
export async function GET(request: NextRequest) {
  try {
    const { prisma } = await import("@/lib/db");

    const membresias = await prisma.membresia.findMany({
      where: {
        estado: "ACTIVA",
      },
      select: {
        id: true,
        nombre: true,
        precio: true,
        estado: true,
      },
      orderBy: {
        nombre: "asc",
      },
    });

    return NextResponse.json(membresias, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error fetching membresias";
    return NextResponse.json(
      { code: "INTERNAL_SERVER_ERROR", message },
      { status: 500 }
    );
  }
}
