import { Routes, Route } from 'react-router-dom';
import { Layout, ConfigProvider } from 'antd';
import { useTranslation } from 'react-i18next';
import { getAntdLocale } from './locales/languages';
import AppHeader from './components/Layout/AppHeader';
import AppSidebar from './components/Layout/AppSidebar';
import Dashboard from './pages/Dashboard';
import DataCenterList from './pages/DataCenterList';
import RoomList from './pages/RoomList';
import CabinetList from './pages/CabinetList';
import DeviceList from './pages/DeviceList';
import PanelList from './pages/PanelList';
import CableTopology from './pages/CableTopology';
import CableManualInventory from './pages/CableManualInventory';
import CableScrap from './pages/CableScrap';
import ShortIdPoolManagement from './pages/ShortIdPoolManagement';
import PortDetailView from './pages/PortDetailView';
import BulkDeploymentPage from './pages/BulkDeploymentPage';
import PanelTemplateManagementPage from './pages/PanelTemplateManagementPage';
import OpticalModuleList from './pages/OpticalModuleList';
import OpticalModuleDetail from './pages/OpticalModuleDetail';
// import MonitoringPage from './pages/MonitoringPage'; // SNMP 监控模块已隐藏

const { Content } = Layout;

function App() {
  const { i18n } = useTranslation();

  // 根据当前语言动态获取 Ant Design 的 locale
  const antdLocale = getAntdLocale(i18n.language);

  return (
    <ConfigProvider locale={antdLocale}>
      <Layout style={{ minHeight: '100vh' }}>
        <AppHeader />
        <Layout>
          <AppSidebar />
          <Layout style={{ padding: '24px' }}>
            <Content
              style={{
                padding: 24,
                margin: 0,
                minHeight: 280,
                background: '#fff',
                borderRadius: 8,
              }}
            >
              <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/datacenters" element={<DataCenterList />} />
              <Route path="/rooms" element={<RoomList />} />
              <Route path="/cabinets" element={<CabinetList />} />
              <Route path="/devices" element={<DeviceList />} />
              <Route path="/panels" element={<PanelList />} />
              <Route path="/port-detail" element={<PortDetailView />} />
              <Route path="/topology" element={<CableTopology />} />
              <Route path="/cable-manual-inventory" element={<CableManualInventory />} />
              <Route path="/cable-scrap" element={<CableScrap />} />
              <Route path="/shortid-pool" element={<ShortIdPoolManagement />} />
              <Route path="/bulk-deployment" element={<BulkDeploymentPage />} />
              <Route path="/panel-templates" element={<PanelTemplateManagementPage />} />
              <Route path="/optical-modules" element={<OpticalModuleList />} />
              <Route path="/optical-modules/:id" element={<OpticalModuleDetail />} />
              {/* SNMP 监控路由已隐藏 */}
              {/* <Route path="/monitoring" element={<MonitoringPage />} /> */}
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
