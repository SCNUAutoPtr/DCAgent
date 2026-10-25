import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import type { ErrorCode } from '../contracts/enums';
import type { ErrorBody } from '../contracts/common';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNIQUE_VIOLATION: 409,
  LABEL_NOT_AVAILABLE: 409,
  LABEL_REQUIRED: 409,
  PORT_OCCUPIED: 409,
  PORT_HAS_DEPENDENTS: 409,
  NOT_EMPTY: 409,
  U_SPACE_CONFLICT: 409,
  U_OUT_OF_RANGE: 400,
  IP_OUT_OF_SUBNET: 400,
  IP_CONFLICT: 409,
  TEMPLATE_REVISION_MISMATCH: 409,
  TEMPLATE_CONFLICT: 409,
  INVALID_STATE: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode, message: string, readonly details: unknown = null) {
    super(message);
    this.name = 'AppError';
    this.status = STATUS[code];
  }
}

export const notFound = (what: string, details: unknown = null) => new AppError('NOT_FOUND', `${what} not found`, details);
export const invalid = (message: string, details: unknown = null) => new AppError('VALIDATION_ERROR', message, details);

/** Throws NOT_FOUND when the row is missing; narrows the type otherwise. */
export function must<T>(row: T | null | undefined, what: string, details: unknown = null): T {
  if (row === null || row === undefined) throw notFound(what, details);
  return row;
}

// Native constraint names (see 0001_baseline "-- native constraints") -> error code.
const CONSTRAINT_CODES: Record<string, ErrorCode> = {
  device_u_overlap: 'U_SPACE_CONFLICT',
  label_single_entity: 'LABEL_NOT_AVAILABLE',
  label_void_unbound: 'LABEL_NOT_AVAILABLE',
  module_installed_port: 'INVALID_STATE',
};

function fromMessage(message: string): AppError | null {
  for (const code of ['LABEL_REQUIRED', 'IP_OUT_OF_SUBNET'] as const) {
    const m = new RegExp(`${code}: ([^\\n"]+)`).exec(message);
    if (m) return new AppError(code, m[0], null);
  }
  const c = /violates (?:check|exclusion) constraint \\?"(\w+)\\?"/.exec(message);
  if (c) {
    const name = c[1];
    return new AppError(CONSTRAINT_CODES[name] ?? 'VALIDATION_ERROR', `constraint ${name} violated`, { constraint: name });
  }
  if (/check constraint/i.test(message)) return new AppError('VALIDATION_ERROR', 'constraint violated', null);
  return null;
}

/** Converts any thrown value into an AppError. Unknown errors become INTERNAL. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return new AppError('VALIDATION_ERROR', 'invalid request body', err.issues);
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = (err.meta ?? {}) as { target?: unknown; modelName?: string; field_name?: string; cause?: string };
    const target = Array.isArray(meta.target) ? meta.target.map(String) : typeof meta.target === 'string' ? [meta.target] : [];
    if (err.code === 'P2002') {
      if (meta.modelName === 'CableEndpoint' && target.includes('portId')) {
        return new AppError('PORT_OCCUPIED', 'port already has a cable plugged in', { target });
      }
      if (meta.modelName === 'IpAddress' && (target.includes('address') || target.includes('portId') || target.includes('workstationId'))) {
        return new AppError('IP_CONFLICT', 'ip address conflict', { target });
      }
      return new AppError('UNIQUE_VIOLATION', `duplicate value for ${meta.modelName ?? 'record'}`, { model: meta.modelName ?? null, target });
    }
    if (err.code === 'P2025') return new AppError('NOT_FOUND', meta.cause ?? 'record not found', { model: meta.modelName ?? null });
    if (err.code === 'P2003') {
      // the same code covers "parent missing" on insert/update and "still referenced" (RESTRICT) on delete
      if (/\.delete(Many)?\(\)` invocation/.test(err.message)) {
        return new AppError('NOT_EMPTY', 'record is still referenced', { field: meta.field_name ?? null });
      }
      return new AppError('NOT_FOUND', 'referenced record not found', { field: meta.field_name ?? null });
    }
    const mapped = fromMessage(err.message);
    if (mapped) return mapped;
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError || err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = fromMessage(err.message);
    if (mapped) return mapped;
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return new AppError('VALIDATION_ERROR', 'invalid database request', null);
  }
  if (err instanceof Error) {
    const mapped = fromMessage(err.message);
    if (mapped) return mapped;
  }
  return new AppError('INTERNAL', 'internal error', null);
}

export function errorBody(e: AppError): ErrorBody {
  return { code: e.code, message: e.message, details: e.details ?? null };
}

/** The only error middleware. Response shape is always {code,message,details}. */
export const errorMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  // body-parser errors (malformed JSON, payload too large)
  const status = (err as { status?: number; type?: string }).status;
  if (typeof status === 'number' && status >= 400 && status < 500 && (err as { type?: string }).type) {
    res.status(400).json(errorBody(new AppError('VALIDATION_ERROR', 'malformed request body', null)));
    return;
  }
  const appError = toAppError(err);
  if (appError.code === 'INTERNAL' && process.env.NODE_ENV !== 'test') {
    console.error(`[error] ${req.method} ${req.path}`, err);
  }
  res.status(appError.status).json(errorBody(appError));
};
