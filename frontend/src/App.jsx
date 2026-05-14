import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PickerAuthProvider } from './context/PickerAuthContext';
import AppRoutes from './routes';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <PickerAuthProvider>
          <AppRoutes />
        </PickerAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
