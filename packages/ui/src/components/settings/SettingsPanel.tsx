import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { ApiKeyManager } from "./ApiKeyManager";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { user, authType } = useAuth() as ReturnType<typeof useAuth> & {
    authType?: string;
  };
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Profile */}
        {user && (
          <div className="mb-6">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Profile
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Signed in as{" "}
              <span className="text-gray-900 dark:text-gray-100 font-medium">{user.username}</span>
            </p>
          </div>
        )}

        {/* Theme */}
        <div className="mb-6">
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Appearance
          </h3>
          <button
            onClick={toggleTheme}
            className="rounded-md bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          </button>
        </div>

        {/* API Keys (only for JWT-authenticated users) */}
        {user && user.username !== "system" && <ApiKeyManager />}
      </div>
    </div>
  );
}
