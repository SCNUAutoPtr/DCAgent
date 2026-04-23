import type { APIRequestContext, APIResponse } from '@playwright/test';

const API_BASE_URL = `${process.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1`;

interface ApiCreatePanelInput {
  deviceId: string;
  name: string;
  type: string;
  shortId?: number;
}

interface ApiCreatePortsInput {
  panelId: string;
  count: number;
  prefix?: string;
  useCustomPrefix?: boolean;
}

interface ApiCreatePortInput {
  panelId: string;
  number: string;
  label?: string;
  status?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'FAULTY';
  portType?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

async function readJson<T>(response: APIResponse) {
  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`API ${response.url()} failed: ${response.status()} ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function apiGetDevices(request: APIRequestContext) {
  const response = await request.get(`${API_BASE_URL}/devices`);
  return readJson<any[]>(response);
}

export async function apiGetPanels(request: APIRequestContext) {
  const response = await request.get(`${API_BASE_URL}/panels`);
  return readJson<any[]>(response);
}

export async function apiGetDeviceByName(request: APIRequestContext, name: string) {
  const devices = await apiGetDevices(request);
  return devices.find((device) => device.name === name) ?? null;
}

export async function apiGetPanelByName(request: APIRequestContext, name: string) {
  const panels = await apiGetPanels(request);
  return panels.find((panel) => panel.name === name) ?? null;
}

export async function apiCreatePanel(request: APIRequestContext, input: ApiCreatePanelInput) {
  const response = await request.post(`${API_BASE_URL}/panels/create`, {
    data: input,
  });
  return readJson<any>(response);
}

export async function apiCreatePorts(request: APIRequestContext, input: ApiCreatePortsInput) {
  const response = await request.post(`${API_BASE_URL}/ports/create-bulk`, {
    data: input,
  });
  return readJson<{ count: number }>(response);
}

export async function apiCreatePort(request: APIRequestContext, input: ApiCreatePortInput) {
  const response = await request.post(`${API_BASE_URL}/ports/create`, {
    data: input,
  });
  return readJson<any>(response);
}

export async function apiDeletePanel(request: APIRequestContext, panelId: string) {
  const response = await request.post(`${API_BASE_URL}/panels/delete`, {
    data: { id: panelId },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`API ${response.url()} failed: ${response.status()} ${text}`);
  }
}

export async function apiGetCableEndpointsByShortId(request: APIRequestContext, shortId: number) {
  const response = await request.post(`${API_BASE_URL}/cables/endpoints-by-shortid`, {
    data: { shortId },
  });
  return readJson<any>(response);
}

export async function apiGetPortById(request: APIRequestContext, id: string) {
  const response = await request.post(`${API_BASE_URL}/ports/get`, {
    data: { id },
  });
  return readJson<any>(response);
}
