import { NextRequest, NextResponse } from "next/server";
import {
  handleRutinaGetRequest,
  handleRutinaUpdateRequest,
  handleRutinaDeleteRequest,
  type GetSuccess,
  type GetError,
  type UpdateSuccess,
  type UpdateError,
  type DeleteSuccess,
  type DeleteError,
} from "@/app/api/rutinas/route";

/**
 * Type guards for discriminated union responses
 * Internal use only, not exported
 */
function isGetSuccess(result: GetSuccess | GetError): result is GetSuccess {
  return "id" in result && !("status" in result) && !("code" in result);
}

function isUpdateSuccess(result: UpdateSuccess | UpdateError): result is UpdateSuccess {
  return "id" in result && (result as any).status === 200;
}

function isDeleteSuccess(result: DeleteSuccess | DeleteError): result is DeleteSuccess {
  return "message" in result && (result as any).status === 204;
}

/**
 * GET /api/rutinas/:id - Get a specific rutina by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const result = await handleRutinaGetRequest(id);

  // If error response (has status and code properties)
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: (result as GetError).code, message: (result as GetError).message },
      { status: (result as GetError).status }
    );
  }

  // Success: return rutina
  return NextResponse.json(result, { status: 200 });
}

/**
 * PUT /api/rutinas/:id - Update a specific rutina
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await request.json();
  const result = await handleRutinaUpdateRequest(id, body);

  // If error response (has status and code properties)
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: (result as UpdateError).code, message: (result as UpdateError).message },
      { status: (result as UpdateError).status }
    );
  }

  // Success: return updated rutina
  return NextResponse.json(result, { status: 200 });
}

/**
 * DELETE /api/rutinas/:id - Delete a specific rutina
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const result = await handleRutinaDeleteRequest(id);

  // If error response (has status and code properties)
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: (result as DeleteError).code, message: (result as DeleteError).message },
      { status: (result as DeleteError).status }
    );
  }

  // Success: return message
  return NextResponse.json(result, { status: 204 });
}
