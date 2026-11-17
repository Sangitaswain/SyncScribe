import { BrowserRouter, Route, Routes } from "react-router";
import AuthPage from "./routes/AuthPage";
import ForgotPage from "./routes/ForgotPage";
import ResetPage from "./routes/ResetPage";
import SettingsPage from "./routes/SettingsPage";
import DocPage from "./routes/DocPage";
import AllDocsPage from "./routes/AllDocsPage";
import LandingPage from "./routes/LandingPage";
import NotFound from "./routes/NotFound";
import SharedPage from "./routes/SharedPage";
import AcceptLinkPage from "./routes/AcceptLinkPage";
import MembersPage from "./routes/MembersPage";
import TrashPage from "./routes/TrashPage";
import HistoryPage from "./routes/HistoryPage";
import { SearchPanel } from "./components/SearchPanel";
import AppShell from "./components/AppShell";
import UpdateAvailableToast from "./components/UpdateAvailableToast";
import RequireAuth from "./components/RequireAuth";

// Screens from FRONTEND_PLAN.md FP-6
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/forgot" element={<ForgotPage />} />
        <Route path="/reset/:token" element={<ResetPage />} />
        <Route path="/s/:token" element={<AcceptLinkPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<AllDocsPage />} />
          <Route path="/doc/:docId" element={<DocPage />} />
          <Route path="/doc/:docId/history" element={<HistoryPage />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/shared" element={<SharedPage />} />
          <Route path="/search" element={<div className="mx-auto max-w-xl pt-10"><SearchPanel /></div>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/workspaces/:id/members" element={<MembersPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <UpdateAvailableToast />
    </BrowserRouter>
  );
}
