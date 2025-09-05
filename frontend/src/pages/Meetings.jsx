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
  Tooltip,
  Chip,
  Link,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);

  // Google integration state
  const [gStatusLoading, setGStatusLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [gEventsLoading, setGEventsLoading] = useState(false);
  const [gEvents, setGEvents] = useState([]);

  const [toast, setToast] = useState({
    open: false,
    msg: "",
    severity: "success",
  });

  // ---- Meetings ----
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

  // ---- Google Calendar ----
  const checkGoogleStatus = async () => {
    setGStatusLoading(true);
    try {
      const { json } = await api.googleStatus();
      setGoogleConnected(Boolean(json?.connected));
    } catch (e) {
      setGoogleConnected(false);
    } finally {
      setGStatusLoading(false);
    }
  };

  const loadGoogleEvents = async () => {
    if (!googleConnected) return;
    setGEventsLoading(true);
    try {
      const { json } = await api.listGoogleEvents();
      setGEvents(Array.isArray(json) ? json : []);
    } catch (e) {
      setToast({
        open: true,
        msg: "Failed to load Google events",
        severity: "error",
      });
      setGEvents([]);
    } finally {
      setGEventsLoading(false);
    }
  };

  const connectGoogle = () => {
    // Full page redirect to start OAuth
    window.location.href = api.googleLoginUrl();
  };

  // On mount, and also when redirected back from OAuth, check status & maybe load events
  useEffect(() => {
    (async () => {
      await checkGoogleStatus();
    })();
  }, []);

  useEffect(() => {
    if (googleConnected) {
      loadGoogleEvents();
    } else {
      setGEvents([]);
    }
  }, [googleConnected]);

  const importFromEvent = async (evt) => {
    const title = evt.summary || "Calendar event";
    // Backend accepts ISO 8601 for meeting_date; pass through if available.
    const payload = {
      title,
      raw_notes: "", // could hydrate later by pulling attendees/desc
      ...(evt.start ? { meeting_date: evt.start } : {}),
    };
    await api.createMeeting(payload);
    setToast({
      open: true,
      msg: `Imported "${title}"`,
      severity: "success",
    });
    await load();
  };

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">Meetings</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <CalendarConnectionBadge
            connected={googleConnected}
            loading={gStatusLoading}
          />
          <Button
            variant={googleConnected ? "outlined" : "contained"}
            startIcon={<CalendarMonthIcon />}
            onClick={connectGoogle}
          >
            {googleConnected ? "Re-connect Google" : "Connect Google"}
          </Button>
        </Stack>
      </Stack>

      {/* Google Calendar events panel (visible once connected) */}
      {googleConnected && (
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
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ md: "center" }}
            >
              <Stack spacing={0.5}>
                <Typography variant="subtitle1">
                  Upcoming Google Events
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Select any event to import it as a meeting in this app.
                </Typography>
              </Stack>
              <Button
                onClick={loadGoogleEvents}
                variant="outlined"
                startIcon={<CloudDownloadIcon />}
                disabled={gEventsLoading}
              >
                {gEventsLoading ? "Loading…" : "Refresh events"}
              </Button>
            </Stack>

            <List sx={{ mt: 1 }}>
              {gEvents.length === 0 && !gEventsLoading && (
                <Typography sx={{ p: 2 }} color="text.secondary">
                  No upcoming events found.
                </Typography>
              )}

              {gEvents.map((evt) => (
                <ListItem
                  key={evt.id}
                  divider
                  secondaryAction={
                    <Stack direction="row" spacing={1} alignItems="center">
                      {evt.htmlLink && (
                        <Tooltip title="Open in Google Calendar">
                          <Link
                            href={evt.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <IconButton edge="end" size="small">
                              <CalendarMonthIcon fontSize="small" />
                            </IconButton>
                          </Link>
                        </Tooltip>
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => importFromEvent(evt)}
                      >
                        Import
                      </Button>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={evt.summary || "(No title)"}
                    secondary={formatEventTimeRange(evt.start, evt.end)}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Create meeting */}
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

      {/* Meetings list */}
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

function CalendarConnectionBadge({ connected, loading }) {
  if (loading) return <Chip size="small" label="Checking Google…" />;
  return connected ? (
    <Chip size="small" color="success" label="Google Connected" />
  ) : (
    <Chip size="small" color="default" label="Google not connected" />
  );
}

function formatEventTimeRange(startIso, endIso) {
  if (!startIso && !endIso) return "";
  try {
    // Handles date-only (all-day) and dateTime strings
    const start =
      startIso?.length > 10
        ? new Date(startIso)
        : new Date(`${startIso}T00:00:00`);
    const end =
      endIso?.length > 10 ? new Date(endIso) : new Date(`${endIso}T00:00:00`);
    const startStr =
      startIso?.length > 10
        ? start.toLocaleString()
        : `${start.toLocaleDateString()} (all-day)`;
    const endStr =
      endIso?.length > 10 ? end.toLocaleString() : end.toLocaleDateString();
    return `${startStr} → ${endStr}`;
  } catch {
    return startIso || "";
  }
}
