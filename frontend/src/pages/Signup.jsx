import { useState } from "react";
import { useAuth } from "../auth";
import { Navigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
} from "@mui/material";

export default function Signup() {
  const { user, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await signup(email, name, password);
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
      <Card sx={{ width: 420 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Sign up
          </Typography>
          {err && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {err}
            </Alert>
          )}
          <form onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button variant="contained" type="submit">
                Create account
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
