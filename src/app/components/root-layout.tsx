import { Outlet } from "react-router";
import { AudioPlayerProvider } from "./audio-player-provider";
import { AuthProvider } from "./auth-provider";

export function RootLayout() {
  return (
    <AuthProvider>
      <AudioPlayerProvider>
        <div className="min-h-screen bg-background">
          <Outlet />
        </div>
      </AudioPlayerProvider>
    </AuthProvider>
  );
}
