import { message } from 'antd';
import type { ErrorBody } from '@contracts/common';
import { ERROR_CODES, type ErrorCode } from '@contracts/enums';
import i18n from '@/i18n';

/** Request body type of a zod schema from @contracts (its input side, before defaults/transforms). */
export type In<S> = S extends { _input: infer I } ? I : never;

type Resource =
  | 'datacenters'
  | 'rooms'
  | 'cabinets'
  | 'devices'
  | 'device-models'
  | 'panels'
  | 'ports'
  | 'cables'
  | 'labels'
  | 'optical-modules'
  | 'subnets'
  | 'ip-addresses'
  | 'workstations'
  | 'observability'
  | 'panel-templates'
  | 'search'
  | 'dashboard';

/** Every call is POST /api/v1/<resource>/<action>; ids and filters always travel in the body. */
export type RpcPath = `${Resource}/${string}`;

export type ApiErrorCode = ErrorCode | 'NETWORK';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RpcOptions {
  /** Do not show the error toast; the caller handles the error itself. */
  silent?: boolean;
}

const isErrorBody = (v: unknown): v is ErrorBody =>
  typeof v === 'object' && v !== null && typeof (v as ErrorBody).code === 'string' && (ERROR_CODES as readonly string[]).includes((v as ErrorBody).code);

function names(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'object' && x !== null ? (x as { name?: unknown; number?: unknown }).name ?? (x as { number?: unknown }).number : x))
    .filter((x): x is string => typeof x === 'string');
}

/** Short, translated hint built from the error details (fields of a unique violation, items blocking a delete...). */
function detailHint(err: ApiError): string {
  const d = err.details;
  if (!d || typeof d !== 'object') return '';
  if (Array.isArray(d)) {
    // zod issues
    const fields = d
      .map((i) => (Array.isArray((i as { path?: unknown }).path) ? (i as { path: unknown[] }).path.join('.') : ''))
      .filter(Boolean);
    return fields.length ? i18n.t('errors:detail.field', { fields: [...new Set(fields)].join(', ') }) : '';
  }
  const rec = d as Record<string, unknown>;
  if (Array.isArray(rec.target) && rec.target.length) return i18n.t('errors:detail.field', { fields: rec.target.join(', ') });
  const items = Object.values(rec).flatMap(names);
  return items.length ? i18n.t('errors:detail.items', { items: items.slice(0, 5).join(', ') + (items.length > 5 ? ' ...' : '') }) : '';
}

/** Translated text for any error thrown by rpc (or anything else). */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const hint = detailHint(err);
    return `${i18n.t(`errors:${err.code}`)}${hint ? ` (${hint})` : ''}`;
  }
  return i18n.t('errors:INTERNAL');
}

async function post(path: RpcPath, body: unknown): Promise<Response> {
  try {
    return await fetch(`/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch (e) {
    throw new ApiError('NETWORK', e instanceof Error ? e.message : 'network error', 0, null);
  }
}

async function fail(res: Response): Promise<never> {
  const json: unknown = await res.json().catch(() => null);
  if (isErrorBody(json)) throw new ApiError(json.code, json.message, res.status, json.details);
  throw new ApiError(res.status >= 500 || res.status === 0 ? 'INTERNAL' : 'NETWORK', res.statusText, res.status, null);
}

async function call<T>(path: RpcPath, body: unknown, opts: RpcOptions, read: (res: Response) => Promise<T>): Promise<T> {
  try {
    const res = await post(path, body);
    if (!res.ok) await fail(res);
    return await read(res);
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError('INTERNAL', e instanceof Error ? e.message : String(e), 0, null);
    if (!opts.silent) message.error(errorText(err));
    throw err;
  }
}

/**
 * The only way the frontend talks to the backend. On failure it shows the translated error
 * ({code,message,details} -> errors:<code>) and rethrows an ApiError.
 */
export function rpc<Req, Res>(path: RpcPath, body: Req, opts: RpcOptions = {}): Promise<Res> {
  return call(path, body, opts, (res) => res.json() as Promise<Res>);
}

/** Same as rpc, for actions that answer with a file (CSV export). */
export function rpcBlob<Req>(path: RpcPath, body: Req, opts: RpcOptions = {}): Promise<Blob> {
  return call(path, body, opts, (res) => res.blob());
}

/** Saves a blob as a file in the browser. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
