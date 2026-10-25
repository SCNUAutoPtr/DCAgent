import { useState } from 'react';
import { Alert, Button, Modal, Space, Table, Typography, Upload, message } from 'antd';
import type { UploadFile } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';

const { Dragger } = Upload;
const { Text } = Typography;

export type Cell = string | number | boolean | null | undefined;
export type ImportRow = Record<string, Cell>;

export interface BulkImportColumn {
  title: string;
  dataIndex: string;
  required?: boolean;
  /** error text, or null when valid */
  validator?: (value: Cell) => string | null;
}

interface BulkImportModalProps {
  open: boolean;
  title: string;
  columns: BulkImportColumn[];
  /** example rows keyed by dataIndex; headers come from the column titles */
  templateRows?: ImportRow[];
  onCancel: () => void;
  /** rows keyed by dataIndex; throw to keep the dialog open */
  onSubmit: (rows: ImportRow[]) => Promise<void>;
}

interface ParsedRow {
  index: number;
  errors: string[];
  values: ImportRow;
}

/** Spreadsheet import: download a template, upload xlsx/csv, check each row, then hand the rows over. */
export default function BulkImportModal({ open, title, columns, templateRows = [], onCancel, onSubmit }: BulkImportModalProps) {
  const { t } = useTranslation('common');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setRows([]);
    setFiles([]);
  };

  const downloadTemplate = () => {
    const source = templateRows.length ? templateRows : [{}];
    const sheet = XLSX.utils.json_to_sheet(source.map((r) => Object.fromEntries(columns.map((c) => [c.title, r[c.dataIndex] ?? '']))));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Template');
    XLSX.writeFile(book, `${title}_${t('bulkImport.templateSuffix')}.xlsx`);
    message.success(t('bulkImport.templateDownloaded'));
  };

  const parse = async (file: RcFile) => {
    try {
      const book = XLSX.read(await file.arrayBuffer());
      const sheet = book.Sheets[book.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, Cell>>(sheet);
      const parsed = json.map((raw, i) => {
        const errors: string[] = [];
        const values: ImportRow = {};
        for (const col of columns) {
          const v = raw[col.title];
          const empty = v === undefined || v === null || v === '';
          if (col.required && empty) errors.push(t('bulkImport.required', { field: col.title }));
          if (!empty && col.validator) {
            const err = col.validator(v);
            if (err) errors.push(err);
          }
          values[col.dataIndex] = empty ? undefined : v;
        }
        return { index: i + 1, errors, values };
      });
      setRows(parsed);
      setFiles([file]);
      message.success(t('bulkImport.parsed', { count: parsed.length }));
    } catch {
      message.error(t('bulkImport.parseFailed'));
    }
    return false;
  };

  const submit = async () => {
    if (rows.some((r) => r.errors.length)) {
      message.error(t('bulkImport.hasErrors'));
      return;
    }
    if (!rows.length) {
      message.error(t('bulkImport.noData'));
      return;
    }
    setLoading(true);
    try {
      await onSubmit(rows.map((r) => r.values));
      reset();
      onCancel();
    } catch {
      // the caller reported it
    } finally {
      setLoading(false);
    }
  };

  const errorCount = rows.filter((r) => r.errors.length).length;
  const tableColumns = [
    { title: t('bulkImport.row'), dataIndex: 'index', key: 'index', width: 60, fixed: 'left' as const },
    ...columns.map((c) => ({
      title: c.title + (c.required ? ' *' : ''),
      key: c.dataIndex,
      render: (_: unknown, r: ParsedRow) => String(r.values[c.dataIndex] ?? '-'),
    })),
    {
      title: t('bulkImport.status'),
      key: 'errors',
      width: 110,
      fixed: 'right' as const,
      render: (_: unknown, r: ParsedRow) =>
        r.errors.length ? <Text type="danger">{t('bulkImport.errorCount', { count: r.errors.length })}</Text> : <Text type="success">{t('bulkImport.ok')}</Text>,
    },
  ];

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={1000}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('actions.cancel')}
        </Button>,
        <Button key="reset" onClick={reset} disabled={!rows.length}>
          {t('bulkImport.clear')}
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={submit} disabled={!rows.length || errorCount > 0}>
          {t('bulkImport.submit', { count: rows.length })}
        </Button>,
      ]}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate} style={{ marginBottom: 16 }}>
            {t('bulkImport.downloadTemplate')}
          </Button>
          <Dragger accept=".xlsx,.xls,.csv" fileList={files} beforeUpload={parse} onRemove={reset} maxCount={1}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t('bulkImport.dragText')}</p>
            <p className="ant-upload-hint">{t('bulkImport.dragHint')}</p>
          </Dragger>
        </div>
        {rows.length > 0 && (
          <>
            {errorCount > 0 && <Alert message={t('bulkImport.errorsFound', { count: errorCount })} description={t('bulkImport.errorsHint')} type="error" showIcon />}
            <Table
              columns={tableColumns}
              dataSource={rows}
              rowKey="index"
              scroll={{ x: 'max-content', y: 400 }}
              pagination={{ pageSize: 50 }}
              size="small"
              expandable={{
                expandedRowRender: (r) => (
                  <Alert
                    message={t('bulkImport.errorDetails')}
                    description={
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {r.errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    }
                    type="error"
                    showIcon
                  />
                ),
                rowExpandable: (r) => r.errors.length > 0,
              }}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}
