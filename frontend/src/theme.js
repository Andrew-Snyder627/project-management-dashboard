import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1976d2" },
    secondary: { main: "#9c27b0" },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: "none", borderRadius: 10 } },
    },
    MuiCard: { styleOverrides: { root: { borderRadius: 16 } } },
  },
});
