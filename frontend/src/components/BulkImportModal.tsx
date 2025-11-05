import { useState } from 'react';
import { Modal, Upload, Button, Table, Alert, Space, message, Typography } from 'antd';
import { UploadOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { RcFile } from 'antd/es/upload';
import * as XLSX from 'xlsx';

const { Dragger } = Upload;
const { Text } = Typography;

export interface BulkImportColumn {
  title: string;
  dataIndex: string;
  key: string;
  required?: boolean;
  validator?: (value: any) => string | null; // 返回错误信息或null
}

interface BulkImportModalProps {
  visible: boolean;
  title: string;
  columns: BulkImportColumn[];
  templateData?: any[]; // 模板示例数据
  onCancel: () => void;
  onSubmit: (data: any[]) => Promise<void>;
}

interface ParsedRow {
  _index: number;
  _errors: string[];
  [key: string]: any;
}

export default function BulkImportModal({
  visible,
  title,
  columns,
  templateData = [],
  onCancel,
  onSubmit,
}: BulkImportModalProps) {
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);

  // 下载模板
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(templateData.length > 0 ? templateData : [
      columns.reduce((acc, col) => {
        acc[col.title] = '';
        return acc;
      }, {} as any)
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${title}_模板.xlsx`);
    message.success('模板已下载');
  };

  // 解析文件
  const handleFileUpload = async (file: RcFile) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // 验证和转换数据
      const validatedData: ParsedRow[] = jsonData.map((row: any, index) => {
        const errors: string[] = [];
        const parsedRow: ParsedRow = {
          _index: index + 1,
          _errors: errors,
        };

        columns.forEach((col) => {
          const value = row[col.title];

          // 检查必填字段
          if (col.required && (value === undefined || value === null || value === '')) {
            errors.push(`${col.title} 是必填项`);
          }

          // 自定义验证
          if (value !== undefined && value !== null && value !== '' && col.validator) {
            const error = col.validator(value);
            if (error) {
              errors.push(error);
            }
          }

          parsedRow[col.dataIndex] = value;
        });

        return parsedRow;
      });

      setParsedData(validatedData);
      setFileList([file]);
      message.success(`成功解析 ${validatedData.length} 条记录`);
    } catch (error: any) {
      message.error('文件解析失败: ' + error.message);
    }

    return false; // 阻止自动上传
  };

  // 提交导入
  const handleSubmit = async () => {
    const hasErrors = parsedData.some(row => row._errors.length > 0);
    if (hasErrors) {
      message.error('存在验证错误，请修正后重试');
      return;
    }

    if (parsedData.length === 0) {
      message.error('没有可导入的数据');
      return;
    }

    setLoading(true);
    try {
      // 移除内部字段
      const cleanData = parsedData.map(({ _index, _errors, ...rest }) => rest);
      await onSubmit(cleanData);
      message.success('导入成功');
      handleReset();
      onCancel();
    } catch (error: any) {
      message.error('导入失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 重置
  const handleReset = () => {
    setParsedData([]);
    setFileList([]);
  };

  // 显示列配置
  const tableColumns = [
    {
      title: '行号',
      dataIndex: '_index',
      key: '_index',
      width: 60,
      fixed: 'left' as const,
    },
    ...columns.map((col) => ({
      title: col.title + (col.required ? ' *' : ''),
      dataIndex: col.dataIndex,
      key: col.key,
      render: (text: any) => text ?? '-',
    })),
    {
      title: '状态',
      dataIndex: '_errors',
      key: '_errors',
      width: 100,
      fixed: 'right' as const,
      render: (errors: string[]) =>
        errors.length > 0 ? (
          <Text type="danger">错误 ({errors.length})</Text>
        ) : (
          <Text type="success">正常</Text>
        ),
    },
  ];

  const errorCount = parsedData.filter(row => row._errors.length > 0).length;

  return (
    <Modal
      title={title}
      open={visible}
      onCancel={onCancel}
      width={1000}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="reset" onClick={handleReset} disabled={parsedData.length === 0}>
          清空
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
          disabled={parsedData.length === 0 || errorCount > 0}
        >
          导入 ({parsedData.length} 条)
        </Button>,
      ]}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
            style={{ marginBottom: 16 }}
          >
            下载导入模板
          </Button>

          <Dragger
            accept=".xlsx,.xls,.csv"
            fileList={fileList}
            beforeUpload={handleFileUpload}
            onRemove={handleReset}
            maxCount={1}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">支持 Excel (.xlsx, .xls) 和 CSV 文件</p>
          </Dragger>
        </div>

        {parsedData.length > 0 && (
          <>
            {errorCount > 0 && (
              <Alert
                message={`发现 ${errorCount} 条记录有错误`}
                description="请检查下方表格中标记为错误的行，修正数据后重新上传"
                type="error"
                showIcon
              />
            )}

            <Table
              columns={tableColumns}
              dataSource={parsedData}
              rowKey="_index"
              scroll={{ x: 'max-content', y: 400 }}
              pagination={{ pageSize: 50 }}
              size="small"
              expandable={{
                expandedRowRender: (record) =>
                  record._errors.length > 0 ? (
                    <Alert
                      message="错误详情"
                      description={
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {record._errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      }
                      type="error"
                      showIcon
                    />
                  ) : null,
                rowExpandable: (record) => record._errors.length > 0,
              }}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}
