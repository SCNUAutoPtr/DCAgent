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

const { Sider } = Layout;

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: 'infrastructure',
      icon: <DatabaseOutlined />,
      label: '基础设施',
      children: [
        {
          key: '/datacenters',
          icon: <DatabaseOutlined />,
          label: '数据中心',
        },
        {
          key: '/rooms',
          icon: <HomeOutlined />,
          label: '机房',
        },
        {
          key: '/cabinets',
          icon: <InboxOutlined />,
          label: '机柜',
        },
        // 设备菜单已隐藏 - 通过机柜可视化管理
        // {
        //   key: '/devices',
        //   icon: <CloudServerOutlined />,
        //   label: '设备',
        // },
      ],
    },
    {
      key: 'connectivity',
      icon: <ApartmentOutlined />,
      label: '连接管理',
      children: [
        // 面板和端口菜单已隐藏 - 通过设备可视化管理
        // {
        //   key: '/panels',
        //   icon: <ApartmentOutlined />,
        //   label: '面板',
        // },
        // {
        //   key: '/ports',
        //   icon: <ApiOutlined />,
        //   label: '端口',
        // },
        {
          key: '/optical-modules',
          icon: <ToolOutlined />,
          label: '光模块管理',
        },
        {
          key: '/topology',
          icon: <ApartmentOutlined />,
          label: '线缆拓扑',
        },
        {
          key: '/cable-manual-inventory',
          icon: <ScanOutlined />,
          label: '线缆手动入库',
        },
      ],
    },
    {
      key: '/shortid-pool',
      icon: <TagsOutlined />,
      label: 'shortID池管理',
    },
    // SNMP 设备监控菜单已隐藏
    // {
    //   key: '/monitoring',
    //   icon: <MonitorOutlined />,
    //   label: '设备监控',
    // },
    {
      key: '/bulk-deployment',
      icon: <CloudUploadOutlined />,
      label: '批量上架',
    },
    {
      key: '/panel-templates',
      icon: <FileTextOutlined />,
      label: '面板模板',
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
