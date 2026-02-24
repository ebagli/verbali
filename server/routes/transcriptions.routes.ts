import express from "express";
import { authMiddleware, type AuthRequest } from "../auth.js";
import { db } from "../db.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", (req: AuthRequest, res) => {
  try {
    const transcriptions = db.prepare(`
      SELECT * FROM transcriptions
      WHERE user_id = ?
      ORDER BY conversation_date DESC
    `).all(req.userId);

    const parsed = transcriptions.map((t: any) => ({
      ...t,
      transcript_json: JSON.parse(t.transcript_json),
      speaker_mapping: t.speaker_mapping ? JSON.parse(t.speaker_mapping) : null,
    }));

    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", (req: AuthRequest, res) => {
  try {
    const transcription = db.prepare(`
      SELECT * FROM transcriptions WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.userId) as any;

    if (!transcription) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json({
      ...transcription,
      transcript_json: JSON.parse(transcription.transcript_json),
      speaker_mapping: transcription.speaker_mapping ? JSON.parse(transcription.speaker_mapping) : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", (req: AuthRequest, res) => {
  try {
    const { conversation_date, transcript_json } = req.body;
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO transcriptions (id, user_id, conversation_date, transcript_json)
      VALUES (?, ?, ?, ?)
    `).run(id, req.userId, conversation_date, JSON.stringify(transcript_json));

    const created = db.prepare(`
      SELECT * FROM transcriptions WHERE id = ?
    `).get(id) as any;

    res.json({
      ...created,
      transcript_json: JSON.parse(created.transcript_json),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", (req: AuthRequest, res) => {
  try {
    const { conversation_date, transcript_json, speaker_mapping, summary, report_html } = req.body;

    db.prepare(`
      UPDATE transcriptions
      SET conversation_date = ?,
          transcript_json = ?,
          speaker_mapping = ?,
          summary = ?,
          report_html = ?
      WHERE id = ? AND user_id = ?
    `).run(
      conversation_date,
      JSON.stringify(transcript_json),
      speaker_mapping ? JSON.stringify(speaker_mapping) : null,
      summary || null,
      report_html || null,
      req.params.id,
      req.userId
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", (req: AuthRequest, res) => {
  try {
    db.prepare(`
      DELETE FROM transcriptions WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.userId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
