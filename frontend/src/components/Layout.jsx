import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  return (
    <>
      <AppBar position="sticky" color="primary" enableColorOnDark>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            PM Productivity Dashboard
          </Typography>
          {user ? (
            <>
              <Typography variant="body2" sx={{ mr: 2 }}>
                Hi, {user.name}
              </Typography>
              <Button color="inherit" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button color="inherit" component={RouterLink} to="/login">
                Login
              </Button>
              <Button color="inherit" component={RouterLink} to="/signup">
                Sign up
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg">
        <Box sx={{ py: 3 }}>{children}</Box>
      </Container>
    </>
  );
}
