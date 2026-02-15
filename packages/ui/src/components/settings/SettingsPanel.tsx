import { useAuth } from "../../context/AuthContext";
import { ApiKeyManager } from "./ApiKeyManager";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { user, authType } = useAuth() as ReturnType<typeof useAuth> & { authType?: string };

  return (
    <div className="flex h-full flex-col bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Profile */}
        {user && (
          <div className="mb-6">
            <h3 className="mb-2 text-lg font-semibold text-white">Profile</h3>
            <p className="text-sm text-gray-400">
              Signed in as <span className="text-white font-medium">{user.username}</span>
            </p>
          </div>
        )}

        {/* API Keys (only for JWT-authenticated users) */}
        {user && user.username !== "system" && (
          <ApiKeyManager />
        )}
      </div>
    </div>
  );
}
