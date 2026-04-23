process.env.NODE_ENV = 'test';

import type { AddressInfo } from 'node:net';
import { after, before } from 'node:test';
import { createApp } from '../app';

let baseUrl = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

export async function startHttpTestServer() {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error('Test server did not expose an address');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
}

export async function stopHttpTestServer() {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function useHttpTestServer() {
  before(startHttpTestServer);
  after(stopHttpTestServer);
}

export async function getJson(path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return {
    response,
    json: text ? JSON.parse(text) : null,
  };
}

export async function postJson(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    response,
    json: text ? JSON.parse(text) : null,
  };
}

export async function putJson(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    response,
    json: text ? JSON.parse(text) : null,
  };
}

export async function deleteRequest(path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
  });
  const text = await response.text();
  return {
    response,
    json: text ? JSON.parse(text) : null,
  };
}

export function hasFieldError(details: unknown, field: string) {
  return Array.isArray(details) && details.some((detail) => {
    if (!detail || typeof detail !== 'object' || !('path' in detail)) {
      return false;
    }

    const path = (detail as { path?: unknown }).path;
    return Array.isArray(path) && path.includes(field);
  });
}
