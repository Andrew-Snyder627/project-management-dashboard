import { useEffect, useState } from "react";
import { api } from "../api";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  TextField,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Snackbar,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    severity: "success",
  });

  const load = async () => {
    setLoading(true);
    try {
      const { json } = await api.listMeetings();
      setMeetings(json || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.createMeeting({ title, raw_notes: raw });
    setTitle("");
    setRaw("");
    setToast({ open: true, msg: "Meeting created", severity: "success" });
    await load();
  };

  const del = async (id) => {
    await api.deleteMeeting(id);
    setToast({ open: true, msg: "Meeting deleted", severity: "info" });
    await load();
  };

  const explainCalendar = () => {
    setToast({
      open: true,
      msg: "Google Calendar integration is coming soon!",
      severity: "info",
    });
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Meetings
      </Typography>

      {/* Calendar integration placeholder */}
      <Card
        sx={{
          mb: 3,
          bgcolor: "background.default",
          borderStyle: "dashed",
          borderWidth: 1,
          borderColor: "divider",
        }}
      >
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack spacing={0.5}>
              <Typography variant="subtitle1">
                Google Calendar (coming soon)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You’ll be able to connect your Google account to auto-import
                meetings and notes, then summarize with one click.
              </Typography>
            </Stack>
            <Button
              variant="outlined"
              startIcon={<CalendarMonthIcon />}
              onClick={explainCalendar}
            >
              Connect Google
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Create a meeting
          </Typography>
          <form onSubmit={create}>
            <Stack spacing={2}>
              <TextField
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <TextField
                label="Raw notes (optional)"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                multiline
                minRows={3}
              />
              <Button startIcon={<AddIcon />} type="submit" variant="contained">
                Create
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : (
            <List>
              {meetings.map((m) => (
                <ListItem
                  key={m.id}
                  divider
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => del(m.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    component={RouterLink}
                    to={`/meeting/${m.id}`}
                  >
                    <ListItemText
                      primary={m.title}
                      secondary={
                        m.meeting_date
                          ? new Date(m.meeting_date).toLocaleString()
                          : "No date"
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              {meetings.length === 0 && (
                <Typography sx={{ p: 2, color: "text.secondary" }}>
                  No meetings yet.
                </Typography>
              )}
            </List>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast({ ...toast, open: false })}
      >
        <Alert severity={toast.severity} variant="filled">
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
