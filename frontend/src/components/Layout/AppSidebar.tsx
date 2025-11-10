import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  HomeOutlined,
  InboxOutlined,
  ApartmentOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  ScanOutlined,
  TagsOutlined,
  ToolOutlined,
  // MonitorOutlined, // SNMP 监控模块已隐藏
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const { Sider } = Layout;

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('menu');

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: t('dashboard'),
    },
    {
      key: 'infrastructure',
      icon: <DatabaseOutlined />,
      label: t('infrastructure'),
      children: [
        {
          key: '/datacenters',
          icon: <DatabaseOutlined />,
          label: t('dataCenter'),
        },
        {
          key: '/rooms',
          icon: <HomeOutlined />,
          label: t('room'),
        },
        {
          key: '/cabinets',
          icon: <InboxOutlined />,
          label: t('cabinet'),
        },
        // 设备菜单已隐藏 - 通过机柜可视化管理
        // {
        //   key: '/devices',
        //   icon: <CloudServerOutlined />,
        //   label: t('device'),
        // },
      ],
    },
    {
      key: 'connectivity',
      icon: <ApartmentOutlined />,
      label: t('connectionManagement'),
      children: [
        {
          key: '/optical-modules',
          icon: <ToolOutlined />,
          label: t('opticalModule'),
        },
        {
          key: '/topology',
          icon: <ApartmentOutlined />,
          label: t('cableTopology'),
        },
        {
          key: '/cable-manual-inventory',
          icon: <ScanOutlined />,
          label: t('cableManualInventory'),
        },
      ],
    },
    {
      key: '/shortid-pool',
      icon: <TagsOutlined />,
      label: t('shortIdPool'),
    },
    // SNMP 设备监控菜单已隐藏
    // {
    //   key: '/monitoring',
    //   icon: <MonitorOutlined />,
    //   label: t('monitoring'),
    // },
    {
      key: '/bulk-deployment',
      icon: <CloudUploadOutlined />,
      label: t('bulkDeployment'),
    },
    {
      key: '/panel-templates',
      icon: <FileTextOutlined />,
      label: t('panelTemplate'),
    },
  ];

  return (
    <Sider width={200} style={{ background: '#fff' }}>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ height: '100%', borderRight: 0 }}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  );
}
