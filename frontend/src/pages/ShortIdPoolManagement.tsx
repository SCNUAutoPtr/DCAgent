import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Statistic,
  Row,
  Col,
  Popconfirm,
  Typography,
  Descriptions,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PrinterOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import {
  shortIdPoolService,
  EntityType,
  ShortIdPoolStatus,
  ShortIdPoolRecord,
  PrintTask,
  PoolStats,
} from '@/services/shortIdPoolService';
import { ShortIdFormatter } from "@/utils/shortIdFormatter";

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const ShortIdPoolManagement: React.FC = () => {
  const { t } = useTranslation('management');
  const [activeTab, setActiveTab] = useState('pool');
  const [loading, setLoading] = useState(false);

  // Pool records state
  const [poolRecords, setPoolRecords] = useState<ShortIdPoolRecord[]>([]);
  const [poolTotal, setPoolTotal] = useState(0);
  const [poolPage, setPoolPage] = useState(1);
  const [poolPageSize, setPoolPageSize] = useState(50);
  const [poolFilters, setPoolFilters] = useState<{
    entityType?: EntityType;
    status?: ShortIdPoolStatus;
    search?: string;
  }>({});

  // Print tasks state
  const [printTasks, setPrintTasks] = useState<PrintTask[]>([]);
  const [printTasksTotal, setPrintTasksTotal] = useState(0);
  const [printTasksPage, setPrintTasksPage] = useState(1);
  const [printTasksPageSize, setPrintTasksPageSize] = useState(50);

  // Stats state
  const [stats, setStats] = useState<PoolStats | null>(null);

  // Modal state
  const [createTaskModalVisible, setCreateTaskModalVisible] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [batchCancelModalVisible, setBatchCancelModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ShortIdPoolRecord | null>(null);

  const [form] = Form.useForm();
  const [cancelForm] = Form.useForm();
  const [batchCancelForm] = Form.useForm();

  useEffect(() => {
    loadPoolRecords();
    loadStats();
  }, [poolPage, poolPageSize, poolFilters]);

  useEffect(() => {
    if (activeTab === 'tasks') {
      loadPrintTasks();
    } else if (activeTab === 'pool') {
      loadPoolRecords();
      loadStats();
    }
  }, [activeTab, printTasksPage, printTasksPageSize]);

  // Load pool records
  const loadPoolRecords = async () => {
    setLoading(true);
    try {
      const result = await shortIdPoolService.getPoolRecords({
        page: poolPage,
        pageSize: poolPageSize,
        ...poolFilters,
      });
      setPoolRecords(result.records);
      setPoolTotal(result.total);
    } catch (error) {
      console.error('Error loading pool records:', error);
      message.error(t('shortIdPool.messages.loadPoolRecordsFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Load print tasks
  const loadPrintTasks = async () => {
    setLoading(true);
    try {
      const result = await shortIdPoolService.getPrintTasks({
        page: printTasksPage,
        pageSize: printTasksPageSize,
      });
      setPrintTasks(result.records);
      setPrintTasksTotal(result.total);
    } catch (error) {
      console.error('Error loading print tasks:', error);
      message.error(t('shortIdPool.messages.loadPrintTasksFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const result = await shortIdPoolService.getPoolStats();
      setStats(result);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Create print task
  const handleCreatePrintTask = async (values: any) => {
    try {
      const result = await shortIdPoolService.createPrintTask(
        values.name,
        values.count,
        values.createdBy,
        values.notes
      );
      message.success(result.message);
      setCreateTaskModalVisible(false);
      form.resetFields();
      loadPrintTasks();
      loadStats();
    } catch (error: any) {
      console.error('Error creating print task:', error);
      message.error(error.response?.data?.error || t('shortIdPool.messages.createPrintTaskFailed'));
    }
  };

  // Generate shortIds directly
  const handleGenerate = async (values: any) => {
    try {
      const result = await shortIdPoolService.generateShortIds(
        values.count,
        values.batchNo
      );
      message.success(result.message);
      setGenerateModalVisible(false);
      form.resetFields();
      loadPoolRecords();
      loadStats();
    } catch (error: any) {
      console.error('Error generating shortIds:', error);
      message.error(error.response?.data?.error || t('shortIdPool.messages.generateShortIdFailed'));
    }
  };

  // Export print task
  const handleExportPrintTask = async (taskId: string, taskName: string) => {
    try {
      const blob = await shortIdPoolService.exportPrintTask(taskId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shortids_${taskName}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success(t('shortIdPool.messages.exportSuccess'));
    } catch (error) {
      console.error('Error exporting print task:', error);
      message.error(t('shortIdPool.messages.exportFailed'));
    }
  };

  // Complete print task
  const handleCompletePrintTask = async (taskId: string) => {
    try {
      await shortIdPoolService.completePrintTask(taskId);
      message.success(t('shortIdPool.messages.completePrintTaskSuccess'));
      loadPrintTasks();
      loadStats();
    } catch (error) {
      console.error('Error completing print task:', error);
      message.error(t('shortIdPool.messages.completePrintTaskFailed'));
    }
  };

  // Cancel shortId
  const handleCancelShortId = async () => {
    if (!selectedRecord) return;

    try {
      const values = await cancelForm.validateFields();
      await shortIdPoolService.cancelShortId(
        selectedRecord.shortId,
        values.reason
      );
      message.success(t('shortIdPool.messages.scrapShortIdSuccess'));
      setCancelModalVisible(false);
      cancelForm.resetFields();
      setSelectedRecord(null);
      loadPoolRecords();
      loadStats();
    } catch (error: any) {
      console.error('Error cancelling shortId:', error);
      message.error(error.response?.data?.error || t('shortIdPool.messages.scrapShortIdFailed'));
    }
  };

  // Batch cancel shortIds
  const handleBatchCancelShortIds = async () => {
    try {
      const values = await batchCancelForm.validateFields();
      const result = await shortIdPoolService.batchCancelShortIds(
        values.rangeExpr,
        values.reason
      );

      // 显示结果
      if (result.failedCount > 0) {
        Modal.warning({
          title: t('shortIdPool.messages.batchScrapPartialSuccess'),
          content: (
            <div>
              <p>
                {t('shortIdPool.messages.batchScrapSuccessCount', { count: result.successCount })}
              </p>
              <p>
                {t('shortIdPool.messages.batchScrapFailedCount', { count: result.failedCount })}
              </p>
              <div style={{ marginTop: 16, maxHeight: 300, overflow: 'auto' }}>
                <Text strong>{t('shortIdPool.messages.failedDetails')}:</Text>
                <ul>
                  {result.failedDetails.map((detail, index) => (
                    <li key={index}>
                      <Text code>{detail.shortId}</Text> - {detail.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ),
          width: 600,
        });
      } else {
        message.success(result.message);
      }

      setBatchCancelModalVisible(false);
      batchCancelForm.resetFields();
      loadPoolRecords();
      loadStats();
    } catch (error: any) {
      console.error('Error batch cancelling shortIds:', error);
      message.error(error.response?.data?.error || t('shortIdPool.messages.batchScrapFailed'));
    }
  };

  // Entity type name mapping
  const entityTypeNameMap: Record<EntityType, string> = {
    DATA_CENTER: t('shortIdPool.entityTypes.DATA_CENTER'),
    ROOM: t('shortIdPool.entityTypes.ROOM'),
    CABINET: t('shortIdPool.entityTypes.CABINET'),
    DEVICE: t('shortIdPool.entityTypes.DEVICE'),
    PANEL: t('shortIdPool.entityTypes.PANEL'),
    PORT: t('shortIdPool.entityTypes.PORT'),
    CABLE: t('shortIdPool.entityTypes.CABLE'),
    CABLE_ENDPOINT: t('shortIdPool.entityTypes.CABLE_ENDPOINT'),
  };

  // Status tag color mapping
  const statusColorMap: Record<ShortIdPoolStatus, string> = {
    GENERATED: 'default',
    PRINTED: 'processing',
    BOUND: 'success',
    CANCELLED: 'error',
  };

  // Status name mapping
  const statusNameMap: Record<ShortIdPoolStatus, string> = {
    GENERATED: t('shortIdPool.statuses.GENERATED'),
    PRINTED: t('shortIdPool.statuses.PRINTED'),
    BOUND: t('shortIdPool.statuses.BOUND'),
    CANCELLED: t('shortIdPool.statuses.CANCELLED'),
  };

  // Pool records columns
  const poolColumns = [
    {
      title: t('shortIdPool.fields.shortId'),
      dataIndex: 'shortId',
      key: 'shortId',
      width: 120,
      fixed: 'left' as const,
      render: (id: number) => <Text code>{ShortIdFormatter.toDisplayFormat(id)}</Text>,
    },
    {
      title: t('shortIdPool.fields.entityType'),
      dataIndex: 'entityType',
      key: 'entityType',
      width: 120,
      render: (type: EntityType) => type ? entityTypeNameMap[type] : '-',
    },
    {
      title: t('shortIdPool.fields.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ShortIdPoolStatus) => (
        <Tag color={statusColorMap[status]}>{statusNameMap[status]}</Tag>
      ),
    },
    {
      title: t('shortIdPool.fields.batchNo'),
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 180,
    },
    {
      title: t('shortIdPool.fields.printTask'),
      dataIndex: 'printTask',
      key: 'printTask',
      width: 180,
      render: (task: any) => task?.name || '-',
    },
    {
      title: t('shortIdPool.fields.printedAt'),
      dataIndex: 'printedAt',
      key: 'printedAt',
      width: 180,
      render: (date: string) => (date ? new Date(date).toLocaleString() : '-'),
    },
    {
      title: t('shortIdPool.fields.entityId'),
      dataIndex: 'entityId',
      key: 'entityId',
      width: 280,
      render: (id: string) => (id ? <Text code>{id}</Text> : '-'),
    },
    {
      title: t('shortIdPool.fields.boundAt'),
      dataIndex: 'boundAt',
      key: 'boundAt',
      width: 180,
      render: (date: string) => (date ? new Date(date).toLocaleString() : '-'),
    },
    {
      title: t('shortIdPool.fields.notes'),
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('shortIdPool.actions.scrap'),
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: ShortIdPoolRecord) => (
        <Space>
          {record.status !== 'CANCELLED' && record.status !== 'BOUND' && (
            <Button
              type="link"
              danger
              size="small"
              onClick={() => {
                setSelectedRecord(record);
                setCancelModalVisible(true);
              }}
            >
              {t('shortIdPool.actions.scrap')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Print tasks columns
  const printTasksColumns = [
    {
      title: t('shortIdPool.fields.taskName'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: t('shortIdPool.fields.entityType'),
      dataIndex: 'entityType',
      key: 'entityType',
      width: 120,
      render: (type: EntityType) => type ? entityTypeNameMap[type] : '-',
    },
    {
      title: t('shortIdPool.fields.count'),
      dataIndex: 'count',
      key: 'count',
      width: 80,
    },
    {
      title: t('shortIdPool.fields.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          PENDING: 'default',
          PRINTING: 'processing',
          COMPLETED: 'success',
          FAILED: 'error',
        };
        const statusLabels: Record<string, string> = {
          PENDING: t('shortIdPool.statuses.PENDING'),
          PRINTING: t('shortIdPool.statuses.PRINTING'),
          COMPLETED: t('shortIdPool.statuses.COMPLETED'),
          FAILED: t('shortIdPool.statuses.FAILED'),
        };
        return <Tag color={colorMap[status] || 'default'}>{statusLabels[status] || status}</Tag>;
      },
    },
    {
      title: t('shortIdPool.fields.createdBy'),
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
      render: (name: string) => name || '-',
    },
    {
      title: t('shortIdPool.fields.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: t('shortIdPool.fields.completedAt'),
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: (date: string) => (date ? new Date(date).toLocaleString() : '-'),
    },
    {
      title: t('shortIdPool.fields.notes'),
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('shortIdPool.actions.scrap'),
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: PrintTask) => (
        <Space>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleExportPrintTask(record.id, record.name)}
          >
            {t('shortIdPool.actions.exportCSV')}
          </Button>
          {record.status === 'PENDING' && (
            <Popconfirm
              title={t('shortIdPool.modals.confirmComplete')}
              onConfirm={() => handleCompletePrintTask(record.id)}
            >
              <Button type="link" icon={<CheckCircleOutlined />}>
                {t('shortIdPool.actions.complete')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>{t('shortIdPool.title')}</Title>
      <Text type="secondary">
        {t('shortIdPool.description')}
      </Text>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic
                title={t('shortIdPool.stats.total')}
                value={stats.total}
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title={t('shortIdPool.stats.generated')}
                value={stats.generated}
                valueStyle={{ color: '#8c8c8c' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title={t('shortIdPool.stats.printed')}
                value={stats.printed}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title={t('shortIdPool.stats.bound')}
                value={stats.bound}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title={t('shortIdPool.stats.cancelled')}
                value={stats.cancelled}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* shortID池管理 */}
          <TabPane tab={t('shortIdPool.tabs.pool')} key="pool">
            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setGenerateModalVisible(true)}
              >
                {t('shortIdPool.actions.directGenerate')}
              </Button>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={() => setCreateTaskModalVisible(true)}
              >
                {t('shortIdPool.actions.createPrintTask')}
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => setBatchCancelModalVisible(true)}
              >
                {t('shortIdPool.actions.batchScrap')}
              </Button>
              <Select
                placeholder={t('shortIdPool.filters.entityType')}
                allowClear
                style={{ width: 150 }}
                onChange={(value) =>
                  setPoolFilters({ ...poolFilters, entityType: value })
                }
              >
                {Object.entries(entityTypeNameMap).map(([key, value]) => (
                  <Option key={key} value={key}>
                    {value}
                  </Option>
                ))}
              </Select>
              <Select
                placeholder={t('shortIdPool.filters.status')}
                allowClear
                style={{ width: 120 }}
                onChange={(value) =>
                  setPoolFilters({ ...poolFilters, status: value })
                }
              >
                {Object.entries(statusNameMap).map(([key, value]) => (
                  <Option key={key} value={key}>
                    {value}
                  </Option>
                ))}
              </Select>
              <Input
                placeholder={t('shortIdPool.actions.search')}
                prefix={<SearchOutlined />}
                allowClear
                style={{ width: 200 }}
                onChange={(e) =>
                  setPoolFilters({ ...poolFilters, search: e.target.value })
                }
              />
              <Button icon={<ReloadOutlined />} onClick={loadPoolRecords}>
                {t('shortIdPool.actions.refresh')}
              </Button>
            </Space>

            <Table
              columns={poolColumns}
              dataSource={poolRecords}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1800 }}
              pagination={{
                current: poolPage,
                pageSize: poolPageSize,
                total: poolTotal,
                showSizeChanger: true,
                showTotal: (total) => t('shortIdPool.pagination.total', { total }),
                onChange: (page, pageSize) => {
                  setPoolPage(page);
                  setPoolPageSize(pageSize);
                },
              }}
            />
          </TabPane>

          {/* 打印任务管理 */}
          <TabPane tab={t('shortIdPool.tabs.tasks')} key="tasks">
            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateTaskModalVisible(true)}
              >
                {t('shortIdPool.actions.createPrintTask')}
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadPrintTasks}>
                {t('shortIdPool.actions.refresh')}
              </Button>
            </Space>

            <Table
              columns={printTasksColumns}
              dataSource={printTasks}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1500 }}
              pagination={{
                current: printTasksPage,
                pageSize: printTasksPageSize,
                total: printTasksTotal,
                showSizeChanger: true,
                showTotal: (total) => t('shortIdPool.pagination.total', { total }),
                onChange: (page, pageSize) => {
                  setPrintTasksPage(page);
                  setPrintTasksPageSize(pageSize);
                },
              }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 创建打印任务模态框 */}
      <Modal
        title={t('shortIdPool.modals.createPrintTask')}
        open={createTaskModalVisible}
        onCancel={() => {
          setCreateTaskModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreatePrintTask}>
          <Form.Item
            label={t('shortIdPool.formLabels.taskName')}
            name="name"
            rules={[{ required: true, message: t('shortIdPool.validation.taskNameRequired') }]}
          >
            <Input placeholder={t('shortIdPool.formPlaceholders.taskName')} />
          </Form.Item>

          <Form.Item
            label={t('shortIdPool.formLabels.generateCount')}
            name="count"
            rules={[{ required: true, message: t('shortIdPool.validation.generateCountRequired') }]}
          >
            <InputNumber
              min={1}
              max={10000}
              placeholder={t('shortIdPool.formPlaceholders.generateCount')}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label={t('shortIdPool.formLabels.createdBy')} name="createdBy">
            <Input placeholder={t('shortIdPool.formPlaceholders.createdBy')} />
          </Form.Item>

          <Form.Item label={t('shortIdPool.fields.notes')} name="notes">
            <Input.TextArea rows={3} placeholder={t('shortIdPool.formPlaceholders.createdBy')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 直接生成模态框 */}
      <Modal
        title={t('shortIdPool.modals.directGenerate')}
        open={generateModalVisible}
        onCancel={() => {
          setGenerateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleGenerate}>
          <Form.Item
            label={t('shortIdPool.formLabels.generateCount')}
            name="count"
            rules={[{ required: true, message: t('shortIdPool.validation.generateCountRequired') }]}
          >
            <InputNumber
              min={1}
              max={10000}
              placeholder={t('shortIdPool.formPlaceholders.generateCount')}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label={t('shortIdPool.formLabels.batchNo')} name="batchNo">
            <Input placeholder={t('shortIdPool.formPlaceholders.batchNo')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 报废shortID模态框 */}
      <Modal
        title={t('shortIdPool.modals.scrapShortId')}
        open={cancelModalVisible}
        onCancel={() => {
          setCancelModalVisible(false);
          cancelForm.resetFields();
          setSelectedRecord(null);
        }}
        onOk={handleCancelShortId}
        okButtonProps={{ danger: true }}
        okText={t('shortIdPool.modals.confirmScrap')}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('shortIdPool.fields.shortId')}>
              <Text code>{ShortIdFormatter.toDisplayFormat(selectedRecord.shortId)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('shortIdPool.fields.entityType')}>
              {selectedRecord.entityType ? entityTypeNameMap[selectedRecord.entityType] : t('shortIdPool.fields.status')}
            </Descriptions.Item>
            <Descriptions.Item label={t('shortIdPool.fields.status')}>
              <Tag color={statusColorMap[selectedRecord.status]}>
                {statusNameMap[selectedRecord.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('shortIdPool.fields.batchNo')}>{selectedRecord.batchNo || '-'}</Descriptions.Item>
          </Descriptions>
        )}

        <Form form={cancelForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label={t('shortIdPool.formLabels.reason')}
            name="reason"
            rules={[{ required: true, message: t('shortIdPool.validation.reasonRequired') }]}
          >
            <Input.TextArea rows={3} placeholder={t('shortIdPool.formPlaceholders.reason')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量报废shortID模态框 */}
      <Modal
        title={t('shortIdPool.modals.batchScrapShortId')}
        open={batchCancelModalVisible}
        onCancel={() => {
          setBatchCancelModalVisible(false);
          batchCancelForm.resetFields();
        }}
        onOk={handleBatchCancelShortIds}
        okButtonProps={{ danger: true }}
        okText={t('shortIdPool.modals.confirmScrap')}
        width={700}
      >
        <Alert
          message={t('shortIdPool.modals.batchScrapTips')}
          description={
            <div>
              <p>{t('shortIdPool.modals.batchScrapExample1')}</p>
              <p>{t('shortIdPool.modals.batchScrapExample2')}</p>
              <p>{t('shortIdPool.modals.batchScrapExample3')}</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={batchCancelForm} layout="vertical">
          <Form.Item
            label={t('shortIdPool.formLabels.rangeExpr')}
            name="rangeExpr"
            rules={[{ required: true, message: t('shortIdPool.validation.rangeExprRequired') }]}
          >
            <Input.TextArea
              rows={4}
              placeholder={t('shortIdPool.formPlaceholders.rangeExpr')}
            />
          </Form.Item>

          <Form.Item
            label={t('shortIdPool.formLabels.reason')}
            name="reason"
            rules={[{ required: true, message: t('shortIdPool.validation.reasonRequired') }]}
          >
            <Input.TextArea rows={3} placeholder={t('shortIdPool.formPlaceholders.reason')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ShortIdPoolManagement;
