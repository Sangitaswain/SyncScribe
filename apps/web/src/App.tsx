import { BrowserRouter, Route, Routes } from "react-router";
import Placeholder from "./routes/Placeholder";
import AuthPage from "./routes/AuthPage";
import NotFound from "./routes/NotFound";
import AppShell from "./components/AppShell";
import UpdateAvailableToast from "./components/UpdateAvailableToast";
import RequireAuth from "./components/RequireAuth";

// Screens from FRONTEND_PLAN.md FP-6
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/forgot" element={<Placeholder title="Forgot password" />} />
        <Route path="/reset/:token" element={<Placeholder title="Reset password" />} />
        <Route path="/s/:token" element={<Placeholder title="Accept share link" />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Placeholder title="Workspace" />} />
          <Route path="/doc/:docId" element={<Placeholder title="Document" />} />
          <Route path="/doc/:docId/history" element={<Placeholder title="Version history" />} />
          <Route path="/trash" element={<Placeholder title="Trash" />} />
          <Route path="/shared" element={<Placeholder title="Shared with me" />} />
          <Route path="/search" element={<Placeholder title="Search" />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
          <Route path="/workspaces/:id/members" element={<Placeholder title="Members" />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <UpdateAvailableToast />
    </BrowserRouter>
  );
}
