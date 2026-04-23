#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const workspaceDir = path.resolve(backendDir, '..');

const API_BASE_URL = 'http://localhost:3000';
const API_PREFIX = '/api/v1';

const DEVICE_TYPES = ['SERVER', 'SWITCH', 'ROUTER', 'FIREWALL', 'STORAGE', 'PDU', 'OTHER'];
const PANEL_TYPES = ['NETWORK', 'POWER', 'CONSOLE', 'USB', 'MIXED', 'OTHER'];
const PORT_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'FAULTY'];
const PHYSICAL_STATUSES = ['EMPTY', 'MODULE_ONLY', 'CONNECTED'];
const CABLE_TYPES = ['CAT5E', 'CAT6', 'CAT6A', 'CAT7', 'FIBER_SM', 'FIBER_MM', 'QSFP_TO_SFP', 'QSFP_TO_QSFP', 'SFP_TO_SFP', 'POWER', 'OTHER'];
const CABLE_TYPES_CREATE = ['CAT5E', 'CAT6', 'CAT6A', 'CAT7', 'FIBER_SM', 'FIBER_MM', 'POWER', 'OTHER'];
const MODULE_TYPES = ['SFP', 'SFP_PLUS', 'QSFP', 'QSFP28', 'QSFP_DD'];
const MODULE_STATUSES = ['IN_STOCK', 'INSTALLED', 'RESERVED', 'FAULTY', 'SCRAPPED'];
const MOVEMENT_TYPES = ['PURCHASE', 'INSTALL', 'UNINSTALL', 'TRANSFER', 'REPAIR', 'RETURN', 'SCRAP'];
const WORKSTATION_STATUSES = ['ONLINE', 'OFFLINE', 'IN_USE', 'IDLE', 'MAINTENANCE', 'FAULTY'];
const IP_STATUSES = ['FREE', 'ALLOCATED', 'RESERVED', 'BLOCKED'];
const SHORTID_POOL_ENTITY_TYPES = ['DATA_CENTER', 'ROOM', 'CABINET', 'DEVICE', 'PANEL', 'PORT', 'CABLE', 'CABLE_ENDPOINT', 'WORKSTATION'];
const SHORTID_POOL_STATUSES = ['GENERATED', 'PRINTED', 'BOUND', 'CANCELLED'];
const CABLE_SHORTID_POOL_STATUSES = ['AVAILABLE', 'IN_USE', 'RESERVED', 'CANCELLED'];
const SEARCH_RESULT_TYPES = ['DataCenter', 'Room', 'Cabinet', 'Device', 'Cable', 'Panel', 'Port'];

const uuid = { type: 'string', format: 'uuid' };
const dateTime = { type: 'string', format: 'date-time' };
const numberSchema = { type: 'number' };
const integerSchema = { type: 'integer' };
const positiveInteger = { type: 'integer', minimum: 1 };
const stringSchema = { type: 'string' };
const nonEmptyString = { type: 'string', minLength: 1 };
const booleanSchema = { type: 'boolean' };
const freeObject = { type: 'object', additionalProperties: true };

function apiPath(suffix = '') {
  return `${API_PREFIX}${suffix}`;
}

function ref(name) {
  return { $ref: `#/components/schemas/${name}` };
}

function enumSchema(values) {
  return { type: 'string', enum: values };
}

function arrayOf(items) {
  return { type: 'array', items };
}

