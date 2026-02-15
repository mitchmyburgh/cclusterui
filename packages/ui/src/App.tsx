import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginForm } from "./components/auth/LoginForm";
import { AppLayout } from "./components/layout/AppLayout";

function AppContent() {
  const { isAuthenticated, login, setApiKey } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} onApiKey={setApiKey} />;
  }

  return <AppLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
