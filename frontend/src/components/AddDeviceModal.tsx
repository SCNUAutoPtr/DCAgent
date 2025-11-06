import { useState } from 'react';
import { Modal, Form, Input, Select, Button, Alert, Space } from 'antd';
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import monitoringService from '@/services/monitoringService';

const { Option } = Select;

interface AddDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AddDeviceModal({
  open,
  onOpenChange,
  onSuccess,
}: AddDeviceModalProps) {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    vendor?: string;
    model?: string;
    message?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleTest = async () => {
    try {
      const values = await form.validateFields(['ip', 'community']);
      setTesting(true);
      setTestResult(null);

      try {
        const result = await monitoringService.testConnection(
          values.ip,
          values.community
        );
        setTestResult(result);

        if (result.success && result.vendor) {
          form.setFieldsValue({ vendor: result.vendor });
        }
      } catch (error: any) {
        setTestResult({
          success: false,
          message: error.message || '连接测试失败',
        });
      } finally {
        setTesting(false);
      }
    } catch {
      // Form validation failed
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      try {
        await monitoringService.addDevice(values);
        onSuccess();
        onOpenChange(false);
        form.resetFields();
        setTestResult(null);
      } catch (error: any) {
        Modal.error({
          title: '添加设备失败',
          content: error.message || '未知错误',
        });
      } finally {
        setSubmitting(false);
      }
    } catch {
      // Form validation failed
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setTestResult(null);
    onOpenChange(false);
  };

  return (
    <Modal
      title="添加监控设备"
      open={open}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={handleSubmit}
        >
          添加设备
        </Button>,
      ]}
      width={500}
    >
      <div style={{ marginBottom: 16, color: '#8c8c8c' }}>
        添加一个新的 SNMP 监控设备。请确保设备已启用 SNMP v2c 协议。
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          community: 'public',
          vendor: 'unknown',
        }}
      >
        <Form.Item
          label="设备名称"
          name="name"
          rules={[{ required: true, message: '请输入设备名称' }]}
        >
          <Input placeholder="例如: Server-01" />
        </Form.Item>

        <Form.Item
          label="IP 地址"
          name="ip"
          rules={[
            { required: true, message: '请输入 IP 地址' },
            {
              pattern: /^(\d{1,3}\.){3}\d{1,3}$/,
              message: '请输入有效的 IP 地址',
            },
          ]}
        >
          <Input placeholder="例如: 192.168.1.100" />
        </Form.Item>

        <Form.Item
          label="Community String"
          name="community"
          rules={[{ required: true, message: '请输入 Community String' }]}
          help="SNMP v2c 的 Community String，默认为 public"
        >
          <Input placeholder="例如: public" />
        </Form.Item>

        <Form.Item label="设备厂商" name="vendor">
          <Select>
            <Option value="unknown">自动检测</Option>
            <Option value="lenovo">Lenovo</Option>
            <Option value="dell">Dell</Option>
            <Option value="hp">HP</Option>
          </Select>
        </Form.Item>

        <Form.Item>
          <Button
            block
            onClick={handleTest}
            loading={testing}
            icon={testing ? <LoadingOutlined /> : undefined}
          >
            测试连接
          </Button>
        </Form.Item>

        {testResult && (
          <Form.Item>
            {testResult.success ? (
              <Alert
                message="连接成功"
                description={
                  <>
                    {testResult.message && <div>{testResult.message}</div>}
                    {testResult.vendor && (
                      <div style={{ marginTop: 4 }}>
                        厂商: {testResult.vendor}
                        {testResult.model && ` | 机型: ${testResult.model}`}
                      </div>
                    )}
                  </>
                }
                type="success"
                icon={<CheckCircleOutlined />}
                showIcon
              />
            ) : (
              <Alert
                message="连接失败"
                description={testResult.message}
                type="error"
                icon={<CloseCircleOutlined />}
                showIcon
              />
            )}
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
