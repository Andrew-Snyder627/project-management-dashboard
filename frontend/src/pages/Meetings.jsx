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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [raw, setRaw] = useState("");

  const load = async () => {
    const { json } = await api.listMeetings();
    setMeetings(json || []);
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
    await load();
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Meetings
      </Typography>

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
          <List>
            {meetings.map((m) => (
              <ListItem key={m.id} disablePadding divider>
                <ListItemButton component={RouterLink} to={`/meeting/${m.id}`}>
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
        </CardContent>
      </Card>
    </Box>
  );
}
