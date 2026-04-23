import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { updateRoomSchema } from './rooms';
import { updateCabinetSchema } from './cabinets';
import { updateDeviceSchema } from './devices';

const FAKE_UUID = '00000000-0000-4000-8000-000000000001';
const FAKE_UUID2 = '00000000-0000-4000-8000-000000000002';

function hasFieldError(error: z.ZodError, field: string) {
  return error.errors.some((detail) => detail.path.includes(field));
}

test('room update schema accepts dataCenterId', () => {
  const parsed = updateRoomSchema.parse({
    id: FAKE_UUID,
    dataCenterId: FAKE_UUID2,
  });

  assert.equal(parsed.id, FAKE_UUID);
  assert.equal(parsed.dataCenterId, FAKE_UUID2);
});

test('room update schema rejects invalid dataCenterId', () => {
  assert.throws(
    () => updateRoomSchema.parse({ id: FAKE_UUID, dataCenterId: 'not-a-uuid' }),
    (error: unknown) => error instanceof z.ZodError && hasFieldError(error, 'dataCenterId'),
  );
});

test('cabinet update schema accepts roomId', () => {
  const parsed = updateCabinetSchema.parse({
    id: FAKE_UUID,
    roomId: FAKE_UUID2,
  });

  assert.equal(parsed.id, FAKE_UUID);
  assert.equal(parsed.roomId, FAKE_UUID2);
});

test('cabinet update schema rejects invalid roomId', () => {
  assert.throws(
    () => updateCabinetSchema.parse({ id: FAKE_UUID, roomId: 'not-a-uuid' }),
    (error: unknown) => error instanceof z.ZodError && hasFieldError(error, 'roomId'),
  );
});

test('device update schema still accepts cabinetId', () => {
  const parsed = updateDeviceSchema.parse({
    id: FAKE_UUID,
    cabinetId: FAKE_UUID2,
  });

  assert.equal(parsed.id, FAKE_UUID);
  assert.equal(parsed.cabinetId, FAKE_UUID2);
});

test('device update schema rejects invalid cabinetId', () => {
  assert.throws(
    () => updateDeviceSchema.parse({ id: FAKE_UUID, cabinetId: 'not-a-uuid' }),
    (error: unknown) => error instanceof z.ZodError && hasFieldError(error, 'cabinetId'),
  );
});
