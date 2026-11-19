import {
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  AuthProvider,
  useAuth,
} from "./auth/AuthProvider";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import DayPage from "./pages/DayPage";
import KeyPage from "./pages/KeyPage";
import DrumMachinePage from "./pages/DrumMachinePage";
import "./unlocks.css";

function ProtectedRoutes() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="auth-page">
        <p className="auth-status">
          Kalender wird geöffnet …
        </p>
      </main>
    );
  }

  if (status !== "signedIn") {
    return (
      <Navigate
        to="/anmelden"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route
            path="/anmelden"
            element={<LoginPage />}
          />

          <Route
            path="/key/beat-it"
            element={<KeyPage />}
          />

          <Route element={<ProtectedRoutes />}>
            <Route
              path="/"
              element={<HomePage />}
            />

            <Route
              path="/tag/:day"
              element={<DayPage />}
            />

            <Route
              path="/tag/16/beat-it"
              element={<DrumMachinePage />}
            />
          </Route>

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}