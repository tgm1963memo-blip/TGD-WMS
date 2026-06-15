import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext.jsx';
import { UserRoleProvider } from '../features/auth/UserRoleProvider.jsx';

export function AppProviders({ children }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UserRoleProvider>
          {children}
        </UserRoleProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

