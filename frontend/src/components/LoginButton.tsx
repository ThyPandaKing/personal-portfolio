import { GoogleLogin } from "@react-oauth/google";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage, GOOGLE_CLIENT_ID } from "../lib/api";

/** Shows a Google sign-in button for visitors, or a logout button for the admin. */
export default function LoginButton() {
  const { user, loginWithGoogle, logout } = useAuth();
  const [error, setError] = useState("");

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {user.picture && (
          <img src={user.picture} alt={user.name} className="h-8 w-8 rounded-full" />
        )}
        <button onClick={() => void logout()} className="btn-ghost" title="Log out">
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  if (!GOOGLE_CLIENT_ID) {
    return <span className="text-xs text-slate-400">Set VITE_GOOGLE_CLIENT_ID to enable login</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <GoogleLogin
        onSuccess={async (resp) => {
          setError("");
          try {
            if (resp.credential) await loginWithGoogle(resp.credential);
          } catch (e) {
            setError(apiErrorMessage(e, "Login failed"));
          }
        }}
        onError={() => setError("Google login failed")}
        useOneTap={false}
        theme="outline"
        size="medium"
        shape="pill"
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
