import { createBrowserRouter } from "react-router";
import { HomeScreen } from "./screens/home-screen";
import { PlayerScreen } from "./screens/player-screen";
import { HistoryScreen } from "./screens/history-screen";
import { AuthScreen } from "./screens/auth-screen";
import { AdminScreen } from "./screens/admin-screen";
import { AdminUsersScreen } from "./screens/admin-users-screen";
import { AdminUserScreen } from "./screens/admin-user-screen";
import { RootLayout } from "./components/root-layout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: HomeScreen },
      { path: "player/:briefingId", Component: PlayerScreen },
      { path: "history", Component: HistoryScreen },
      { path: "auth", Component: AuthScreen },
      { path: "admin", Component: AdminScreen },
      { path: "admin/users", Component: AdminUsersScreen },
      { path: "admin/users/:userId", Component: AdminUserScreen },
    ],
  },
]);
