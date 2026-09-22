import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import RequireRole from './auth/RequireRole.jsx';
import LoginPage from './pages/LoginPage.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import ManufacturerPage from './pages/ManufacturerPage.jsx';
import SupplyChainPage from './pages/SupplyChainPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import BatchesPage from './pages/BatchesPage.jsx';
import QRCodesPage from './pages/QRCodesPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import { api } from './api/index.js';

// Who can open what:
//   everyone      -> /verify
//   manufacturer  -> /manufacturer, /supply-chain
//   admin         -> /admin, /admin/batches, /admin/qr-codes, /supply-chain
export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/manufacturer" element={<RequireRole roles={['manufacturer']}><ManufacturerPage /></RequireRole>} />
          <Route path="/supply-chain" element={<RequireRole roles={['manufacturer', 'admin']}><SupplyChainPage /></RequireRole>} />
          <Route path="/admin" element={<RequireRole roles={['admin']}><DashboardPage /></RequireRole>} />
          <Route path="/admin/batches" element={<RequireRole roles={['admin']}><BatchesPage /></RequireRole>} />
          <Route path="/admin/qr-codes" element={<RequireRole roles={['admin']}><QRCodesPage /></RequireRole>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="footer">
        MediChain: trusted medicine supply and anti-counterfeit tracker{api.mode === 'mock' ? ' (college demo, runs fully in your browser)' : ''}
      </footer>
    </div>
  );
}
