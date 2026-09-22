import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import './styles.css';

// Providers make shared things (pop-up messages, who is signed in) available to every page.
// Data is not kept here: each page loads what it needs through the API (see src/api/).
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
);
