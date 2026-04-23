import { Prisma } from '@prisma/client';
import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

interface CrudRouteOptions<TSchema extends z.ZodTypeAny> {
  schema: TSchema;
  handler: (input: z.infer<TSchema>, req: Request, res: Response) => Promise<unknown>;
  operation: string;
  successStatus?: number;
}

export function createCrudRoute<TSchema extends z.ZodTypeAny>({
  schema,
  handler,
  operation,
  successStatus = 200,
}: CrudRouteOptions<TSchema>): RequestHandler {
  return async (req, res) => {
    try {
      const input = schema.parse(req.body);
      const result = await handler(input, req, res);
      return res.status(successStatus).json(result);
    } catch (error) {
      return handleCrudRouteError(res, error, operation);
    }
  };
}

export function handleCrudRouteError(res: Response, error: unknown, operation: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: error.errors,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const conflictFields = getConflictFields(error);
      return res.status(409).json({
        error: getUniqueConstraintMessage(conflictFields),
        code: 'UNIQUE_CONSTRAINT',
        conflictFields,
      });
    }

    console.error(`Error in ${operation}:`, error);
    return res.status(500).json({ error: `Failed to ${operation}` });
  }

  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }

  console.error(`Error in ${operation}:`, error);
  return res.status(500).json({ error: `Failed to ${operation}` });
}

function getConflictFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.map((field) => String(field));
  }

  if (typeof target === 'string') {
    return [target];
  }

  return [];
}

function getUniqueConstraintMessage(conflictFields: string[]): string {
  if (conflictFields.length === 1) {
    return `${conflictFields[0]} already exists`;
  }

  if (conflictFields.length > 1) {
    return `${conflictFields.join(', ')} must be unique`;
  }

  return 'Unique constraint violated';
}
