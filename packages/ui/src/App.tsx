import { AuthProvider, useAuth } from "./context/AuthContext";
import { ApiKeyModal } from "./components/auth/ApiKeyModal";
import { AppLayout } from "./components/layout/AppLayout";

function AppContent() {
  const { isAuthenticated, setApiKey } = useAuth();

  if (!isAuthenticated) {
    return <ApiKeyModal onSubmit={setApiKey} />;
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