function objectSchema(properties, required = []) {
  const schema = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

function nullable(schema) {
  return { ...schema, nullable: true };
}

function oneOf(...schemas) {
  return { oneOf: schemas };
}

function queryParam(name, schema, description, required = false) {
  return {
    name,
    in: 'query',
    required,
    description,
    schema,
  };
}

function routeParam(name, schema, description) {
  return {
    name,
    in: 'path',
    required: true,
    description,
    schema,
  };
}

function requestBody(schema, description) {
  const result = {
    required: true,
    content: {
      'application/json': {
        schema,
      },
    },
  };

  if (description) {
    result.description = description;
  }

  return result;
}

function jsonResponse(schema, description = '成功') {
  const result = { description };

  if (schema) {
    result.content = {
      'application/json': {
        schema,
      },
    };
  }

  return result;
}

function textCsvResponse(description = 'CSV 导出文件') {
  return {
    description,
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  };
}

function noContentResponse(description = '成功') {
  return { description };
}

function buildOperation({
  tags,
  summary,
  description,
  parameters,
  requestSchema,
  requestDescription,
  successStatus = '200',
  successSchema,
  successDescription = '成功',
  includeBadRequest = false,
  includeNotFound = false,
  includeServerError = true,
  extraResponses = {},
}) {
  const responses = {
    [successStatus]: successStatus === '204'
      ? noContentResponse(successDescription)
      : jsonResponse(successSchema, successDescription),
    ...extraResponses,
  };

  if (includeBadRequest) {
    responses['400'] = jsonResponse(ref('ErrorResponse'), '请求参数错误');
  }

  if (includeNotFound) {
    responses['404'] = jsonResponse(ref('ErrorResponse'), '资源不存在');
  }

  if (includeServerError) {
    responses['500'] = jsonResponse(ref('ErrorResponse'), '服务器错误');
  }

  const operation = {
    tags,
    summary,
    responses,
  };

  if (description) {
    operation.description = description;
  }

  if (parameters && parameters.length > 0) {
    operation.parameters = parameters;
  }

  if (requestSchema) {
    operation.requestBody = requestBody(requestSchema, requestDescription);
  }

  return operation;
}

function addOperation(paths, pathname, method, operation) {
  if (!paths[pathname]) {
    paths[pathname] = {};
  }

  paths[pathname][method] = operation;
}

function addCrudGroup(paths, {
  basePath,
  tag,
  entityName,
  entitySchemaName,
  listSummary,
  listDescription,
  listParameters = [],
  createSchema,
  updateSchema,
  createSummary,
  updateSummary,
  supportsShortId = true,
}) {
  addOperation(paths, basePath, 'get', buildOperation({
    tags: [tag],
    summary: listSummary || `获取${entityName}列表`,
    description: listDescription,
    parameters: listParameters,
    successSchema: arrayOf(ref(entitySchemaName)),
    successDescription: `成功返回${entityName}列表`,
  }));

  addOperation(paths, `${basePath}/get`, 'post', buildOperation({
    tags: [tag],
    summary: `获取${entityName}详情`,
    requestSchema: objectSchema({ id: uuid }, ['id']),
    successSchema: ref(entitySchemaName),
    successDescription: `成功返回${entityName}详情`,
    includeBadRequest: true,
    includeNotFound: true,
  }));

  if (supportsShortId) {
    addOperation(paths, `${basePath}/by-shortid`, 'post', buildOperation({
      tags: [tag],
      summary: `根据 shortId 获取${entityName}详情`,
      requestSchema: objectSchema({ shortId: positiveInteger }, ['shortId']),
      successSchema: ref(entitySchemaName),
      successDescription: `成功返回${entityName}详情`,
      includeBadRequest: true,
      includeNotFound: true,
    }));
  }

  addOperation(paths, `${basePath}/create`, 'post', buildOperation({
    tags: [tag],
    summary: createSummary || `创建${entityName}`,
    requestSchema: createSchema,
    successStatus: '201',
    successSchema: ref(entitySchemaName),
    successDescription: `${entityName}创建成功`,
    includeBadRequest: true,
  }));

  addOperation(paths, `${basePath}/update`, 'post', buildOperation({
    tags: [tag],
    summary: updateSummary || `更新${entityName}`,
    requestSchema: updateSchema,
    successSchema: ref(entitySchemaName),
    successDescription: `${entityName}更新成功`,
    includeBadRequest: true,
  }));

  addOperation(paths, `${basePath}/delete`, 'post', buildOperation({
    tags: [tag],
    summary: `删除${entityName}`,
    requestSchema: objectSchema({ id: uuid }, ['id']),
    successSchema: ref('SuccessResponse'),
    successDescription: `${entityName}删除成功`,
    includeBadRequest: true,
  }));
}

const positionSchema = objectSchema({
  x: numberSchema,
  y: numberSchema,
}, ['x', 'y']);

const panelSizeSchema = objectSchema({
  width: numberSchema,
  height: numberSchema,
}, ['width', 'height']);

const floorPlanSizeSchema = objectSchema({
  width: numberSchema,
  depth: numberSchema,
}, ['width', 'depth']);

const powerMetricValue = oneOf({ type: 'number' }, { type: 'string' });
const shortIdValue = oneOf({ type: 'integer', minimum: 1 }, { type: 'string', minLength: 1 });

const portDefinitionSchema = objectSchema({
  number: stringSchema,
  portType: stringSchema,
  position: positionSchema,
  size: panelSizeSchema,
  label: stringSchema,
}, ['number', 'portType', 'position', 'size']);

const components = {
  schemas: {
    ErrorResponse: objectSchema({
      error: stringSchema,
      message: stringSchema,
      details: arrayOf(freeObject),
      code: stringSchema,
      conflictFields: arrayOf(stringSchema),
    }),
    SuccessResponse: objectSchema({
      success: booleanSchema,
      message: stringSchema,
    }, ['success']),
    HealthCheck: objectSchema({
      status: stringSchema,
      timestamp: dateTime,
      service: stringSchema,
    }, ['status', 'timestamp', 'service']),
    ApiIndex: objectSchema({
      message: stringSchema,
      version: stringSchema,
      endpoints: freeObject,
    }, ['message', 'version', 'endpoints']),
    Position: positionSchema,
    PanelSize: panelSizeSchema,
    FloorPlanSize: floorPlanSizeSchema,
    DeviceType: enumSchema(DEVICE_TYPES),
    PanelType: enumSchema(PANEL_TYPES),
    PortStatus: enumSchema(PORT_STATUSES),
    PhysicalStatus: enumSchema(PHYSICAL_STATUSES),
    CableType: enumSchema(CABLE_TYPES),
    CableInventoryStatus: enumSchema(['NOT_INVENTORIED', 'INVENTORIED', 'IN_USE']),
    ModuleType: enumSchema(MODULE_TYPES),
    ModuleStatus: enumSchema(MODULE_STATUSES),
    MovementType: enumSchema(MOVEMENT_TYPES),
    WorkstationStatus: enumSchema(WORKSTATION_STATUSES),
    IpStatus: enumSchema(IP_STATUSES),
    ShortIdPoolEntityType: enumSchema(SHORTID_POOL_ENTITY_TYPES),
    ShortIdPoolStatus: enumSchema(SHORTID_POOL_STATUSES),
    CableShortIdPoolStatus: enumSchema(CABLE_SHORTID_POOL_STATUSES),
    DataCenter: objectSchema({
      id: uuid,
      shortId: nullable(integerSchema),
      name: stringSchema,
      location: nullable(stringSchema),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'name', 'createdAt', 'updatedAt']),
    Room: objectSchema({
      id: uuid,
      shortId: nullable(integerSchema),
      name: stringSchema,
      floor: nullable(stringSchema),
      dataCenterId: uuid,
      floorPlanWidth: nullable(numberSchema),
      floorPlanHeight: nullable(numberSchema),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'name', 'dataCenterId', 'createdAt', 'updatedAt']),
    Cabinet: objectSchema({
      id: uuid,
      shortId: nullable(integerSchema),
      name: stringSchema,
      position: nullable(stringSchema),
      height: integerSchema,
      roomId: uuid,
      floorPlanPosition: nullable(ref('Position')),
      floorPlanSize: nullable(ref('FloorPlanSize')),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'name', 'height', 'roomId', 'createdAt', 'updatedAt']),
    Device: objectSchema({
      id: uuid,
      shortId: nullable(integerSchema),
      name: stringSchema,
      type: ref('DeviceType'),
      model: nullable(stringSchema),
      serialNo: nullable(stringSchema),
      uPosition: nullable(integerSchema),
      uHeight: nullable(integerSchema),
      cabinetId: uuid,
      cabinet: nullable(freeObject),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'name', 'type', 'cabinetId', 'createdAt', 'updatedAt']),
    Panel: objectSchema({
      id: uuid,
      name: stringSchema,
      type: ref('PanelType'),
      shortId: nullable(integerSchema),
      deviceId: uuid,
      device: nullable(freeObject),
      templateId: nullable(uuid),
      isCustomized: booleanSchema,
      position: nullable(ref('Position')),
      size: nullable(ref('PanelSize')),
      backgroundColor: nullable(stringSchema),
      image: nullable(stringSchema),
      svgPath: nullable(stringSchema),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'name', 'type', 'deviceId', 'isCustomized', 'createdAt', 'updatedAt']),
    Port: objectSchema({
      id: uuid,
      number: stringSchema,
      label: nullable(stringSchema),
      status: ref('PortStatus'),
      physicalStatus: nullable(ref('PhysicalStatus')),
      panelId: uuid,
      portType: nullable(stringSchema),
      rotation: nullable(numberSchema),
      position: nullable(ref('Position')),
      size: nullable(ref('PanelSize')),
      cableEndpoints: arrayOf(ref('CableEndpoint')),
      opticalModule: nullable(freeObject),
      ipAddress: nullable(freeObject),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'number', 'status', 'panelId', 'createdAt', 'updatedAt']),
    CableEndpoint: objectSchema({
      id: uuid,
      shortId: nullable(integerSchema),
      cableId: uuid,
      panelId: nullable(uuid),
      portId: nullable(uuid),
      endType: stringSchema,
      panel: nullable(freeObject),
      port: nullable(freeObject),
      createdAt: dateTime,
    }, ['id', 'cableId', 'endType', 'createdAt']),
    Cable: objectSchema({
      id: uuid,
      label: nullable(stringSchema),
      type: ref('CableType'),
      length: nullable(numberSchema),
      color: nullable(stringSchema),
      notes: nullable(stringSchema),
      isBranched: booleanSchema,
      inventoryStatus: ref('CableInventoryStatus'),
      endpoints: arrayOf(ref('CableEndpoint')),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'type', 'isBranched', 'inventoryStatus', 'createdAt', 'updatedAt']),
    PanelTemplate: objectSchema({
      id: uuid,
      name: stringSchema,
      type: ref('PanelType'),
      portCount: integerSchema,
      description: nullable(stringSchema),
      width: numberSchema,
      height: numberSchema,
      layoutConfig: nullable(freeObject),
      portDefinitions: arrayOf(portDefinitionSchema),
      backgroundColor: nullable(stringSchema),
      image: nullable(stringSchema),
      svgPath: nullable(stringSchema),
      isSystem: booleanSchema,
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'name', 'type', 'portCount', 'width', 'height', 'portDefinitions', 'isSystem', 'createdAt', 'updatedAt']),
    Workstation: objectSchema({
      id: uuid,
      name: stringSchema,
      code: nullable(stringSchema),
      roomId: uuid,
      cpu: nullable(stringSchema),
      memory: nullable(stringSchema),
      storage: nullable(stringSchema),
      gpu: nullable(stringSchema),
      os: nullable(stringSchema),
      status: ref('WorkstationStatus'),
      assignedTo: nullable(stringSchema),
      ipAddress: nullable(stringSchema),
      macAddress: nullable(stringSchema),
      floorPlanPosition: nullable(ref('Position')),
      floorPlanSize: nullable(ref('FloorPlanSize')),
      notes: nullable(stringSchema),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'name', 'roomId', 'status', 'createdAt', 'updatedAt']),
    FloorPlanData: objectSchema({
      room: objectSchema({
        id: uuid,
        name: stringSchema,
        floorPlanWidth: nullable(numberSchema),
        floorPlanHeight: nullable(numberSchema),
      }, ['id', 'name']),
      cabinets: arrayOf(objectSchema({
        id: uuid,
        name: stringSchema,
        shortId: nullable(integerSchema),
        position: nullable(ref('Position')),
        size: nullable(ref('FloorPlanSize')),
        deviceCount: integerSchema,
      }, ['id', 'name', 'deviceCount'])),
      workstations: arrayOf(objectSchema({
        id: uuid,
        name: stringSchema,
        code: nullable(stringSchema),
        status: ref('WorkstationStatus'),
        assignedTo: nullable(stringSchema),
        position: nullable(ref('Position')),
        size: nullable(ref('FloorPlanSize')),
      }, ['id', 'name', 'status'])),
    }, ['room', 'cabinets', 'workstations']),
    SearchResult: objectSchema({
      type: enumSchema(SEARCH_RESULT_TYPES),
      id: uuid,
      shortId: nullable(integerSchema),
      name: nullable(stringSchema),
      label: nullable(stringSchema),
      description: nullable(stringSchema),
      metadata: nullable(freeObject),
    }, ['type', 'id']),
    OpticalModule: objectSchema({
      id: uuid,
      serialNo: stringSchema,
      model: stringSchema,
      vendor: stringSchema,
      moduleType: ref('ModuleType'),
      wavelength: nullable(stringSchema),
      distance: nullable(stringSchema),
      ddmSupport: booleanSchema,
      supplier: nullable(stringSchema),
      purchaseDate: nullable(dateTime),
      price: nullable(numberSchema),
      warrantyExpiry: nullable(dateTime),
      status: ref('ModuleStatus'),
      currentPortId: nullable(uuid),
      currentPort: nullable(freeObject),
      notes: nullable(stringSchema),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'serialNo', 'model', 'vendor', 'moduleType', 'ddmSupport', 'status', 'createdAt', 'updatedAt']),
    ModuleMovement: objectSchema({
      id: uuid,
      moduleId: uuid,
      movementType: ref('MovementType'),
      fromPortId: nullable(uuid),
      fromPort: nullable(freeObject),
      toPortId: nullable(uuid),
      toPort: nullable(freeObject),
      operator: nullable(stringSchema),
      notes: nullable(stringSchema),
      createdAt: dateTime,
    }, ['id', 'moduleId', 'movementType', 'createdAt']),
    OpticalModuleStatistics: objectSchema({
      total: integerSchema,
      byStatus: objectSchema({
        inStock: integerSchema,
        installed: integerSchema,
        faulty: integerSchema,
        scrapped: integerSchema,
      }, ['inStock', 'installed', 'faulty', 'scrapped']),
      byType: arrayOf(objectSchema({
        moduleType: stringSchema,
        count: integerSchema,
      }, ['moduleType', 'count'])),
      byVendor: arrayOf(objectSchema({
        vendor: stringSchema,
        count: integerSchema,
      }, ['vendor', 'count'])),
    }, ['total', 'byStatus', 'byType', 'byVendor']),
    IpSubnet: objectSchema({
      id: uuid,
      name: stringSchema,
      network: stringSchema,
      cidr: integerSchema,
      gateway: nullable(stringSchema),
      vlan: nullable(stringSchema),
      dnsServers: nullable(arrayOf(stringSchema)),
      description: nullable(stringSchema),
      roomId: nullable(uuid),
      room: nullable(freeObject),
      stats: nullable(objectSchema({
        total: integerSchema,
        free: integerSchema,
        allocated: integerSchema,
        reserved: integerSchema,
        blocked: integerSchema,
        usable: integerSchema,
        utilizationRate: stringSchema,
      }, ['total', 'free', 'allocated', 'reserved', 'blocked', 'usable', 'utilizationRate'])),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'name', 'network', 'cidr', 'createdAt', 'updatedAt']),
    IpAddress: objectSchema({
      id: uuid,
      address: stringSchema,
      subnetId: uuid,
      subnet: nullable(freeObject),
      status: ref('IpStatus'),
      portId: nullable(uuid),
      port: nullable(freeObject),
      deviceId: nullable(uuid),
      device: nullable(freeObject),
      hostname: nullable(stringSchema),
      macAddress: nullable(stringSchema),
      description: nullable(stringSchema),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'address', 'subnetId', 'status', 'createdAt', 'updatedAt']),
    SubnetCalculationResult: objectSchema({
      network: stringSchema,
      cidr: integerSchema,
      subnetMask: stringSchema,
      wildcardMask: stringSchema,
      networkAddress: stringSchema,
      broadcastAddress: stringSchema,
      firstUsableIp: stringSchema,
      lastUsableIp: stringSchema,
      totalHosts: integerSchema,
      usableHosts: integerSchema,
      ipRange: arrayOf(stringSchema),
    }, ['network', 'cidr', 'subnetMask', 'wildcardMask', 'networkAddress', 'broadcastAddress', 'firstUsableIp', 'lastUsableIp', 'totalHosts', 'usableHosts', 'ipRange']),
    SubnetStatistics: objectSchema({
      totalSubnets: integerSchema,
      totalIps: integerSchema,
      byStatus: objectSchema({
        free: integerSchema,
        allocated: integerSchema,
        reserved: integerSchema,
      }, ['free', 'allocated', 'reserved']),
      utilizationRate: stringSchema,
      subnetsByRoom: arrayOf(objectSchema({
        roomId: nullable(uuid),
        count: freeObject,
      }, ['count'])),
    }, ['totalSubnets', 'totalIps', 'byStatus', 'utilizationRate', 'subnetsByRoom']),
    IpConflictGroup: objectSchema({
      macAddress: stringSchema,
      ipAddresses: arrayOf(ref('IpAddress')),
    }, ['macAddress', 'ipAddresses']),
    ShortIdPoolRecord: objectSchema({
      id: uuid,
      shortId: integerSchema,
      status: ref('ShortIdPoolStatus'),
      entityType: nullable(enumSchema(SHORTID_POOL_ENTITY_TYPES)),
      entityId: nullable(uuid),
      boundAt: nullable(dateTime),
      printTaskId: nullable(uuid),
      printTask: nullable(objectSchema({
        id: uuid,
        name: stringSchema,
        status: stringSchema,
      }, ['id', 'name', 'status'])),
      printedAt: nullable(dateTime),
      batchNo: nullable(stringSchema),
      notes: nullable(stringSchema),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'shortId', 'status', 'createdAt', 'updatedAt']),
    PrintTask: objectSchema({
      id: uuid,
      name: stringSchema,
      count: integerSchema,
      status: stringSchema,
      filePath: nullable(stringSchema),
      notes: nullable(stringSchema),
      createdBy: nullable(stringSchema),
      createdAt: dateTime,
      completedAt: nullable(dateTime),
      updatedAt: dateTime,
      _count: nullable(objectSchema({
        shortIds: integerSchema,
      }, ['shortIds'])),
    }, ['id', 'name', 'count', 'status', 'createdAt', 'updatedAt']),
    ShortIdPoolStats: objectSchema({
      total: integerSchema,
      generated: integerSchema,
      printed: integerSchema,
      bound: integerSchema,
      cancelled: integerSchema,
      byType: nullable({
        type: 'object',
        additionalProperties: { type: 'integer' },
      }),
    }, ['total', 'generated', 'printed', 'bound', 'cancelled']),
    PagedShortIdPoolRecords: objectSchema({
      records: arrayOf(ref('ShortIdPoolRecord')),
      total: integerSchema,
      page: integerSchema,
      pageSize: integerSchema,
      totalPages: integerSchema,
    }, ['records', 'total', 'page', 'pageSize', 'totalPages']),
    PagedPrintTasks: objectSchema({
      records: arrayOf(ref('PrintTask')),
      total: integerSchema,
      page: integerSchema,
      pageSize: integerSchema,
      totalPages: integerSchema,
    }, ['records', 'total', 'page', 'pageSize', 'totalPages']),
    CableShortIdPoolRecord: objectSchema({
      id: uuid,
      shortId: integerSchema,
      status: ref('CableShortIdPoolStatus'),
      cableId: nullable(uuid),
      cable: nullable(objectSchema({
        id: uuid,
        label: nullable(stringSchema),
        type: stringSchema,
        inventoryStatus: stringSchema,
      }, ['id', 'type', 'inventoryStatus'])),
      allocatedAt: dateTime,
      usedAt: nullable(dateTime),
      notes: nullable(stringSchema),
      createdAt: dateTime,
      updatedAt: dateTime,
    }, ['id', 'shortId', 'status', 'allocatedAt', 'createdAt', 'updatedAt']),
    CableShortIdPoolStats: objectSchema({
      total: integerSchema,
      available: integerSchema,
      inUse: integerSchema,
      reserved: integerSchema,
      cancelled: integerSchema,
    }, ['total', 'available', 'inUse', 'reserved', 'cancelled']),
    PagedCableShortIdPoolRecords: objectSchema({
      records: arrayOf(ref('CableShortIdPoolRecord')),
      total: integerSchema,
      page: integerSchema,
      pageSize: integerSchema,
      totalPages: integerSchema,
    }, ['records', 'total', 'page', 'pageSize', 'totalPages']),
    PortConnectionResult: objectSchema({
      cable: ref('Cable'),
      thisEndpoint: freeObject,
      otherEndpoint: nullable(freeObject),
      connectedPort: nullable(freeObject),
    }, ['cable', 'thisEndpoint']),
    CableEndpointLookupResponse: objectSchema({
      cableId: uuid,
      cable: ref('Cable'),
      endpointA: nullable(freeObject),
      endpointB: nullable(freeObject),
      panelA: nullable(freeObject),
      panelB: nullable(freeObject),
      portA: nullable(freeObject),
      portB: nullable(freeObject),
    }, ['cable']),
    CableShortIdCheckResult: objectSchema({
      available: booleanSchema,
      message: stringSchema,
      usedBy: nullable(stringSchema),
      details: nullable(freeObject),
    }, ['available', 'message']),
    CableShortIdBatchCheckResult: objectSchema({
      hasConflict: booleanSchema,
      message: stringSchema,
      conflicts: arrayOf(freeObject),
      available: arrayOf(freeObject),
    }, ['hasConflict', 'message']),
    CableSingleConnectResult: objectSchema({
      cable: ref('Cable'),
      connectedEndpoint: freeObject,
      otherEndpoint: nullable(freeObject),
      peerInfo: nullable(freeObject),
    }, ['cable', 'connectedEndpoint']),
    CableDanglingByDeviceResult: objectSchema({
      total: integerSchema,
      panels: freeObject,
    }, ['total', 'panels']),
    DisconnectEndpointResult: objectSchema({
      message: stringSchema,
      endpoint: freeObject,
      disconnectedPort: nullable(freeObject),
    }, ['message', 'endpoint']),
    PanelTemplateCreatePanelResult: objectSchema({
      panel: ref('Panel'),
      ports: arrayOf(ref('Port')),
    }, ['panel', 'ports']),
    MonitoringDevice: objectSchema({
      id: stringSchema,
      name: stringSchema,
      ip: stringSchema,
      community: nullable(stringSchema),
      vendor: enumSchema(['lenovo', 'dell', 'hp', 'unknown']),
      model: nullable(stringSchema),
      status: enumSchema(['online', 'offline', 'warning']),
      lastUpdate: dateTime,
    }, ['id', 'name', 'ip', 'vendor', 'status', 'lastUpdate']),
    SensorData: objectSchema({
      index: nullable(integerSchema),
      oid: nullable(stringSchema),
      name: stringSchema,
      value: stringSchema,
      status: enumSchema(['normal', 'warning', 'critical']),
      unit: nullable(stringSchema),
    }, ['name', 'value', 'status']),
    PowerMetrics: objectSchema({
      totalPower: powerMetricValue,
      cpuPower: powerMetricValue,
      memPower: powerMetricValue,
      fanPower: nullable(powerMetricValue),
      avgPower: powerMetricValue,
      maxPower: nullable(powerMetricValue),
      minPower: nullable(powerMetricValue),
    }, ['totalPower', 'cpuPower', 'memPower', 'avgPower']),
    MonitoringHealth: objectSchema({
      overall: stringSchema,
      cpu: stringSchema,
      memory: stringSchema,
      storage: stringSchema,
    }, ['overall', 'cpu', 'memory', 'storage']),
    BulkCreateDevicesResult: objectSchema({
      success: booleanSchema,
      message: stringSchema,
      data: objectSchema({
        success: arrayOf(ref('Device')),
        failed: arrayOf(freeObject),
      }),
    }, ['success', 'message', 'data']),
  },
};

const paths = {};

addOperation(paths, '/health', 'get', buildOperation({
  tags: ['System'],
  summary: '健康检查',
  successSchema: ref('HealthCheck'),
  successDescription: '服务健康状态',
}));

addOperation(paths, apiPath(), 'get', buildOperation({
  tags: ['System'],
  summary: '获取 API 根信息',
  successSchema: ref('ApiIndex'),
  successDescription: 'API 版本与路由索引',
}));

addCrudGroup(paths, {
  basePath: apiPath('/datacenters'),
  tag: 'DataCenters',
  entityName: '数据中心',
  entitySchemaName: 'DataCenter',
  listParameters: [
    queryParam('search', stringSchema, '按名称关键字搜索'),
  ],
  createSchema: objectSchema({
    name: nonEmptyString,
    location: stringSchema,
  }, ['name']),
  updateSchema: objectSchema({
    id: uuid,
    name: nonEmptyString,
    location: stringSchema,
  }, ['id']),
});

addCrudGroup(paths, {
  basePath: apiPath('/rooms'),
  tag: 'Rooms',
  entityName: '机房',
  entitySchemaName: 'Room',
  listParameters: [
    queryParam('dataCenterId', uuid, '按数据中心筛选'),
    queryParam('search', stringSchema, '按名称关键字搜索'),
  ],
  createSchema: objectSchema({
    name: nonEmptyString,
    shortId: positiveInteger,
    floor: stringSchema,
    dataCenterId: uuid,
  }, ['name', 'shortId', 'dataCenterId']),
  updateSchema: objectSchema({
    id: uuid,
    name: nonEmptyString,
    shortId: positiveInteger,
    floor: stringSchema,
    dataCenterId: uuid,
    floorPlanWidth: { type: 'number', minimum: 0 },
    floorPlanHeight: { type: 'number', minimum: 0 },
  }, ['id']),
});

addOperation(paths, apiPath('/rooms/floor-plan'), 'post', buildOperation({
  tags: ['Rooms'],
  summary: '获取机房平面图数据',
  requestSchema: objectSchema({ id: uuid }, ['id']),
  successSchema: ref('FloorPlanData'),
  successDescription: '返回机房、机柜与工作站布局数据',
  includeBadRequest: true,
}));

addCrudGroup(paths, {
  basePath: apiPath('/cabinets'),
  tag: 'Cabinets',
  entityName: '机柜',
  entitySchemaName: 'Cabinet',
  listParameters: [
    queryParam('roomId', uuid, '按机房筛选'),
    queryParam('search', stringSchema, '按名称关键字搜索'),
  ],
  createSchema: objectSchema({
    name: nonEmptyString,
    shortId: positiveInteger,
    position: stringSchema,
    height: positiveInteger,
    roomId: uuid,
  }, ['name', 'shortId', 'roomId']),
  updateSchema: objectSchema({
    id: uuid,
    name: nonEmptyString,
    shortId: positiveInteger,
    position: stringSchema,
    height: positiveInteger,
    roomId: uuid,
    floorPlanPosition: ref('Position'),
    floorPlanSize: ref('FloorPlanSize'),
  }, ['id']),
});

addCrudGroup(paths, {
  basePath: apiPath('/devices'),
  tag: 'Devices',
  entityName: '设备',
  entitySchemaName: 'Device',
  listParameters: [
    queryParam('cabinetId', uuid, '按机柜筛选'),
    queryParam('search', stringSchema, '按名称关键字搜索'),
  ],
  createSchema: objectSchema({
    name: nonEmptyString,
    type: ref('DeviceType'),
    model: nullable(stringSchema),
    serialNo: nullable(stringSchema),
    uPosition: positiveInteger,
    uHeight: positiveInteger,
    cabinetId: uuid,
  }, ['name', 'type', 'cabinetId']),
  updateSchema: objectSchema({
    id: uuid,
    name: nonEmptyString,
    type: ref('DeviceType'),
    model: nullable(stringSchema),
    serialNo: nullable(stringSchema),
    uPosition: positiveInteger,
    uHeight: positiveInteger,
    cabinetId: uuid,
  }, ['id']),
});

addOperation(paths, apiPath('/devices/bulk-create'), 'post', buildOperation({
  tags: ['Devices'],
  summary: '批量创建设备',
  requestSchema: objectSchema({
    devices: arrayOf(objectSchema({
      name: nonEmptyString,
      type: ref('DeviceType'),
      model: nullable(stringSchema),
      serialNo: nullable(stringSchema),
      uPosition: positiveInteger,
      uHeight: positiveInteger,
      cabinetId: uuid,
    }, ['name', 'type', 'cabinetId'])),
  }, ['devices']),
  successStatus: '201',
  successSchema: ref('BulkCreateDevicesResult'),
  successDescription: '批量创建设备结果',
  includeBadRequest: true,
}));

addCrudGroup(paths, {
  basePath: apiPath('/panels'),
  tag: 'Panels',
  entityName: '面板',
  entitySchemaName: 'Panel',
  listParameters: [
    queryParam('deviceId', uuid, '按设备筛选'),
    queryParam('type', ref('PanelType'), '按面板类型筛选'),
    queryParam('search', stringSchema, '按名称关键字搜索'),
  ],
  createSchema: objectSchema({
    name: nonEmptyString,
    type: ref('PanelType'),
    shortId: positiveInteger,
    deviceId: uuid,
    templateId: uuid,
    isCustomized: booleanSchema,
    positionX: numberSchema,
    positionY: numberSchema,
    size: ref('PanelSize'),
    backgroundColor: nullable(stringSchema),
    image: nullable(stringSchema),
    svgPath: nullable(stringSchema),
  }, ['name', 'type', 'shortId', 'deviceId']),
  updateSchema: objectSchema({
    id: uuid,
    name: nonEmptyString,
    type: ref('PanelType'),
    shortId: nullable(positiveInteger),
    templateId: nullable(uuid),
    isCustomized: booleanSchema,
    positionX: numberSchema,
    positionY: numberSchema,
    size: ref('PanelSize'),
    backgroundColor: nullable(stringSchema),
    image: nullable(stringSchema),
    svgPath: nullable(stringSchema),
  }, ['id']),
});

addOperation(paths, apiPath('/ports'), 'get', buildOperation({
  tags: ['Ports'],
  summary: '获取端口列表',
  description: '支持按面板、状态与关键字筛选',
  parameters: [
    queryParam('panelId', uuid, '按面板筛选'),
    queryParam('status', ref('PortStatus'), '按端口状态筛选'),
    queryParam('search', stringSchema, '按编号或标签搜索'),
  ],
  successSchema: arrayOf(ref('Port')),
  successDescription: '成功返回端口列表',
}));

addOperation(paths, apiPath('/ports/get'), 'post', buildOperation({
  tags: ['Ports'],
  summary: '获取端口详情',
  requestSchema: objectSchema({ id: uuid }, ['id']),
  successSchema: ref('Port'),
  successDescription: '成功返回端口详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/ports/create'), 'post', buildOperation({
  tags: ['Ports'],
  summary: '创建端口',
  requestSchema: objectSchema({
    number: nonEmptyString,
    label: nullable(stringSchema),
    status: ref('PortStatus'),
    panelId: uuid,
    portType: stringSchema,
    rotation: numberSchema,
    position: ref('Position'),
    size: ref('PanelSize'),
  }, ['number', 'panelId']),
  successStatus: '201',
  successSchema: ref('Port'),
  successDescription: '端口创建成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ports/create-bulk'), 'post', buildOperation({
  tags: ['Ports'],
  summary: '批量创建端口',
  requestSchema: objectSchema({
    panelId: uuid,
    count: positiveInteger,
    prefix: stringSchema,
    useCustomPrefix: booleanSchema,
  }, ['panelId', 'count']),
  successStatus: '201',
  successSchema: objectSchema({
    count: integerSchema,
  }, ['count']),
  successDescription: '批量创建端口结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ports/update'), 'post', buildOperation({
  tags: ['Ports'],
  summary: '更新端口',
  requestSchema: objectSchema({
    id: uuid,
    number: nonEmptyString,
    label: nullable(stringSchema),
    status: ref('PortStatus'),
    portType: stringSchema,
    rotation: numberSchema,
    position: ref('Position'),
    size: ref('PanelSize'),
  }, ['id']),
  successSchema: ref('Port'),
  successDescription: '端口更新成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ports/update-status'), 'post', buildOperation({
  tags: ['Ports'],
  summary: '更新端口状态',
  requestSchema: objectSchema({
    id: uuid,
    status: ref('PortStatus'),
  }, ['id', 'status']),
  successSchema: ref('Port'),
  successDescription: '端口状态更新成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ports/delete'), 'post', buildOperation({
  tags: ['Ports'],
  summary: '删除端口',
  requestSchema: objectSchema({ id: uuid }, ['id']),
  successSchema: ref('SuccessResponse'),
  successDescription: '端口删除成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ports/available'), 'post', buildOperation({
  tags: ['Ports'],
  summary: '获取面板可用端口',
  requestSchema: objectSchema({ panelId: uuid }, ['panelId']),
  successSchema: arrayOf(ref('Port')),
  successDescription: '成功返回可用端口列表',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables'), 'get', buildOperation({
  tags: ['Cables'],
  summary: '获取线缆列表',
  parameters: [
    queryParam('search', stringSchema, '按标签或属性搜索'),
  ],
  successSchema: arrayOf(ref('Cable')),
  successDescription: '成功返回线缆列表',
}));

addOperation(paths, apiPath('/cables/get'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '获取线缆详情',
  requestSchema: objectSchema({ id: uuid }, ['id']),
  successSchema: ref('Cable'),
  successDescription: '成功返回线缆详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/cables/by-shortid'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '根据 shortId 获取线缆详情',
  requestSchema: objectSchema({ shortId: positiveInteger }, ['shortId']),
  successSchema: ref('Cable'),
  successDescription: '成功返回线缆详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/cables/create'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '创建线缆',
  requestSchema: objectSchema({
    label: stringSchema,
    type: enumSchema(CABLE_TYPES_CREATE),
    length: { type: 'number', minimum: 0 },
    color: stringSchema,
    notes: stringSchema,
    portAId: uuid,
    portBId: uuid,
    shortIdA: positiveInteger,
    shortIdB: positiveInteger,
  }, ['type', 'portAId', 'portBId', 'shortIdA', 'shortIdB']),
  successStatus: '201',
  successSchema: ref('Cable'),
  successDescription: '线缆创建成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables/update'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '更新线缆',
  requestSchema: objectSchema({
    id: uuid,
    label: stringSchema,
    type: enumSchema(CABLE_TYPES_CREATE),
    length: { type: 'number', minimum: 0 },
    color: stringSchema,
    notes: stringSchema,
  }, ['id']),
  successSchema: ref('Cable'),
  successDescription: '线缆更新成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables/delete'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '删除线缆',
  requestSchema: objectSchema({ id: uuid }, ['id']),
  successSchema: ref('SuccessResponse'),
  successDescription: '线缆删除成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables/port-connection'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '获取端口连接信息',
  requestSchema: objectSchema({ portId: uuid }, ['portId']),
  successSchema: ref('PortConnectionResult'),
  successDescription: '成功返回端口连接信息',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/cables/panel-connections'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '获取面板连接关系',
  requestSchema: objectSchema({
    panelId: uuid,
    depth: positiveInteger,
  }, ['panelId']),
  successSchema: arrayOf(freeObject),
  successDescription: '成功返回面板连接关系',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables/network-topology'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '获取网络拓扑',
  requestSchema: objectSchema({
    panelId: uuid,
    depth: positiveInteger,
  }, ['panelId']),
  successSchema: freeObject,
  successDescription: '成功返回网络拓扑',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables/endpoints'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '获取线缆端点详情',
  requestSchema: objectSchema({ id: uuid }, ['id']),
  successSchema: ref('CableEndpointLookupResponse'),
  successDescription: '成功返回线缆端点详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/cables/endpoints-by-shortid'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '根据端点 shortId 获取线缆端点详情',
  requestSchema: objectSchema({ shortId: positiveInteger }, ['shortId']),
  successSchema: ref('CableEndpointLookupResponse'),
  successDescription: '成功返回线缆端点详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/cables/manual-inventory'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '手动入库线缆',
  requestSchema: objectSchema({
    shortIdA: positiveInteger,
    shortIdB: positiveInteger,
    label: stringSchema,
    type: ref('CableType'),
    length: { type: 'number', minimum: 0 },
    color: stringSchema,
    notes: stringSchema,
  }, ['shortIdA', 'shortIdB', 'type']),
  successStatus: '201',
  successSchema: ref('Cable'),
  successDescription: '线缆入库成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables/check-shortid'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '检查单个线缆端点 shortId 是否可用',
  requestSchema: objectSchema({ shortId: positiveInteger }, ['shortId']),
  successSchema: ref('CableShortIdCheckResult'),
  successDescription: 'shortId 检查结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables/check-multiple-shortids'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '批量检查线缆端点 shortId 是否可用',
  requestSchema: objectSchema({
    shortIds: arrayOf(positiveInteger),
  }, ['shortIds']),
  successSchema: ref('CableShortIdBatchCheckResult'),
  successDescription: '批量 shortId 检查结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables/connect-single-port'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '单端连接线缆',
  requestDescription: 'panelId 与 portId 至少提供一个；只提供 panelId 时创建悬空端点。',
  requestSchema: objectSchema({
    panelId: uuid,
    portId: uuid,
    shortId: positiveInteger,
    label: stringSchema,
    type: ref('CableType'),
    length: { type: 'number', minimum: 0 },
    color: stringSchema,
    notes: stringSchema,
  }, ['shortId']),
  successStatus: '201',
  successSchema: ref('CableSingleConnectResult'),
  successDescription: '单端连接结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables/dangling-by-device'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '获取设备上的悬空线端点',
  requestSchema: objectSchema({ deviceId: uuid }, ['deviceId']),
  successSchema: ref('CableDanglingByDeviceResult'),
  successDescription: '设备悬空线端点分组',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cables/disconnect-endpoint'), 'post', buildOperation({
  tags: ['Cables'],
  summary: '断开线缆端点连接',
  requestSchema: objectSchema({ shortId: positiveInteger }, ['shortId']),
  successSchema: ref('DisconnectEndpointResult'),
  successDescription: '端点断开结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/panel-templates'), 'get', buildOperation({
  tags: ['PanelTemplates'],
  summary: '获取面板模板列表',
  parameters: [
    queryParam('type', ref('PanelType'), '按面板类型筛选'),
  ],
  successSchema: arrayOf(ref('PanelTemplate')),
  successDescription: '成功返回模板列表',
}));

addOperation(paths, apiPath('/panel-templates'), 'post', buildOperation({
  tags: ['PanelTemplates'],
  summary: '创建面板模板',
  requestSchema: objectSchema({
    name: nonEmptyString,
    type: ref('PanelType'),
    portCount: positiveInteger,
    description: stringSchema,
    width: numberSchema,
    height: numberSchema,
    layoutConfig: freeObject,
    portDefinitions: arrayOf(portDefinitionSchema),
    backgroundColor: stringSchema,
    image: stringSchema,
    svgPath: stringSchema,
    isSystem: booleanSchema,
  }, ['name', 'type', 'portCount']),
  successStatus: '201',
  successSchema: ref('PanelTemplate'),
  successDescription: '模板创建成功',
  includeBadRequest: true,
}));

addOperation(paths, `${apiPath('/panel-templates')}/{id}`, 'get', buildOperation({
  tags: ['PanelTemplates'],
  summary: '获取面板模板详情',
  parameters: [
    routeParam('id', uuid, '模板 ID'),
  ],
  successSchema: ref('PanelTemplate'),
  successDescription: '成功返回模板详情',
  includeNotFound: true,
}));

addOperation(paths, `${apiPath('/panel-templates')}/{id}`, 'put', buildOperation({
  tags: ['PanelTemplates'],
  summary: '更新面板模板',
  parameters: [
    routeParam('id', uuid, '模板 ID'),
  ],
  requestSchema: objectSchema({
    name: nonEmptyString,
    type: ref('PanelType'),
    portCount: positiveInteger,
    description: stringSchema,
    width: numberSchema,
    height: numberSchema,
    layoutConfig: freeObject,
    portDefinitions: arrayOf(portDefinitionSchema),
    backgroundColor: stringSchema,
    image: stringSchema,
    svgPath: stringSchema,
    isSystem: booleanSchema,
  }),
  successSchema: ref('PanelTemplate'),
  successDescription: '模板更新成功',
  includeBadRequest: true,
}));

addOperation(paths, `${apiPath('/panel-templates')}/{id}`, 'delete', buildOperation({
  tags: ['PanelTemplates'],
  summary: '删除面板模板',
  parameters: [
    routeParam('id', uuid, '模板 ID'),
  ],
  successStatus: '204',
  successSchema: null,
  successDescription: '模板删除成功',
  includeBadRequest: true,
}));

addOperation(paths, `${apiPath('/panel-templates')}/{id}/create-panel`, 'post', buildOperation({
  tags: ['PanelTemplates'],
  summary: '从模板创建面板',
  parameters: [
    routeParam('id', uuid, '模板 ID'),
  ],
  requestSchema: objectSchema({
    deviceId: uuid,
    panelName: stringSchema,
    shortId: positiveInteger,
  }, ['deviceId']),
  successStatus: '201',
  successSchema: ref('PanelTemplateCreatePanelResult'),
  successDescription: '基于模板创建面板成功',
  includeBadRequest: true,
}));

addOperation(paths, `${apiPath('/panel-templates/unbind')}/{panelId}`, 'post', buildOperation({
  tags: ['PanelTemplates'],
  summary: '解绑面板与模板',
  parameters: [
    routeParam('panelId', uuid, '面板 ID'),
  ],
  successSchema: ref('Panel'),
  successDescription: '模板解绑成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/panel-templates/init-system-templates'), 'post', buildOperation({
  tags: ['PanelTemplates'],
  summary: '初始化系统预设模板',
  successSchema: objectSchema({
    message: stringSchema,
  }, ['message']),
  successDescription: '系统模板初始化成功',
}));

addOperation(paths, apiPath('/search/global'), 'post', buildOperation({
  tags: ['Search'],
  summary: '全局搜索',
  requestSchema: objectSchema({
    query: nonEmptyString,
  }, ['query']),
  successSchema: arrayOf(ref('SearchResult')),
  successDescription: '搜索结果列表',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/search/by-shortid'), 'post', buildOperation({
  tags: ['Search'],
  summary: '根据 shortId 查询实体',
  requestSchema: objectSchema({
    shortId: positiveInteger,
  }, ['shortId']),
  successSchema: ref('SearchResult'),
  successDescription: '成功返回匹配实体',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/shortid-pool/generate'), 'post', buildOperation({
  tags: ['ShortIdPool'],
  summary: '批量生成 shortId',
  requestSchema: objectSchema({
    count: { type: 'integer', minimum: 1, maximum: 10000 },
    batchNo: stringSchema,
  }, ['count']),
  successStatus: '201',
  successSchema: objectSchema({
    success: booleanSchema,
    message: stringSchema,
    shortIds: arrayOf(integerSchema),
  }, ['success', 'message', 'shortIds']),
  successDescription: 'shortId 生成结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/shortid-pool/print-task/create'), 'post', buildOperation({
  tags: ['ShortIdPool'],
  summary: '创建 shortId 打印任务',
  requestSchema: objectSchema({
    name: nonEmptyString,
    count: { type: 'integer', minimum: 1, maximum: 10000 },
    createdBy: stringSchema,
    notes: stringSchema,
  }, ['name', 'count']),
  successStatus: '201',
  successSchema: objectSchema({
    success: booleanSchema,
    message: stringSchema,
    printTask: ref('PrintTask'),
    shortIds: arrayOf(integerSchema),
  }, ['success', 'message', 'printTask', 'shortIds']),
  successDescription: '打印任务创建成功',
  includeBadRequest: true,
}));

addOperation(paths, `${apiPath('/shortid-pool/print-task')}/{id}/export`, 'get', buildOperation({
  tags: ['ShortIdPool'],
  summary: '导出打印任务 CSV',
  parameters: [
    routeParam('id', uuid, '打印任务 ID'),
  ],
  successStatus: '200',
  successSchema: null,
  successDescription: '导出成功',
  includeServerError: false,
  extraResponses: {
    '200': textCsvResponse('shortId 打印 CSV 文件'),
    '404': jsonResponse(ref('ErrorResponse'), '打印任务不存在'),
    '500': jsonResponse(ref('ErrorResponse'), '服务器错误'),
  },
}));

addOperation(paths, `${apiPath('/shortid-pool/print-task')}/{id}/complete`, 'post', buildOperation({
  tags: ['ShortIdPool'],
  summary: '标记打印任务完成',
  parameters: [
    routeParam('id', uuid, '打印任务 ID'),
  ],
  requestSchema: objectSchema({
    filePath: stringSchema,
  }),
  successSchema: objectSchema({
    success: booleanSchema,
    message: stringSchema,
    task: ref('PrintTask'),
  }, ['success', 'message', 'task']),
  successDescription: '打印任务完成',
}));

addOperation(paths, apiPath('/shortid-pool/check'), 'post', buildOperation({
  tags: ['ShortIdPool'],
  summary: '检查 shortId 是否存在',
  requestSchema: objectSchema({
    shortId: shortIdValue,
  }, ['shortId']),
  successSchema: objectSchema({
    exists: booleanSchema,
    usedBy: nullable(stringSchema),
    entityType: nullable(ref('ShortIdPoolEntityType')),
    details: nullable(freeObject),
  }, ['exists']),
  successDescription: 'shortId 检查结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/shortid-pool/bind'), 'post', buildOperation({
  tags: ['ShortIdPool'],
  summary: '绑定 shortId 到实体',
  requestSchema: objectSchema({
    shortId: shortIdValue,
    entityType: ref('ShortIdPoolEntityType'),
    entityId: uuid,
  }, ['shortId', 'entityType', 'entityId']),
  successSchema: ref('SuccessResponse'),
  successDescription: 'shortId 绑定成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/shortid-pool/cancel'), 'post', buildOperation({
  tags: ['ShortIdPool'],
  summary: '报废 shortId',
  requestSchema: objectSchema({
    shortId: shortIdValue,
    reason: stringSchema,
  }, ['shortId']),
  successSchema: ref('SuccessResponse'),
  successDescription: 'shortId 已报废',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/shortid-pool/batch-cancel'), 'post', buildOperation({
  tags: ['ShortIdPool'],
  summary: '按范围批量报废 shortId',
  requestSchema: objectSchema({
    rangeExpr: nonEmptyString,
    reason: stringSchema,
  }, ['rangeExpr']),
  successSchema: objectSchema({
    success: booleanSchema,
    message: stringSchema,
    totalRequested: integerSchema,
    successCount: integerSchema,
    failedCount: integerSchema,
    successIds: arrayOf(stringSchema),
    failedDetails: arrayOf(objectSchema({
      shortId: stringSchema,
      reason: stringSchema,
    }, ['shortId', 'reason'])),
  }, ['success', 'message', 'totalRequested', 'successCount', 'failedCount', 'successIds', 'failedDetails']),
  successDescription: '批量报废结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/shortid-pool/stats'), 'get', buildOperation({
  tags: ['ShortIdPool'],
  summary: '获取 shortId 池统计信息',
  parameters: [
    queryParam('entityType', ref('ShortIdPoolEntityType'), '按实体类型筛选'),
  ],
  successSchema: ref('ShortIdPoolStats'),
  successDescription: 'shortId 池统计信息',
}));

addOperation(paths, apiPath('/shortid-pool/records'), 'post', buildOperation({
  tags: ['ShortIdPool'],
  summary: '分页获取 shortId 池记录',
  requestSchema: objectSchema({
    page: positiveInteger,
    pageSize: { type: 'integer', minimum: 1, maximum: 200 },
    entityType: ref('ShortIdPoolEntityType'),
    status: ref('ShortIdPoolStatus'),
    batchNo: stringSchema,
    search: stringSchema,
  }),
  successSchema: ref('PagedShortIdPoolRecords'),
  successDescription: 'shortId 池记录列表',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/shortid-pool/print-tasks'), 'post', buildOperation({
  tags: ['ShortIdPool'],
  summary: '分页获取打印任务列表',
  requestSchema: objectSchema({
    page: positiveInteger,
    pageSize: { type: 'integer', minimum: 1, maximum: 200 },
    status: stringSchema,
  }),
  successSchema: ref('PagedPrintTasks'),
  successDescription: '打印任务列表',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cable-shortid-pool/generate'), 'post', buildOperation({
  tags: ['CableShortIdPool'],
  summary: '批量生成线缆端点 shortId',
  requestSchema: objectSchema({
    count: { type: 'integer', minimum: 1, maximum: 10000 },
    notes: stringSchema,
  }, ['count']),
  successStatus: '201',
  successSchema: objectSchema({
    success: booleanSchema,
    message: stringSchema,
    shortIds: arrayOf(integerSchema),
  }, ['success', 'message', 'shortIds']),
  successDescription: '线缆端点 shortId 生成结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cable-shortid-pool/check'), 'post', buildOperation({
  tags: ['CableShortIdPool'],
  summary: '检查线缆端点 shortId 是否已存在',
  requestSchema: objectSchema({
    shortId: positiveInteger,
  }, ['shortId']),
  successSchema: objectSchema({
    exists: booleanSchema,
    usedBy: nullable(stringSchema),
    details: nullable(freeObject),
  }, ['exists']),
  successDescription: '线缆端点 shortId 检查结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cable-shortid-pool/available'), 'post', buildOperation({
  tags: ['CableShortIdPool'],
  summary: '获取可用线缆端点 shortId 列表',
  requestSchema: objectSchema({
    limit: positiveInteger,
  }),
  successSchema: objectSchema({
    success: booleanSchema,
    count: integerSchema,
    shortIds: arrayOf(integerSchema),
  }, ['success', 'count', 'shortIds']),
  successDescription: '可用 shortId 列表',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cable-shortid-pool/cancel'), 'post', buildOperation({
  tags: ['CableShortIdPool'],
  summary: '作废线缆端点 shortId',
  requestSchema: objectSchema({
    shortId: positiveInteger,
    reason: stringSchema,
  }, ['shortId']),
  successSchema: ref('SuccessResponse'),
  successDescription: '线缆端点 shortId 已作废',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/cable-shortid-pool/stats'), 'get', buildOperation({
  tags: ['CableShortIdPool'],
  summary: '获取线缆端点 shortId 池统计信息',
  successSchema: ref('CableShortIdPoolStats'),
  successDescription: '线缆端点 shortId 池统计信息',
}));

addOperation(paths, apiPath('/cable-shortid-pool/records'), 'post', buildOperation({
  tags: ['CableShortIdPool'],
  summary: '分页获取线缆端点 shortId 池记录',
  requestSchema: objectSchema({
    page: positiveInteger,
    pageSize: positiveInteger,
  }),
  successSchema: ref('PagedCableShortIdPoolRecords'),
  successDescription: '线缆端点 shortId 池记录',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/optical-modules'), 'post', buildOperation({
  tags: ['OpticalModules'],
  summary: '采购入库光模块',
  requestSchema: objectSchema({
    serialNo: nonEmptyString,
    model: nonEmptyString,
    vendor: nonEmptyString,
    moduleType: ref('ModuleType'),
    wavelength: stringSchema,
    distance: stringSchema,
    ddmSupport: booleanSchema,
    supplier: stringSchema,
    purchaseDate: dateTime,
    price: { type: 'number', minimum: 0 },
    warrantyExpiry: dateTime,
    notes: stringSchema,
  }, ['serialNo', 'model', 'vendor', 'moduleType']),
  successStatus: '201',
  successSchema: ref('OpticalModule'),
  successDescription: '光模块入库成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/optical-modules'), 'get', buildOperation({
  tags: ['OpticalModules'],
  summary: '查询光模块列表',
  parameters: [
    queryParam('status', ref('ModuleStatus'), '按状态筛选'),
    queryParam('moduleType', stringSchema, '按模块类型筛选'),
    queryParam('vendor', stringSchema, '按厂商筛选'),
    queryParam('isInstalled', booleanSchema, '是否已安装'),
    queryParam('search', stringSchema, '按序列号或型号搜索'),
  ],
  successSchema: arrayOf(ref('OpticalModule')),
  successDescription: '光模块列表',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/optical-modules/get'), 'post', buildOperation({
  tags: ['OpticalModules'],
  summary: '根据 ID 获取光模块详情',
  requestSchema: objectSchema({
    id: stringSchema,
  }, ['id']),
  successSchema: ref('OpticalModule'),
  successDescription: '光模块详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/optical-modules/by-serial'), 'post', buildOperation({
  tags: ['OpticalModules'],
  summary: '根据序列号获取光模块详情',
  requestSchema: objectSchema({
    serialNo: nonEmptyString,
  }, ['serialNo']),
  successSchema: ref('OpticalModule'),
  successDescription: '光模块详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, `${apiPath('/optical-modules')}/{id}/update`, 'post', buildOperation({
  tags: ['OpticalModules'],
  summary: '更新光模块信息',
  parameters: [
    routeParam('id', stringSchema, '光模块 ID'),
  ],
  requestSchema: objectSchema({
    model: stringSchema,
    vendor: stringSchema,
    moduleType: ref('ModuleType'),
    wavelength: stringSchema,
    distance: stringSchema,
    ddmSupport: booleanSchema,
    supplier: stringSchema,
    purchaseDate: dateTime,
    price: { type: 'number', minimum: 0 },
    warrantyExpiry: dateTime,
    notes: stringSchema,
  }),
  successSchema: ref('OpticalModule'),
  successDescription: '光模块更新成功',
  includeBadRequest: true,
}));

addOperation(paths, `${apiPath('/optical-modules')}/{id}/install`, 'post', buildOperation({
  tags: ['OpticalModules'],
  summary: '将光模块安装到端口',
  parameters: [
    routeParam('id', stringSchema, '光模块 ID'),
  ],
  requestSchema: objectSchema({
    portId: uuid,
    operator: stringSchema,
    notes: stringSchema,
  }, ['portId']),
  successSchema: ref('OpticalModule'),
  successDescription: '光模块安装成功',
  includeBadRequest: true,
}));

addOperation(paths, `${apiPath('/optical-modules')}/{id}/uninstall`, 'post', buildOperation({
  tags: ['OpticalModules'],
  summary: '从端口卸下光模块',
  parameters: [
    routeParam('id', stringSchema, '光模块 ID'),
  ],
  requestSchema: objectSchema({
    operator: stringSchema,
    notes: stringSchema,
  }),
  successSchema: ref('OpticalModule'),
  successDescription: '光模块卸载成功',
  includeBadRequest: true,
}));

addOperation(paths, `${apiPath('/optical-modules')}/{id}/transfer`, 'post', buildOperation({
  tags: ['OpticalModules'],
  summary: '转移光模块到其他端口',
  parameters: [
    routeParam('id', stringSchema, '光模块 ID'),
  ],
  requestSchema: objectSchema({
    targetPortId: uuid,
    operator: stringSchema,
    notes: stringSchema,
  }, ['targetPortId']),
  successSchema: ref('OpticalModule'),
  successDescription: '光模块转移成功',
  includeBadRequest: true,
}));

addOperation(paths, `${apiPath('/optical-modules')}/{id}/scrap`, 'post', buildOperation({
  tags: ['OpticalModules'],
  summary: '报废光模块',
  parameters: [
    routeParam('id', stringSchema, '光模块 ID'),
  ],
  requestSchema: objectSchema({
    operator: stringSchema,
    notes: stringSchema,
  }),
  successSchema: ref('OpticalModule'),
  successDescription: '光模块报废成功',
  includeBadRequest: true,
}));

addOperation(paths, `${apiPath('/optical-modules')}/{id}/history`, 'post', buildOperation({
  tags: ['OpticalModules'],
  summary: '获取光模块移动历史',
  parameters: [
    routeParam('id', stringSchema, '光模块 ID'),
  ],
  successSchema: arrayOf(ref('ModuleMovement')),
  successDescription: '光模块移动历史',
}));

addOperation(paths, `${apiPath('/optical-modules')}/{id}`, 'delete', buildOperation({
  tags: ['OpticalModules'],
  summary: '删除光模块',
  parameters: [
    routeParam('id', stringSchema, '光模块 ID'),
  ],
  successSchema: objectSchema({
    message: stringSchema,
  }, ['message']),
  successDescription: '光模块删除成功',
}));

addOperation(paths, apiPath('/optical-modules/statistics'), 'get', buildOperation({
  tags: ['OpticalModules'],
  summary: '获取光模块统计信息',
  successSchema: ref('OpticalModuleStatistics'),
  successDescription: '光模块统计信息',
}));

addOperation(paths, apiPath('/subnets/create'), 'post', buildOperation({
  tags: ['Subnets'],
  summary: '创建子网',
  requestSchema: objectSchema({
    name: nonEmptyString,
    network: stringSchema,
    cidr: { type: 'integer', minimum: 0, maximum: 32 },
    gateway: stringSchema,
    vlan: stringSchema,
    dnsServers: arrayOf(stringSchema),
    description: stringSchema,
    roomId: uuid,
    autoGenerateIps: booleanSchema,
    reservedIps: arrayOf(stringSchema),
  }, ['name', 'network', 'cidr']),
  successStatus: '201',
  successSchema: ref('IpSubnet'),
  successDescription: '子网创建成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/subnets'), 'get', buildOperation({
  tags: ['Subnets'],
  summary: '查询子网列表',
  parameters: [
    queryParam('roomId', uuid, '按机房筛选'),
    queryParam('vlan', stringSchema, '按 VLAN 筛选'),
    queryParam('search', stringSchema, '按名称或网段搜索'),
  ],
  successSchema: arrayOf(ref('IpSubnet')),
  successDescription: '子网列表',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/subnets/get'), 'post', buildOperation({
  tags: ['Subnets'],
  summary: '获取子网详情',
  requestSchema: objectSchema({ id: uuid }, ['id']),
  successSchema: ref('IpSubnet'),
  successDescription: '子网详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/subnets/update'), 'post', buildOperation({
  tags: ['Subnets'],
  summary: '更新子网信息',
  requestSchema: objectSchema({
    id: uuid,
    name: stringSchema,
    gateway: stringSchema,
    vlan: stringSchema,
    dnsServers: arrayOf(stringSchema),
    description: stringSchema,
    roomId: nullable(uuid),
  }, ['id']),
  successSchema: ref('IpSubnet'),
  successDescription: '子网更新成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/subnets/delete'), 'post', buildOperation({
  tags: ['Subnets'],
  summary: '删除子网',
  requestSchema: objectSchema({ id: uuid }, ['id']),
  successSchema: ref('SuccessResponse'),
  successDescription: '子网删除成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/subnets/calculate'), 'post', buildOperation({
  tags: ['Subnets'],
  summary: '计算子网信息',
  requestSchema: objectSchema({
    network: stringSchema,
    cidr: { type: 'integer', minimum: 0, maximum: 32 },
  }, ['network', 'cidr']),
  successSchema: ref('SubnetCalculationResult'),
  successDescription: '子网计算结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/subnets/statistics'), 'get', buildOperation({
  tags: ['Subnets'],
  summary: '获取子网统计信息',
  successSchema: ref('SubnetStatistics'),
  successDescription: '子网统计信息',
}));

addOperation(paths, apiPath('/ip-addresses/allocate'), 'post', buildOperation({
  tags: ['IPAddresses'],
  summary: '分配 IP 地址',
  requestSchema: objectSchema({
    ipAddressId: uuid,
    portId: uuid,
    deviceId: uuid,
    hostname: stringSchema,
    macAddress: stringSchema,
    description: stringSchema,
  }, ['ipAddressId']),
  successSchema: ref('IpAddress'),
  successDescription: 'IP 地址分配成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ip-addresses/release'), 'post', buildOperation({
  tags: ['IPAddresses'],
  summary: '释放 IP 地址',
  requestSchema: objectSchema({
    ipAddressId: uuid,
    clearHostname: booleanSchema,
    clearMacAddress: booleanSchema,
    clearDescription: booleanSchema,
  }, ['ipAddressId']),
  successSchema: ref('IpAddress'),
  successDescription: 'IP 地址释放成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ip-addresses/batch-allocate'), 'post', buildOperation({
  tags: ['IPAddresses'],
  summary: '批量分配 IP 地址',
  requestSchema: objectSchema({
    subnetId: uuid,
    targets: arrayOf(objectSchema({
      portId: uuid,
      deviceId: uuid,
      hostname: stringSchema,
      macAddress: stringSchema,
    })),
  }, ['subnetId', 'targets']),
  successSchema: arrayOf(ref('IpAddress')),
  successDescription: '批量分配结果',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ip-addresses/next-available'), 'post', buildOperation({
  tags: ['IPAddresses'],
  summary: '获取下一个可用 IP',
  requestSchema: objectSchema({
    subnetId: uuid,
  }, ['subnetId']),
  successSchema: ref('IpAddress'),
  successDescription: '下一个可用 IP',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/ip-addresses'), 'get', buildOperation({
  tags: ['IPAddresses'],
  summary: '查询 IP 地址列表',
  parameters: [
    queryParam('subnetId', uuid, '按子网筛选'),
    queryParam('status', ref('IpStatus'), '按状态筛选'),
    queryParam('portId', uuid, '按端口筛选'),
    queryParam('deviceId', uuid, '按设备筛选'),
    queryParam('search', stringSchema, '按地址、主机名或 MAC 搜索'),
  ],
  successSchema: arrayOf(ref('IpAddress')),
  successDescription: 'IP 地址列表',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ip-addresses/get'), 'post', buildOperation({
  tags: ['IPAddresses'],
  summary: '获取 IP 地址详情',
  requestSchema: objectSchema({ id: uuid }, ['id']),
  successSchema: ref('IpAddress'),
  successDescription: 'IP 地址详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/ip-addresses/get-by-address'), 'post', buildOperation({
  tags: ['IPAddresses'],
  summary: '根据地址查询 IP 详情',
  requestSchema: objectSchema({
    address: nonEmptyString,
  }, ['address']),
  successSchema: ref('IpAddress'),
  successDescription: 'IP 地址详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/ip-addresses/update'), 'post', buildOperation({
  tags: ['IPAddresses'],
  summary: '更新 IP 地址信息',
  requestSchema: objectSchema({
    id: uuid,
    hostname: stringSchema,
    macAddress: stringSchema,
    description: stringSchema,
    status: ref('IpStatus'),
  }, ['id']),
  successSchema: ref('IpAddress'),
  successDescription: 'IP 地址更新成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ip-addresses/delete'), 'post', buildOperation({
  tags: ['IPAddresses'],
  summary: '删除 IP 地址',
  requestSchema: objectSchema({ id: uuid }, ['id']),
  successSchema: ref('SuccessResponse'),
  successDescription: 'IP 地址删除成功',
  includeBadRequest: true,
}));

addOperation(paths, apiPath('/ip-addresses/check-conflicts'), 'post', buildOperation({
  tags: ['IPAddresses'],
  summary: '检查 IP 冲突',
  requestSchema: objectSchema({
    subnetId: uuid,
  }),
  successSchema: arrayOf(ref('IpConflictGroup')),
  successDescription: 'IP 冲突检查结果',
  includeBadRequest: true,
}));

addCrudGroup(paths, {
  basePath: apiPath('/workstations'),
  tag: 'Workstations',
  entityName: '工作站',
  entitySchemaName: 'Workstation',
  listParameters: [
    queryParam('roomId', uuid, '按机房筛选'),
    queryParam('search', stringSchema, '按名称或编号搜索'),
  ],
  createSchema: objectSchema({
    name: nonEmptyString,
    code: stringSchema,
    roomId: uuid,
    cpu: stringSchema,
    memory: stringSchema,
    storage: stringSchema,
    gpu: stringSchema,
    os: stringSchema,
    status: ref('WorkstationStatus'),
    assignedTo: stringSchema,
    ipAddress: stringSchema,
    macAddress: stringSchema,
    floorPlanPosition: ref('Position'),
    floorPlanSize: ref('FloorPlanSize'),
    notes: stringSchema,
  }, ['name', 'roomId']),
  updateSchema: objectSchema({
    id: uuid,
    name: nonEmptyString,
    code: stringSchema,
    cpu: stringSchema,
    memory: stringSchema,
    storage: stringSchema,
    gpu: stringSchema,
    os: stringSchema,
    status: ref('WorkstationStatus'),
    assignedTo: stringSchema,
    ipAddress: stringSchema,
    macAddress: stringSchema,
    floorPlanPosition: ref('Position'),
    floorPlanSize: ref('FloorPlanSize'),
    notes: stringSchema,
  }, ['id']),
  supportsShortId: false,
});

addOperation(paths, apiPath('/workstations/by-code'), 'post', buildOperation({
  tags: ['Workstations'],
  summary: '根据编号获取工作站详情',
  requestSchema: objectSchema({
    code: nonEmptyString,
  }, ['code']),
  successSchema: ref('Workstation'),
  successDescription: '工作站详情',
  includeBadRequest: true,
  includeNotFound: true,
}));

addOperation(paths, apiPath('/workstations/update-status'), 'post', buildOperation({
  tags: ['Workstations'],
  summary: '更新工作站状态',
  requestSchema: objectSchema({
    id: uuid,
    status: ref('WorkstationStatus'),
  }, ['id', 'status']),
  successSchema: ref('Workstation'),
  successDescription: '工作站状态更新成功',
  includeBadRequest: true,
}));

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'DCAgent API',
    version: '1.0.0',
    description: '根据 backend/src/routes 与 prisma/schema.prisma 生成的接口规范。仅收录已在 app.ts 中挂载的后端接口。',
  },
  servers: [
    {
      url: API_BASE_URL,
      description: '本地开发服务器',
    },
  ],
  tags: [
    { name: 'System', description: '系统状态与 API 根信息' },
    { name: 'DataCenters', description: '数据中心管理' },
    { name: 'Rooms', description: '机房管理' },
    { name: 'Cabinets', description: '机柜管理' },
    { name: 'Devices', description: '设备管理' },
    { name: 'Panels', description: '面板管理' },
    { name: 'Ports', description: '端口管理' },
    { name: 'Cables', description: '线缆管理' },
    { name: 'PanelTemplates', description: '面板模板管理' },
    { name: 'Search', description: '全局搜索' },
    { name: 'ShortIdPool', description: '统一 shortId 池管理' },
    { name: 'CableShortIdPool', description: '线缆端点 shortId 池管理' },
    { name: 'OpticalModules', description: '光模块管理' },
    { name: 'Subnets', description: '子网管理' },
    { name: 'IPAddresses', description: 'IP 地址管理' },
    { name: 'Workstations', description: '工作站管理' },
  ],
  components,
  paths,
};

function writeSpecFiles(openapiSpec) {
  const openapiJsonPath = path.join(backendDir, 'openapi.json');
  const openapiYamlPath = path.join(backendDir, 'openapi.yaml');
  const serialized = `${JSON.stringify(openapiSpec, null, 2)}\n`;

  fs.writeFileSync(openapiJsonPath, serialized, 'utf8');
  fs.writeFileSync(openapiYamlPath, serialized, 'utf8');
}

function getOperationCount(openapiSpec) {
  return Object.values(openapiSpec.paths).reduce((count, methods) => {
    return count + Object.keys(methods).length;
  }, 0);
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

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function importToApifox(openapiSpec) {
  const mcpConfig = loadApifoxConfigFromMcp();
  const projectId = parseArgValue('--project-id') || process.env.APIFOX_PROJECT_ID || mcpConfig.projectId;
  const accessToken = process.env.APIFOX_ACCESS_TOKEN || mcpConfig.accessToken;

  if (!projectId || !accessToken) {
    throw new Error('Missing Apifox project id or access token. Set APIFOX_PROJECT_ID / APIFOX_ACCESS_TOKEN or provide them in .mcp.json.');
  }

  const response = await fetch(`https://api.apifox.com/v1/projects/${projectId}/import-openapi?locale=zh-CN`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Apifox-Api-Version': '2024-03-28',
    },
    body: JSON.stringify({
      input: JSON.stringify(openapiSpec),
      options: {
        endpointOverwriteBehavior: 'OVERWRITE_EXISTING',
        endpointCaseOverwriteBehavior: 'OVERWRITE_EXISTING',
        schemaOverwriteBehavior: 'OVERWRITE_EXISTING',
        updateFolderOfChangedEndpoint: false,
        prependBasePath: false,
        deleteUnmatchedResources: hasFlag('--delete-unmatched'),
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Apifox import failed (${response.status}): ${raw}`);
  }

  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }

  console.log(`Imported OpenAPI spec to Apifox project ${projectId}.`);
  if (parsed) {
    console.log(JSON.stringify(parsed, null, 2));
  }
}

async function main() {
  writeSpecFiles(spec);

  const pathCount = Object.keys(spec.paths).length;
  const operationCount = getOperationCount(spec);
  console.log(`Generated OpenAPI spec with ${operationCount} operations across ${pathCount} paths.`);
  console.log(`Wrote ${path.join(backendDir, 'openapi.json')}`);
  console.log(`Wrote ${path.join(backendDir, 'openapi.yaml')}`);

  if (process.argv.includes('--import')) {
    await importToApifox(spec);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
