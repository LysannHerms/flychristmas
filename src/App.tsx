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
import SoundLabPage from "./pages/SoundLabPage";
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
            element={<KeyPage title="Drum Machine" />}
          />

          <Route
            path="/key/open-session"
            element={<KeyPage title="Sound-Labor" />}
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

            <Route
              path="/tag/24/open-session"
              element={<SoundLabPage />}
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
