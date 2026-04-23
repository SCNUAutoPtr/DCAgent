import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { handleCrudRouteError } from './crudRouteHandler';

function makeRes() {
  const res: any = {};
  res.status = (code: number) => { res._status = code; return res; };
  res.json = (body: unknown) => { res._body = body; return res; };
  return res;
}

describe('handleCrudRouteError', () => {
  it('maps ZodError to 400 with VALIDATION_ERROR code', () => {
    const schema = z.object({ name: z.string() });
    let zodErr: z.ZodError;
    try { schema.parse({}); } catch (e) { zodErr = e as z.ZodError; }

    const res = makeRes();
    handleCrudRouteError(res, zodErr!, 'test op');

    assert.equal(res._status, 400);
    assert.equal(res._body.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(res._body.details));
  });

  it('maps business Error to 400 with error message', () => {
    const res = makeRes();
    handleCrudRouteError(res, new Error('something went wrong'), 'test op');

    assert.equal(res._status, 400);
    assert.equal(res._body.error, 'something went wrong');
  });

  it('maps Prisma P2002 to 409 with UNIQUE_CONSTRAINT code and conflictFields', () => {
    const prismaErr = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: { target: ['serialNo'] },
    });

    const res = makeRes();
    handleCrudRouteError(res, prismaErr, 'create device');

    assert.equal(res._status, 409);
    assert.equal(res._body.code, 'UNIQUE_CONSTRAINT');
    assert.deepEqual(res._body.conflictFields, ['serialNo']);
    assert.ok(res._body.error.includes('serialNo'));
  });

  it('maps Prisma P2002 with multiple fields to 409', () => {
    const prismaErr = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: { target: ['fieldA', 'fieldB'] },
    });

    const res = makeRes();
    handleCrudRouteError(res, prismaErr, 'create');

    assert.equal(res._status, 409);
    assert.deepEqual(res._body.conflictFields, ['fieldA', 'fieldB']);
  });

  it('maps other Prisma errors to 500', () => {
    const prismaErr = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });

    const res = makeRes();
    handleCrudRouteError(res, prismaErr, 'update device');

    assert.equal(res._status, 500);
  });

  it('maps unknown errors to 500', () => {
    const res = makeRes();
    handleCrudRouteError(res, { weird: true }, 'test op');

    assert.equal(res._status, 500);
  });
});
