import { useEffect, useMemo, useState } from "react";
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
  const [hasCalendarScope, setHasCalendarScope] = useState(false);
  const [gEventsLoading, setGEventsLoading] = useState(false);
  const [gEvents, setGEvents] = useState([]);

  const [toast, setToast] = useState({
    open: false,
    msg: "",
    severity: "success",
  });

  // ---- URL query helper for post-callback messages ----
  const query = useMemo(() => new URLSearchParams(window.location.search), []);

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
      const connected = Boolean(json?.connected);
      setGoogleConnected(connected);
      setHasCalendarScope(Boolean(json?.hasCalendar));
      // If we’re connected but missing scope, nudge the user
      if (connected && !json?.hasCalendar) {
        setToast({
          open: true,
          severity: "warning",
          msg: "Google is connected, but calendar permission wasn’t granted. Click “Re-connect Google” and check the box.",
        });
      }
    } catch {
      setGoogleConnected(false);
      setHasCalendarScope(false);
    } finally {
      setGStatusLoading(false);
    }
  };

  const loadGoogleEvents = async () => {
    if (!googleConnected || !hasCalendarScope) return;
    setGEventsLoading(true);
    try {
      const { status, json } = await api.listGoogleEvents();
      if (status === 403 && json?.error === "missing_calendar_scope") {
        setToast({
          open: true,
          severity: "warning",
          msg: "Calendar permission wasn’t granted. Click “Re-connect Google” and check the box.",
        });
        setGEvents([]);
        return;
      }
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
    // Full page redirect to backend OAuth start
    window.location.href = api.googleLoginUrl();
  };

  // On mount: show any message from callback (?google_error & ?help)
  useEffect(() => {
    const ge = query.get("google_error");
    const help = query.get("help");
    if (ge) {
      setToast({
        open: true,
        severity: ge === "missing_calendar_scope" ? "warning" : "error",
        msg:
          (help && decodeURIComponent(help)) ||
          (ge === "missing_calendar_scope"
            ? "Calendar permission wasn’t granted. Click “Re-connect Google” and check the box."
            : "Google connection failed. Please try again."),
      });
      // Clean the URL so it doesn't keep re-triggering
      const url = new URL(window.location.href);
      url.searchParams.delete("google_error");
      url.searchParams.delete("help");
      window.history.replaceState({}, "", url);
    }
    // Also check current connection status
    checkGoogleStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the status changes and we do have scope, load events
  useEffect(() => {
    if (googleConnected && hasCalendarScope) {
      loadGoogleEvents();
    } else {
      setGEvents([]);
    }
  }, [googleConnected, hasCalendarScope]);

  const importFromEvent = async (evt) => {
    const title = evt.summary || "Calendar event";
    const payload = {
      title,
      raw_notes: "",
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
            hasScope={hasCalendarScope}
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

      {/* Google Calendar events panel (visible once connected + scoped) */}
      {googleConnected && hasCalendarScope && (
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
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
      >
        <Alert severity={toast.severity} variant="filled">
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function CalendarConnectionBadge({ connected, hasScope, loading }) {
  if (loading) return <Chip size="small" label="Checking Google…" />;

  if (!connected) {
    return <Chip size="small" color="default" label="Google not connected" />;
  }

  if (connected && !hasScope) {
    return (
      <Chip
        size="small"
        color="warning"
        label="Calendar permission not granted"
      />
    );
  }

  return <Chip size="small" color="success" label="Google Connected" />;
}

function formatEventTimeRange(startIso, endIso) {
  if (!startIso && !endIso) return "";
  try {
    // Handle date-only (YYYY-MM-DD) vs full dateTime
    const start =
      startIso && startIso.length > 10
        ? new Date(startIso)
        : startIso
        ? new Date(`${startIso}T00:00:00`)
        : null;

    const end =
      endIso && endIso.length > 10
        ? new Date(endIso)
        : endIso
        ? new Date(`${endIso}T00:00:00`)
        : null;

    const startStr =
      startIso && startIso.length > 10
        ? start.toLocaleString()
        : start
        ? `${start.toLocaleDateString()} (all-day)`
        : "";

    const endStr =
      endIso && endIso.length > 10
        ? end.toLocaleString()
        : end
        ? end.toLocaleDateString()
        : "";

    if (startStr && endStr) return `${startStr} → ${endStr}`;
    return startStr || endStr;
  } catch {
    return startIso || "";
  }
}
