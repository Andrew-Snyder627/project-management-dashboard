import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "./theme";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./components/Layout";
import Loading from "./components/Loading";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Meetings from "./pages/Meetings";
import MeetingDetail from "./pages/MeetingDetail";

function RequireAuth({ children }) {
  const { user, booted } = useAuth();
  if (!booted) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Meetings />
                  </RequireAuth>
                }
              />
              <Route
                path="/meeting/:id"
                element={
                  <RequireAuth>
                    <MeetingDetail />
                  </RequireAuth>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
