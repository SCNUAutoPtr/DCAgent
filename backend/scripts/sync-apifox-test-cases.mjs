#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const workspaceDir = path.resolve(backendDir, '..');

const CASE_FILE_PATH = path.join(backendDir, 'apifox-cases.postman.json');
const SAMPLE_UUID = '11111111-1111-4111-8111-111111111111';
const MISSING_UUID = '00000000-0000-4000-8000-999999999999';
const COLLECTION_NAME = '默认模块';

const COLLECTION_VARIABLES = [
  { key: 'baseUrl', value: 'http://localhost:3000', type: 'string' },
  { key: 'dataCenterId', value: '11111111-1111-4111-8111-111111111111', type: 'string' },
  { key: 'roomId', value: '22222222-2222-4222-8222-222222222222', type: 'string' },
  { key: 'cabinetId', value: '33333333-3333-4333-8333-333333333333', type: 'string' },
  { key: 'deviceId', value: '44444444-4444-4444-8444-444444444444', type: 'string' },
  { key: 'panelId', value: '55555555-5555-4555-8555-555555555555', type: 'string' },
  { key: 'portId', value: '66666666-6666-4666-8666-666666666666', type: 'string' },
  { key: 'cableId', value: '77777777-7777-4777-8777-777777777777', type: 'string' },
  { key: 'templateId', value: '88888888-8888-4888-8888-888888888888', type: 'string' },
  { key: 'subnetId', value: '99999999-9999-4999-8999-999999999999', type: 'string' },
  { key: 'ipAddressId', value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'string' },
  { key: 'moduleId', value: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', type: 'string' },
  { key: 'workstationId', value: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', type: 'string' },
  { key: 'printTaskId', value: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', type: 'string' },
  { key: 'missingUuid', value: MISSING_UUID, type: 'string' },
  { key: 'shortId', value: '10001', type: 'string' },
  { key: 'missingShortId', value: '999999', type: 'string' },
  { key: 'workstationCode', value: 'WS-001', type: 'string' },
  { key: 'missingWorkstationCode', value: 'WS-404', type: 'string' },
  { key: 'moduleSerialNo', value: 'SFP-001', type: 'string' },
  { key: 'missingModuleSerialNo', value: 'SFP-404', type: 'string' },
];

function parseArgValue(flag) {
  const inline = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) {
    return inline.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  return undefined;
}

function loadApifoxConfigFromMcp() {
  const mcpPath = path.join(workspaceDir, '.mcp.json');

  if (!fs.existsSync(mcpPath)) {
    return {};
  }

  try {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    const servers = Object.values(mcpConfig.mcpServers || {});

    for (const server of servers) {
      if (!server || !Array.isArray(server.args)) {
        continue;
      }

      const usesApifox = server.args.some((arg) => typeof arg === 'string' && arg.includes('apifox-mcp-server'));
      if (!usesApifox) {
        continue;
      }

      const projectArg = server.args.find((arg) => typeof arg === 'string' && arg.startsWith('--project-id='));
      const projectId = projectArg ? projectArg.split('=')[1] : undefined;
      const accessToken = server.env?.APIFOX_ACCESS_TOKEN;

      return { projectId, accessToken };
    }
  } catch (error) {
    console.warn(`Failed to read ${mcpPath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {};
}

function loadOpenApiSpec() {
  const specPath = path.join(backendDir, 'openapi.json');
  if (!fs.existsSync(specPath)) {
    throw new Error(`Missing ${specPath}. Run npm run openapi:generate first.`);
  }

  return JSON.parse(fs.readFileSync(specPath, 'utf8'));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveSchema(schema, openapiSpec) {
  if (!schema) {
    return undefined;
  }

  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    return resolveSchema(openapiSpec.components?.schemas?.[name], openapiSpec);
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return resolveSchema(schema.oneOf[0], openapiSpec);
  }

  return schema;
}

function getSuccessResponse(operation) {
  const candidates = Object.entries(operation.responses || {})
    .filter(([status]) => /^2\d\d$/.test(status))
    .sort(([left], [right]) => Number(left) - Number(right));

  return candidates.length > 0 ? { status: candidates[0][0], response: candidates[0][1] } : null;
}

function getJsonRequestSchema(operation, openapiSpec) {
  const schema = operation.requestBody?.content?.['application/json']?.schema;
  return resolveSchema(schema, openapiSpec);
}

function getJsonResponseSchema(response, openapiSpec) {
  const schema = response?.content?.['application/json']?.schema;
  return resolveSchema(schema, openapiSpec);
}

function getTopLevelFolder(operation) {
  if (Array.isArray(operation.tags) && operation.tags.length > 0) {
    return operation.tags[0];
  }

  return 'System';
}

function slugifyPath(pathname) {
  return pathname
    .replace(/^\//, '')
    .replace(/[{}]/g, '')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9:-]/g, '-');
}

function resourceVariableFromPath(pathname) {
  if (pathname.includes('/datacenters')) {
    return 'dataCenterId';
  }
  if (pathname.includes('/rooms')) {
    return 'roomId';
  }
  if (pathname.includes('/cabinets')) {
    return 'cabinetId';
  }
  if (pathname.includes('/devices')) {
    return 'deviceId';
  }
  if (pathname.includes('/panels')) {
    return 'panelId';
  }
  if (pathname.includes('/ports')) {
    return 'portId';
  }
  if (pathname.includes('/cables')) {
    return 'cableId';
  }
  if (pathname.includes('/panel-templates')) {
    return 'templateId';
  }
  if (pathname.includes('/optical-modules')) {
    return 'moduleId';
  }
  if (pathname.includes('/subnets')) {
    return 'subnetId';
  }
  if (pathname.includes('/ip-addresses')) {
    return 'ipAddressId';
  }
  if (pathname.includes('/workstations')) {
    return 'workstationId';
  }
  if (pathname.includes('/shortid-pool')) {
    return 'printTaskId';
  }

  return 'missingUuid';
}

function sampleStringByName(propertyName, pathname, mode = 'valid') {
  if (mode === 'missing') {
    if (propertyName === 'code') {
      return '{{missingWorkstationCode}}';
    }
    if (propertyName === 'serialNo') {
      return '{{missingModuleSerialNo}}';
    }
    return '{{missingUuid}}';
  }

  switch (propertyName) {
    case 'id':
      return `{{${resourceVariableFromPath(pathname)}}}`;
    case 'dataCenterId':
      return '{{dataCenterId}}';
    case 'roomId':
      return '{{roomId}}';
    case 'cabinetId':
      return '{{cabinetId}}';
    case 'deviceId':
      return '{{deviceId}}';
    case 'panelId':
      return '{{panelId}}';
    case 'portId':
      return '{{portId}}';
    case 'cableId':
      return '{{cableId}}';
    case 'templateId':
    case 'panelTemplateId':
      return '{{templateId}}';
    case 'subnetId':
      return '{{subnetId}}';
    case 'ipAddressId':
      return '{{ipAddressId}}';
    case 'moduleId':
      return '{{moduleId}}';
    case 'workstationId':
      return '{{workstationId}}';
    case 'printTaskId':
      return '{{printTaskId}}';
    case 'shortId':
      return '{{shortId}}';
    case 'code':
      return '{{workstationCode}}';
    case 'serialNo':
      return '{{moduleSerialNo}}';
    case 'hostname':
      return 'dcagent-host-01';
    case 'macAddress':
      return 'AA:BB:CC:DD:EE:FF';
    case 'ipAddress':
    case 'gateway':
    case 'address':
      return '10.0.0.10';
    case 'network':
      return '10.0.0.0';
    case 'query':
    case 'search':
      return 'core';
    case 'vendor':
      return 'Cisco';
    case 'operator':
      return 'apifox';
    case 'name':
      return '示例资源';
    case 'label':
      return 'CORE-LINK';
    case 'position':
      return 'A1';
    case 'floor':
      return '3F';
    case 'panelName':
      return '新增面板';
    default:
      if (propertyName.toLowerCase().includes('date')) {
        return '2026-04-23T00:00:00.000Z';
      }
      if (propertyName.toLowerCase().includes('color')) {
        return '#336699';
      }
      if (propertyName.toLowerCase().includes('path')) {
        return '/assets/example.svg';
      }
      if (propertyName.toLowerCase().includes('url')) {
        return 'https://example.com';
      }
      return `${propertyName || 'value'}-example`;
  }
}

function sampleNumberByName(propertyName, schema) {
  if (propertyName === 'page') {
    return 1;
  }
  if (propertyName === 'pageSize') {
    return 20;
  }
  if (propertyName === 'count') {
    return 2;
  }
  if (propertyName === 'cidr') {
    return 24;
  }
  if (propertyName === 'shortId') {
    return 10001;
  }
  if (propertyName.toLowerCase().includes('height')) {
    return 42;
  }
  if (propertyName.toLowerCase().includes('width')) {
    return 1200;
  }
  if (propertyName.toLowerCase().includes('position')) {
    return 1;
  }
  if (typeof schema.minimum === 'number') {
    return schema.minimum > 0 ? schema.minimum : Math.max(1, schema.minimum);
  }

  return schema.type === 'number' ? 1.5 : 1;
}

function sampleValueFromSchema(schema, openapiSpec, pathname, propertyName = '', options = {}) {
  const resolved = resolveSchema(schema, openapiSpec);
  if (!resolved) {
    return null;
  }

  if (Array.isArray(resolved.oneOf) && resolved.oneOf.length > 0) {
    return sampleValueFromSchema(resolved.oneOf[0], openapiSpec, pathname, propertyName, options);
  }

  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) {
    return resolved.enum[0];
  }

  switch (resolved.type) {
    case 'string':
      if (resolved.format === 'uuid') {
        return sampleStringByName(propertyName || 'id', pathname, options.mode);
      }
      if (resolved.format === 'date-time') {
        return '2026-04-23T00:00:00.000Z';
      }
      return sampleStringByName(propertyName, pathname, options.mode);
    case 'integer':
    case 'number':
      return sampleNumberByName(propertyName, resolved);
    case 'boolean':
      return true;
    case 'array':
      return [sampleValueFromSchema(resolved.items, openapiSpec, pathname, propertyName, options)];
    case 'object': {
      const result = {};
      const properties = resolved.properties || {};
      const required = resolved.required && resolved.required.length > 0
        ? resolved.required
        : Object.keys(properties).slice(0, Math.min(Object.keys(properties).length, 3));

      for (const key of required) {
        if (!properties[key]) {
          continue;
        }
        result[key] = sampleValueFromSchema(properties[key], openapiSpec, pathname, key, options);
      }

      if (Object.keys(result).length === 0) {
        return {};
      }

      return result;
    }
    default:
      return null;
  }
}

function buildValidRequestBody(operation, openapiSpec, pathname) {
  const requestSchema = getJsonRequestSchema(operation, openapiSpec);
  if (!requestSchema) {
    return undefined;
  }

  return sampleValueFromSchema(requestSchema, openapiSpec, pathname);
}

function findInvalidMutation(schema, openapiSpec, pathStack = []) {
  const resolved = resolveSchema(schema, openapiSpec);
  if (!resolved) {
    return null;
  }

  if (Array.isArray(resolved.oneOf) && resolved.oneOf.length > 0) {
    return findInvalidMutation(resolved.oneOf[0], openapiSpec, pathStack);
  }

  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) {
    return { path: pathStack, value: 'BAD_VALUE' };
  }

  if (resolved.type === 'string') {
    if (resolved.format === 'uuid') {
      return { path: pathStack, value: 'bad-id' };
    }
    if (resolved.minLength && resolved.minLength > 0) {
      return { path: pathStack, value: '' };
    }
  }

  if ((resolved.type === 'integer' || resolved.type === 'number') && typeof resolved.minimum === 'number' && resolved.minimum > 0) {
    return { path: pathStack, value: 0 };
  }

  if (resolved.type === 'array' && resolved.items) {
    return findInvalidMutation(resolved.items, openapiSpec, [...pathStack, 0]);
  }

  if (resolved.type === 'object') {
    for (const [key, childSchema] of Object.entries(resolved.properties || {})) {
      const candidate = findInvalidMutation(childSchema, openapiSpec, [...pathStack, key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function setDeepValue(target, pathStack, value) {
  let current = target;

  for (let index = 0; index < pathStack.length - 1; index += 1) {
    current = current[pathStack[index]];
  }

  current[pathStack[pathStack.length - 1]] = value;
}

function buildInvalidRequestBody(operation, openapiSpec, pathname) {
  const requestSchema = getJsonRequestSchema(operation, openapiSpec);
  if (!requestSchema) {
    return undefined;
  }

  const validBody = buildValidRequestBody(operation, openapiSpec, pathname);
  if (validBody === undefined) {
    return undefined;
  }

  const mutation = findInvalidMutation(requestSchema, openapiSpec);
  if (!mutation || mutation.path.length === 0) {
    return undefined;
  }

  const invalidBody = cloneJson(validBody);
  setDeepValue(invalidBody, mutation.path, mutation.value);
  return invalidBody;
}

function findRequiredFieldOmission(schema, openapiSpec, pathStack = []) {
  const resolved = resolveSchema(schema, openapiSpec);
  if (!resolved) {
    return null;
  }

  if (Array.isArray(resolved.oneOf) && resolved.oneOf.length > 0) {
    return findRequiredFieldOmission(resolved.oneOf[0], openapiSpec, pathStack);
  }

  if (resolved.type === 'object') {
    const required = resolved.required || [];
    for (const key of required) {
      if (!resolved.properties?.[key]) {
        continue;
      }
      return [...pathStack, key];
    }

    for (const [key, childSchema] of Object.entries(resolved.properties || {})) {
      const nestedPath = findRequiredFieldOmission(childSchema, openapiSpec, [...pathStack, key]);
      if (nestedPath) {
        return nestedPath;
      }
    }
  }

  if (resolved.type === 'array' && resolved.items) {
    return findRequiredFieldOmission(resolved.items, openapiSpec, [...pathStack, 0]);
  }

  return null;
}

function deleteDeepValue(target, pathStack) {
  let current = target;

  for (let index = 0; index < pathStack.length - 1; index += 1) {
    if (current === null || current === undefined) {
      return false;
    }
    current = current[pathStack[index]];
  }

  const lastKey = pathStack[pathStack.length - 1];
  if (current === null || current === undefined) {
    return false;
  }

  if (Array.isArray(current) && typeof lastKey === 'number') {
    current.splice(lastKey, 1);
    return true;
  }

  delete current[lastKey];
  return true;
}

function buildMissingRequiredRequestBody(operation, openapiSpec, pathname) {
  const requestSchema = getJsonRequestSchema(operation, openapiSpec);
  if (!requestSchema) {
    return undefined;
  }

  const validBody = buildValidRequestBody(operation, openapiSpec, pathname);
  if (validBody === undefined) {
    return undefined;
  }

  const omissionPath = findRequiredFieldOmission(requestSchema, openapiSpec);
  if (!omissionPath || omissionPath.length === 0) {
    return undefined;
  }

  const invalidBody = cloneJson(validBody);
  if (!deleteDeepValue(invalidBody, omissionPath)) {
    return undefined;
  }
  return invalidBody;
}

function buildQueryEntries(parameters, pathname, options = {}) {
  const queryParameters = parameters.filter((parameter) => parameter.in === 'query');
  if (queryParameters.length === 0) {
    return [];
  }

  return queryParameters.map((parameter) => {
    const schema = resolveSchema(parameter.schema, options.openapiSpec);
    const mode = options.mode || 'valid';

    if (mode === 'missing' && parameter.name.toLowerCase().includes('search')) {
      return { key: parameter.name, value: 'missing' };
    }

    const value = sampleValueFromSchema(schema, options.openapiSpec, pathname, parameter.name, { mode });
    return { key: parameter.name, value: String(value) };
  });
}

function buildPathVariableEntries(parameters, pathname, options = {}) {
  return parameters
    .filter((parameter) => parameter.in === 'path')
    .map((parameter) => {
      const schema = resolveSchema(parameter.schema, options.openapiSpec);
      const mode = options.mode || 'valid';

      let value;
      if (mode === 'invalid') {
        if (schema?.type === 'string' && schema.format === 'uuid') {
          value = 'bad-id';
        } else if (parameter.name.toLowerCase().includes('shortid')) {
          value = '0';
        } else if (schema?.type === 'integer' || schema?.type === 'number') {
          value = '0';
        } else {
          value = 'bad-value';
        }
      } else if (schema?.type === 'string' && schema.format === 'uuid') {
        value = sampleStringByName(parameter.name, pathname, mode);
      } else if (parameter.name.toLowerCase().includes('shortid')) {
        value = mode === 'missing' ? '{{missingShortId}}' : '{{shortId}}';
      } else if (parameter.name === 'code') {
        value = mode === 'missing' ? '{{missingWorkstationCode}}' : '{{workstationCode}}';
      } else if (parameter.name === 'serialNo') {
        value = mode === 'missing' ? '{{missingModuleSerialNo}}' : '{{moduleSerialNo}}';
      } else {
        value = sampleStringByName(parameter.name || 'id', pathname, mode);
      }

      return { key: parameter.name, value };
    });
}

function buildUrlObject(pathname, parameters, openapiSpec, options = {}) {
  const colonPath = pathname.replace(/\{([^}]+)\}/g, ':$1');
  const query = buildQueryEntries(parameters, pathname, { ...options, openapiSpec });
  const queryString = query.length > 0
    ? `?${query.map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}`
    : '';

  return {
    raw: `{{baseUrl}}${colonPath}${queryString}`,
    host: ['{{baseUrl}}'],
    path: colonPath.split('/').filter(Boolean),
    query,
    variable: buildPathVariableEntries(parameters, pathname, { ...options, openapiSpec }),
  };
}

function buildRequest(method, pathname, parameters, openapiSpec, options = {}) {
  const request = {
    method: method.toUpperCase(),
    header: [],
    url: buildUrlObject(pathname, parameters, openapiSpec, options),
    description: '',
  };

  if (options.body !== undefined) {
    request.header.push({ key: 'Content-Type', value: 'application/json' });
    request.body = {
      mode: 'raw',
      raw: `${JSON.stringify(options.body, null, 2)}\n`,
      options: {
        raw: {
          language: 'json',
        },
      },
    };
  }

  return request;
}

function buildSuccessAssertions(status, responseSchema, openapiSpec) {
  if (String(status) === '204') {
    return [
      `pm.test('状态码为 ${status}', function () { pm.response.to.have.status(${status}); });`,
      `pm.test('响应体为空', function () { pm.expect(pm.response.text()).to.eql(''); });`,
    ];
  }

  const scripts = [
    `pm.test('状态码为 ${status}', function () { pm.response.to.have.status(${status}); });`,
  ];

  const resolved = resolveSchema(responseSchema, openapiSpec);
  if (!resolved) {
    return scripts;
  }

  if (resolved.type === 'array') {
    scripts.push(
      `const json = pm.response.json();`,
      `pm.test('响应为数组', function () { pm.expect(Array.isArray(json)).to.eql(true); });`,
    );
    return scripts;
  }

  if (resolved.type === 'object') {
    scripts.push(
      `const json = pm.response.json();`,
      `pm.test('响应为对象', function () { pm.expect(json && typeof json).to.eql('object'); });`,
    );

    for (const key of (resolved.required || []).slice(0, 3)) {
      scripts.push(`pm.test('响应包含 ${key}', function () { pm.expect(json).to.have.property('${key}'); });`);
    }
  }

  return scripts;
}

function buildErrorAssertions(status, expectDetails = false) {
  const scripts = [
    `pm.test('状态码为 ${status}', function () { pm.response.to.have.status(${status}); });`,
    `const json = pm.response.json();`,
    `pm.test('响应包含错误信息', function () { pm.expect(Boolean(json.error || json.message)).to.eql(true); });`,
  ];

  if (expectDetails) {
    scripts.push(`pm.test('响应包含 details 字段', function () { pm.expect(json).to.have.property('details'); });`);
  }

  return scripts;
}

function makeItem({ name, folder, request, tests }) {
  return {
    name,
    item: [
      {
        name,
        request,
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: tests,
            },
          },
        ],
        response: [],
      },
    ],
    folder,
  };
}

function createFolderMap(openapiSpec) {
  const folders = new Map();

  function pushItem(folderName, item) {
    if (!folders.has(folderName)) {
      folders.set(folderName, []);
    }
    folders.get(folderName).push(item);
  }

  for (const [pathname, methods] of Object.entries(openapiSpec.paths || {})) {
    for (const [method, operation] of Object.entries(methods || {})) {
      const folderName = getTopLevelFolder(operation);
      const parameters = operation.parameters || [];
      const success = getSuccessResponse(operation);
      if (!success) {
        continue;
      }

      const requestBody = buildValidRequestBody(operation, openapiSpec, pathname);
      pushItem(folderName, {
        name: `${operation.summary} - 成功用例`,
        request: buildRequest(method, pathname, parameters, openapiSpec, { body: requestBody }),
        tests: buildSuccessAssertions(success.status, getJsonResponseSchema(success.response, openapiSpec), openapiSpec),
      });

      if (operation.responses?.['400']) {
        const invalidBody = buildInvalidRequestBody(operation, openapiSpec, pathname);
        if (invalidBody !== undefined) {
          pushItem(folderName, {
            name: `${operation.summary} - 参数校验失败`,
            request: buildRequest(method, pathname, parameters, openapiSpec, { body: invalidBody }),
            tests: buildErrorAssertions(400, true),
          });
        }

        const missingRequiredBody = buildMissingRequiredRequestBody(operation, openapiSpec, pathname);
        if (missingRequiredBody !== undefined) {
          pushItem(folderName, {
            name: `${operation.summary} - 缺少必填字段`,
            request: buildRequest(method, pathname, parameters, openapiSpec, { body: missingRequiredBody }),
            tests: buildErrorAssertions(400, true),
          });
        }

        if (parameters.some((parameter) => parameter.in === 'path')) {
          pushItem(folderName, {
            name: `${operation.summary} - 路径参数非法`,
            request: buildRequest(method, pathname, parameters, openapiSpec, {
              body: requestBody,
              mode: 'invalid',
            }),
            tests: buildErrorAssertions(400, true),
          });
        }
      }

      if (operation.responses?.['404']) {
        const notFoundBody = requestBody && cloneJson(requestBody);
        if (notFoundBody && typeof notFoundBody === 'object' && !Array.isArray(notFoundBody)) {
          if (Object.prototype.hasOwnProperty.call(notFoundBody, 'id')) {
            notFoundBody.id = '{{missingUuid}}';
          }
          if (Object.prototype.hasOwnProperty.call(notFoundBody, 'shortId')) {
            notFoundBody.shortId = 999999;
          }
          if (Object.prototype.hasOwnProperty.call(notFoundBody, 'code')) {
            notFoundBody.code = '{{missingWorkstationCode}}';
          }
          if (Object.prototype.hasOwnProperty.call(notFoundBody, 'serialNo')) {
            notFoundBody.serialNo = '{{missingModuleSerialNo}}';
          }
        }

        pushItem(folderName, {
          name: `${operation.summary} - 资源不存在`,
          request: buildRequest(method, pathname, parameters, openapiSpec, {
            body: notFoundBody,
            mode: 'missing',
          }),
          tests: buildErrorAssertions(404),
        });
      }
    }
  }

  return folders;
}

function addManualCase(folders, openapiSpec, definition) {
  const operation = openapiSpec.paths?.[definition.path]?.[definition.method];
  if (!operation) {
    throw new Error(`Manual Apifox case target not found: ${definition.method.toUpperCase()} ${definition.path}`);
  }

  const folderName = getTopLevelFolder(operation);
  if (!folders.has(folderName)) {
    folders.set(folderName, []);
  }

  folders.get(folderName).push({
    name: definition.name,
    request: buildRequest(definition.method, definition.path, operation.parameters || [], openapiSpec, {
      body: definition.body,
      mode: definition.mode,
    }),
    tests: definition.tests,
  });
}

function addManualCases(folders, openapiSpec) {
  const manualCases = [
    {
      method: 'get',
      path: '/health',
      name: '健康检查 - 返回服务标识',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 service 字段', function () { pm.expect(json.service).to.eql('DCAgent Backend'); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1',
      name: '获取 API 根信息 - 返回版本与索引',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回版本号', function () { pm.expect(json).to.have.property('version'); });`,
        `pm.test('返回 endpoints 索引', function () { pm.expect(json).to.have.property('endpoints'); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/datacenters',
      name: '获取数据中心列表 - 按名称搜索',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/datacenters/create',
      name: '创建数据中心 - 名称为空返回校验错误',
      body: { name: '' },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'post',
      path: '/api/v1/datacenters/get',
      name: '获取数据中心详情 - 不存在返回 404',
      body: { id: '{{missingUuid}}' },
      tests: buildErrorAssertions(404),
    },
    {
      method: 'post',
      path: '/api/v1/datacenters/delete',
      name: '删除数据中心 - 返回成功结果',
      body: { id: '{{dataCenterId}}' },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 success=true', function () { pm.expect(json.success).to.eql(true); });`,
        `pm.test('返回删除消息', function () { pm.expect(json).to.have.property('message'); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/rooms',
      name: '获取机房列表 - 按数据中心过滤',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/rooms/by-shortid',
      name: '根据 shortId 获取机房详情 - 不存在返回 404',
      body: { shortId: 999999 },
      tests: buildErrorAssertions(404),
    },
    {
      method: 'post',
      path: '/api/v1/rooms/floor-plan',
      name: '获取机房平面图数据 - 返回布局对象',
      body: { id: '{{roomId}}' },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 room 字段', function () { pm.expect(json).to.have.property('room'); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/cabinets',
      name: '获取机柜列表 - 按机房过滤',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/cabinets/by-shortid',
      name: '根据 shortId 获取机柜详情 - 不存在返回 404',
      body: { shortId: 999999 },
      tests: buildErrorAssertions(404),
    },
    {
      method: 'post',
      path: '/api/v1/cabinets/delete',
      name: '删除机柜 - 返回成功结果',
      body: { id: '{{cabinetId}}' },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 success=true', function () { pm.expect(json.success).to.eql(true); });`,
        `pm.test('返回删除消息', function () { pm.expect(json).to.have.property('message'); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/devices',
      name: '获取设备列表 - 按机柜过滤',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/devices/by-shortid',
      name: '根据 shortId 获取设备详情 - 不存在返回 404',
      body: { shortId: 999999 },
      tests: buildErrorAssertions(404),
    },
    {
      method: 'post',
      path: '/api/v1/devices/bulk-create',
      name: '批量创建设备 - 嵌套 cabinetId 非法返回 400',
      body: {
        devices: [
          {
            name: 'SW-01',
            type: 'SWITCH',
            cabinetId: 'bad-id',
          },
        ],
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'post',
      path: '/api/v1/devices/bulk-create',
      name: '批量创建设备 - 返回成功与失败分组',
      body: {
        devices: [
          {
            name: 'SW-01',
            type: 'SWITCH',
            cabinetId: '{{cabinetId}}',
          },
        ],
      },
      tests: [
        `pm.test('状态码为 201', function () { pm.response.to.have.status(201); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 success=true', function () { pm.expect(json.success).to.eql(true); });`,
        `pm.test('返回 data 字段', function () { pm.expect(json).to.have.property('data'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/devices/delete',
      name: '删除设备 - 返回成功结果',
      body: { id: '{{deviceId}}' },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 success=true', function () { pm.expect(json.success).to.eql(true); });`,
        `pm.test('返回删除消息', function () { pm.expect(json).to.have.property('message'); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/panels',
      name: '获取面板列表 - 按类型过滤',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/panels/by-shortid',
      name: '根据 shortId 获取面板详情 - 不存在返回 404',
      body: { shortId: 999999 },
      tests: buildErrorAssertions(404),
    },
    {
      method: 'post',
      path: '/api/v1/panels/delete',
      name: '删除面板 - 返回成功结果',
      body: { id: '{{panelId}}' },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 success=true', function () { pm.expect(json.success).to.eql(true); });`,
        `pm.test('返回删除消息', function () { pm.expect(json).to.have.property('message'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/ports/get',
      name: '获取端口详情 - 不存在返回 404',
      body: { id: '{{missingUuid}}' },
      tests: buildErrorAssertions(404),
    },
    {
      method: 'post',
      path: '/api/v1/ports/create-bulk',
      name: '批量创建端口 - 非法 panelId 返回 400',
      body: {
        panelId: 'bad-id',
        count: 4,
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'post',
      path: '/api/v1/ports/available',
      name: '获取可用端口 - 返回列表',
      body: {
        panelId: '{{panelId}}',
      },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/cables',
      name: '获取线缆列表 - 按关键字搜索',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/cables/connect-single-port',
      name: '单端连接线缆 - 非法 portId 返回 400',
      body: {
        portId: 'bad-id',
        shortId: 12345,
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'post',
      path: '/api/v1/cables/endpoints-by-shortid',
      name: '根据 shortId 获取线缆端点 - 线缆不存在返回 404',
      body: {
        shortId: 999999,
      },
      tests: buildErrorAssertions(404),
    },
    {
      method: 'post',
      path: '/api/v1/cables/disconnect-endpoint',
      name: '断开线缆端点 - 返回处理结果',
      body: {
        shortId: 12345,
      },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 success 字段', function () { pm.expect(json).to.have.property('success'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/search/global',
      name: '全局搜索 - 返回搜索结果集合',
      body: {
        query: 'core',
      },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/search/global',
      name: '全局搜索 - 空查询返回 400',
      body: {
        query: '',
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'post',
      path: '/api/v1/search/by-shortid',
      name: '按 shortId 搜索实体 - 不存在返回 404',
      body: {
        shortId: 999999,
      },
      tests: buildErrorAssertions(404),
    },
    {
      method: 'post',
      path: '/api/v1/subnets/calculate',
      name: '计算子网信息 - 返回可用主机数',
      body: {
        network: '10.0.0.0',
        cidr: 24,
      },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 usableHosts 字段', function () { pm.expect(json).to.have.property('usableHosts'); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/subnets/statistics',
      name: '获取子网统计 - 返回地址规模',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 totalSubnets 字段', function () { pm.expect(json).to.have.property('totalSubnets'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/subnets/create',
      name: '创建子网 - 非法 roomId 返回 400',
      body: {
        name: '办公网',
        network: '10.0.0.0',
        cidr: 24,
        roomId: 'bad-id',
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'post',
      path: '/api/v1/ip-addresses/next-available',
      name: '获取下一个可用 IP - 子网耗尽返回 404',
      body: {
        subnetId: '{{subnetId}}',
      },
      tests: buildErrorAssertions(404),
    },
    {
      method: 'post',
      path: '/api/v1/ip-addresses/allocate',
      name: '分配 IP 地址 - 非法 MAC 地址返回 400',
      body: {
        ipAddressId: '{{ipAddressId}}',
        macAddress: 'not-a-mac',
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'get',
      path: '/api/v1/ip-addresses',
      name: '获取 IP 地址列表 - 按关键字过滤',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/shortid-pool/check',
      name: '检查统一 shortId - 支持格式化字符串',
      body: {
        shortId: 'E-10001',
      },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 exists 字段', function () { pm.expect(json).to.have.property('exists'); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/shortid-pool/stats',
      name: '获取统一 shortId 池统计 - 返回统计字段',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 total 字段', function () { pm.expect(json).to.have.property('total'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/shortid-pool/records',
      name: '获取统一 shortId 记录 - 返回分页结果',
      body: {
        page: 1,
        pageSize: 50,
      },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 records 字段', function () { pm.expect(json).to.have.property('records'); });`,
        `pm.test('返回分页信息', function () { pm.expect(json).to.have.property('page'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/shortid-pool/records',
      name: '获取统一 shortId 记录 - pageSize 超限返回 400',
      body: {
        page: 1,
        pageSize: 201,
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'post',
      path: '/api/v1/shortid-pool/generate',
      name: '生成统一 shortId - 数量过大返回 400',
      body: {
        count: 10001,
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'post',
      path: '/api/v1/cable-shortid-pool/generate',
      name: '生成线缆 shortId - 返回 201',
      body: {
        count: 2,
      },
      tests: [
        `pm.test('状态码为 201', function () { pm.response.to.have.status(201); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 shortIds 字段', function () { pm.expect(json).to.have.property('shortIds'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/cable-shortid-pool/available',
      name: '获取可用线缆 shortId - 返回数量与列表',
      body: {
        limit: 5,
      },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 shortIds 字段', function () { pm.expect(json).to.have.property('shortIds'); });`,
        `pm.test('返回 count 字段', function () { pm.expect(json).to.have.property('count'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/cable-shortid-pool/available',
      name: '获取可用线缆 shortId - 非法 limit 返回 400',
      body: {
        limit: 0,
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'post',
      path: '/api/v1/cable-shortid-pool/check',
      name: '检查线缆 shortId - 非法 shortId 返回 400',
      body: {
        shortId: 0,
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'get',
      path: '/api/v1/cable-shortid-pool/stats',
      name: '获取线缆 shortId 池统计 - 返回统计字段',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 total 字段', function () { pm.expect(json).to.have.property('total'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/cable-shortid-pool/records',
      name: '获取线缆 shortId 记录 - 返回分页结果',
      body: {
        page: 1,
        pageSize: 50,
      },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 records 字段', function () { pm.expect(json).to.have.property('records'); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/optical-modules',
      name: '获取光模块列表 - 按厂商过滤',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/optical-modules/statistics',
      name: '获取光模块统计 - 返回库存规模',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 total 字段', function () { pm.expect(json).to.have.property('total'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/optical-modules',
      name: '创建光模块 - 非法 moduleType 返回 400',
      body: {
        serialNo: '{{moduleSerialNo}}',
        model: 'X',
        vendor: 'Cisco',
        moduleType: 'BAD_TYPE',
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'delete',
      path: '/api/v1/optical-modules/{id}',
      name: '删除光模块 - 返回删除消息',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 message 字段', function () { pm.expect(json).to.have.property('message'); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/workstations',
      name: '获取工作站列表 - 按机房过滤',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/workstations/create',
      name: '创建工作站 - 非法 roomId 返回 400',
      body: {
        name: '设计工位',
        roomId: 'bad-id',
      },
      tests: buildErrorAssertions(400, true),
    },
    {
      method: 'post',
      path: '/api/v1/workstations/by-code',
      name: '根据编号获取工作站详情 - 不存在返回 404',
      body: {
        code: '{{missingWorkstationCode}}',
      },
      tests: buildErrorAssertions(404),
    },
    {
      method: 'get',
      path: '/api/v1/panel-templates',
      name: '获取面板模板列表 - 返回模板集合',
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `pm.test('响应为数组', function () { pm.expect(Array.isArray(pm.response.json())).to.eql(true); });`,
      ],
    },
    {
      method: 'get',
      path: '/api/v1/panel-templates/{id}',
      name: '获取面板模板详情 - 不存在返回 404',
      mode: 'missing',
      tests: buildErrorAssertions(404),
    },
    {
      method: 'post',
      path: '/api/v1/panel-templates/{id}/create-panel',
      name: '从模板创建面板 - 缺少 deviceId 返回 400',
      body: {},
      tests: buildErrorAssertions(400),
    },
    {
      method: 'put',
      path: '/api/v1/panel-templates/{id}',
      name: '更新面板模板 - 返回更新后的模板',
      body: {
        name: '更新后的模板',
      },
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 id 字段', function () { pm.expect(json).to.have.property('id'); });`,
      ],
    },
    {
      method: 'post',
      path: '/api/v1/panel-templates/init-system-templates',
      name: '初始化系统模板 - 返回成功消息',
      body: {},
      tests: [
        `pm.test('状态码为 200', function () { pm.response.to.have.status(200); });`,
        `const json = pm.response.json();`,
        `pm.test('返回 message 字段', function () { pm.expect(json).to.have.property('message'); });`,
      ],
    },
    {
      method: 'delete',
      path: '/api/v1/panel-templates/{id}',
      name: '删除面板模板 - 成功返回 204',
      tests: [
        `pm.test('状态码为 204', function () { pm.response.to.have.status(204); });`,
      ],
    },
  ];

  for (const definition of manualCases) {
    addManualCase(folders, openapiSpec, definition);
  }
}

function buildCollection(openapiSpec) {
  const folders = createFolderMap(openapiSpec);
  addManualCases(folders, openapiSpec);

  const item = [...folders.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([folderName, cases]) => ({
      name: folderName,
      item: cases
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((caseDefinition) => ({
          name: caseDefinition.name,
          request: caseDefinition.request,
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: caseDefinition.tests,
              },
            },
          ],
          response: [],
        })),
    }));

  return {
    info: {
      name: COLLECTION_NAME,
      description: '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: COLLECTION_VARIABLES,
    item,
  };
}

function writeCollectionFile(collection) {
  fs.writeFileSync(CASE_FILE_PATH, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
}

function getEndpointKeyFromItem(item) {
  const method = item.request?.method?.toUpperCase() || 'GET';
  const pathParts = item.request?.url?.path || [];
  return `${method} /${pathParts.join('/')}`;
}

function buildImportBatches(collection) {
  const batches = [];
  const endpointUsage = new Map();

  for (const folder of collection.item) {
    for (const item of folder.item || []) {
      const endpointKey = getEndpointKeyFromItem(item);
      const batchIndex = endpointUsage.get(endpointKey) || 0;
      endpointUsage.set(endpointKey, batchIndex + 1);

      if (!batches[batchIndex]) {
        batches[batchIndex] = new Map();
      }

      if (!batches[batchIndex].has(folder.name)) {
        batches[batchIndex].set(folder.name, []);
      }

      batches[batchIndex].get(folder.name).push(item);
    }
  }

  return batches.map((folderMap) => ({
    info: {
      ...collection.info,
    },
    variable: collection.variable,
    item: [...folderMap.entries()].map(([folderName, items]) => ({
      name: folderName,
      item: items,
    })),
  }));
}

function mergeCounters(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    target[key] = (target[key] || 0) + Number(value || 0);
  }

  return target;
}

async function importCollectionToApifox(collection) {
  const mcpConfig = loadApifoxConfigFromMcp();
  const projectId = parseArgValue('--project-id') || process.env.APIFOX_PROJECT_ID || mcpConfig.projectId;
  const accessToken = process.env.APIFOX_ACCESS_TOKEN || mcpConfig.accessToken;

  if (!projectId || !accessToken) {
    throw new Error('Missing Apifox project id or access token. Set APIFOX_PROJECT_ID / APIFOX_ACCESS_TOKEN or provide them in .mcp.json.');
  }

  const batches = buildImportBatches(collection);
  const mergedCounters = {};

  console.log(`Importing ${countCollectionItems(collection)} cases in ${batches.length} batches.`);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const response = await fetch(`https://api.apifox.com/v1/projects/${projectId}/import-postman-collection?locale=zh-CN`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Apifox-Api-Version': '2024-03-28',
      },
      body: JSON.stringify({
        input: JSON.stringify(batch),
        options: {
          endpointOverwriteBehavior: 'AUTO_MERGE',
          endpointCaseOverwriteBehavior: 'OVERWRITE_EXISTING',
          updateFolderOfChangedEndpoint: false,
        },
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Apifox Postman import failed on batch ${index + 1} (${response.status}): ${raw}`);
    }

    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = raw;
    }

    console.log(`Imported batch ${index + 1}/${batches.length} to Apifox project ${projectId}.`);
    if (parsed?.data?.counters) {
      mergeCounters(mergedCounters, parsed.data.counters);
      console.log(JSON.stringify(parsed, null, 2));
    } else if (parsed) {
      console.log(JSON.stringify(parsed, null, 2));
    }
  }

  console.log(`Imported Postman test cases to Apifox project ${projectId}.`);
  console.log(JSON.stringify({ data: { counters: mergedCounters } }, null, 2));
}

function countCollectionItems(collection) {
  return collection.item.reduce((count, folder) => count + (folder.item?.length || 0), 0);
}

async function main() {
  const openapiSpec = loadOpenApiSpec();
  const collection = buildCollection(openapiSpec);

  writeCollectionFile(collection);

  const folderCount = collection.item.length;
  const caseCount = countCollectionItems(collection);
  console.log(`Generated Postman collection with ${caseCount} cases across ${folderCount} folders.`);
  console.log(`Wrote ${CASE_FILE_PATH}`);

  if (process.argv.includes('--import')) {
    await importCollectionToApifox(collection);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
