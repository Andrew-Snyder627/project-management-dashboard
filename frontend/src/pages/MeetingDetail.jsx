import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import SummarizeIcon from "@mui/icons-material/Summarize";
import RefreshIcon from "@mui/icons-material/Refresh";

export default function MeetingDetail() {
  const { id } = useParams();
  const mid = Number(id);

  const [meeting, setMeeting] = useState(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState(null);
  const [summaryEtag, setSummaryEtag] = useState(null);

  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState("");

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
    // summary loaded on demand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid]);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await api.updateMeeting(mid, { raw_notes: notes });
      await loadMeeting();
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

  const meta = summary ? safeParse(summary.model_metadata, {}) : {};
  const bullets = summary ? safeParse(summary.bullets_json, []) : [];
  const decisions = summary ? safeParse(summary.decisions_json, []) : [];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {meeting?.title || "Meeting"}
      </Typography>
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
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={saveNotes}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save notes"}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SummarizeIcon />}
                  onClick={summarize}
                  disabled={!notes.trim()}
                >
                  Summarize
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
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={loadSummary}
                >
                  Load latest
                </Button>
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
                  <ListItem
                    key={it.id}
                    divider
                    secondaryAction={
                      <Typography variant="caption" color="text.secondary">
                        {it.status}
                      </Typography>
                    }
                  >
                    <Checkbox
                      checked={it.status === "done"}
                      onChange={() => toggleDone(it)}
                    />
                    <ListItemText primary={it.description} />
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
    </Box>
  );
}
