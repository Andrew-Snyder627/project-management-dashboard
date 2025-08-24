import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Divider,
  Alert,
  Snackbar,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import SummarizeIcon from "@mui/icons-material/Summarize";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";

export default function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mid = Number(id);

  const [meeting, setMeeting] = useState(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState(null);
  const [summaryEtag, setSummaryEtag] = useState(null);

  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    severity: "success",
  });

  const safeParse = (str, fallback) => {
    try {
      return str ? JSON.parse(str) : fallback;
    } catch {
      return fallback;
    }
  };

  const loadMeeting = async () => {
    const { json } = await api.getMeeting(mid);
    setMeeting(json);
    setTitle(json?.title || "");
    setNotes(json?.raw_notes || "");
  };
  const loadItems = async () => {
    const { json } = await api.listItems(mid);
    setItems(json || []);
  };
  const loadSummary = async () => {
    const { status, json, etag } = await api.getSummary(mid, summaryEtag);
    if (status !== 304) {
      setSummary(json);
      setSummaryEtag(etag || null);
    }
  };

  useEffect(() => {
    setError("");
    loadMeeting();
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid]);

  const saveMeta = async () => {
    setSaving(true);
    try {
      await api.updateMeeting(mid, {
        title: title.trim() || "Untitled",
        raw_notes: notes,
      });
      await loadMeeting();
      setToast({ open: true, msg: "Saved", severity: "success" });
    } catch (ex) {
      setError(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const summarize = async () => {
    setError("");
    try {
      await api.summarize(mid);
      setSummaryEtag(null);
      await loadSummary();
      setToast({ open: true, msg: "Summary created", severity: "success" });
    } catch (ex) {
      setError(ex.message);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    const desc = newItem.trim();
    if (!desc) return;
    await api.createItem(mid, {
      description: desc,
      priority: "medium",
      status: "open",
    });
    setNewItem("");
    await loadItems();
  };

  const toggleDone = async (item) => {
    const next = item.status === "done" ? "open" : "done";
    await api.updateItem(item.id, { status: next });
    await loadItems();
  };

  const delMeeting = async () => {
    await api.deleteMeeting(mid);
    navigate("/");
  };

  const meta = summary ? safeParse(summary.model_metadata, {}) : {};
  const bullets = summary ? safeParse(summary.bullets_json, []) : [];
  const decisions = summary ? safeParse(summary.decisions_json, []) : [];

  const copySummary = async () => {
    const md = [
      `# ${meeting?.title || "Meeting"}`,
      "",
      "## Key Points",
      ...bullets.map((b) => `- ${b}`),
      "",
      "## Decisions",
      ...decisions.map((d) => `- ${d}`),
    ].join("\n");
    await navigator.clipboard.writeText(md);
    setToast({
      open: true,
      msg: "Summary copied to clipboard",
      severity: "info",
    });
  };

  const downloadSummary = () => {
    const payload = {
      meeting_id: meeting?.id,
      title: meeting?.title,
      bullets,
      decisions,
      model_metadata: meta,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary-${meeting?.id || "meeting"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ flex: 1, maxWidth: 480 }}
        />
        <Button
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={saveMeta}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          color="error"
          variant="text"
          startIcon={<DeleteIcon />}
          onClick={delMeeting}
        >
          Delete
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Notes + Summarize */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Notes
              </Typography>
              <TextField
                label="Meeting notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
                multiline
                minRows={8}
              />
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SummarizeIcon />}
                  onClick={summarize}
                  disabled={!notes.trim()}
                >
                  Summarize
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadSummary}
                >
                  Load latest
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle1">Latest Summary</Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={copySummary}
                  >
                    Copy
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={downloadSummary}
                  >
                    Download
                  </Button>
                </Stack>
              </Stack>
              {summary ? (
                <>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    Model: {meta.model || "—"}
                    {meta.usage?.total_tokens
                      ? ` • tokens: ${meta.usage.total_tokens}`
                      : ""}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2">Key Points</Typography>
                  <List dense>
                    {bullets.map((b, i) => (
                      <ListItem key={i}>
                        <ListItemText primary={b} />
                      </ListItem>
                    ))}
                  </List>
                  <Typography variant="subtitle2">Decisions</Typography>
                  <List dense>
                    {decisions.map((d, i) => (
                      <ListItem key={i}>
                        <ListItemText primary={d} />
                      </ListItem>
                    ))}
                  </List>
                </>
              ) : (
                <Typography color="text.secondary">No summary yet.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Action Items */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Action Items
              </Typography>
              <form onSubmit={addItem}>
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    label="New action item"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    fullWidth
                  />
                  <Button type="submit" variant="contained">
                    Add
                  </Button>
                </Stack>
              </form>
              <List>
                {items.map((it) => (
                  <ListItem key={it.id} divider>
                    <Checkbox
                      checked={it.status === "done"}
                      onChange={() => toggleDone(it)}
                    />
                    <ListItemText
                      primary={it.description}
                      secondary={`Status: ${it.status}`}
                    />
                  </ListItem>
                ))}
                {items.length === 0 && (
                  <Typography color="text.secondary">
                    No action items yet.
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={toast.open}
        autoHideDuration={2000}
        onClose={() => setToast({ ...toast, open: false })}
      >
        <Alert severity={toast.severity} variant="filled">
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
