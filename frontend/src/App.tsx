import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import AppHeader from './components/Layout/AppHeader';
import AppSidebar from './components/Layout/AppSidebar';
import Dashboard from './pages/Dashboard';
import DataCenterList from './pages/DataCenterList';
import RoomList from './pages/RoomList';
import CabinetList from './pages/CabinetList';
import DeviceList from './pages/DeviceList';
import PanelList from './pages/PanelList';
import PortManagementPage from './pages/PortManagementPage';
import CableTopology from './pages/CableTopology';
import PortDetailView from './pages/PortDetailView';
import BulkDeploymentPage from './pages/BulkDeploymentPage';
import PanelTemplateManagementPage from './pages/PanelTemplateManagementPage';
// import MonitoringPage from './pages/MonitoringPage'; // SNMP 监控模块已隐藏

const { Content } = Layout;

function App() {
  return (
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
              <Route path="/ports" element={<PortManagementPage />} />
              <Route path="/port-detail" element={<PortDetailView />} />
              <Route path="/topology" element={<CableTopology />} />
              <Route path="/bulk-deployment" element={<BulkDeploymentPage />} />
              <Route path="/panel-templates" element={<PanelTemplateManagementPage />} />
              {/* SNMP 监控路由已隐藏 */}
              {/* <Route path="/monitoring" element={<MonitoringPage />} /> */}
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
