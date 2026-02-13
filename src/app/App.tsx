import { RouterProvider } from "react-router";
import { router } from "./routes";

// EchoNews Japan - AI駆動音声ニュースアプリ v1.0.0
export default function App() {
  return <RouterProvider router={router} />;
}