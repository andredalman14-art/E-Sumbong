const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// 1. Personnel Login (index.html)
app.post("/api/auth/login", async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const result = await pool.query(
      "SELECT personnel_id, full_name, email, role FROM personnel WHERE email = $1 AND password_hash = $2 AND role = $3",
      [email, password, role],
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials or role." });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get All Complaints (dashboard.html & complaints.html)
app.get("/api/complaints", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, p.full_name AS assigned_personnel_name
      FROM complaints c
      LEFT JOIN personnel p ON c.assigned_to = p.personnel_id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Record New Complaint (record-walkin.html)
app.post("/api/complaints", async (req, res) => {
  const {
    reference_number,
    resident_name,
    first_name,
    last_name,
    contact_number,
    category,
    incident_date,
    incident_time,
    incident_location,
    persons_involved,
    description,
  } = req.body;
  const resolvedResidentName =
    resident_name ||
    [first_name, last_name].filter((name) => name && String(name).trim()).join(" ").trim();

  try {
    const result = await pool.query(
      `INSERT INTO complaints
       (reference_number, resident_name, contact_number, category, incident_date, incident_time, incident_location, persons_involved, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        reference_number,
        resolvedResidentName,
        contact_number,
        category,
        incident_date,
        incident_time,
        incident_location,
        persons_involved,
        description,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get All Scheduled Hearings (hearing-calendar.html)
app.get("/api/hearings", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*, c.reference_number, c.resident_name, c.category, p.full_name AS assigned_personnel_name
      FROM hearings h
      JOIN complaints c ON h.complaint_id = c.complaint_id
      JOIN personnel p ON h.assigned_personnel_id = p.personnel_id
      ORDER BY h.hearing_date ASC, h.hearing_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Check Hearing Availability (Schedule Hearing Modal)
app.post("/api/hearings/check-availability", async (req, res) => {
  const {
    hearing_date,
    hearing_time,
    hearing_location,
    assigned_personnel_id,
  } = req.body;
  try {
    const conflictQuery = `
      SELECT h.hearing_id, h.hearing_type, h.hearing_date, h.hearing_time, h.hearing_location, c.reference_number, p.full_name AS personnel_name
      FROM hearings h
      JOIN complaints c ON h.complaint_id = c.complaint_id
      JOIN personnel p ON h.assigned_personnel_id = p.personnel_id
      WHERE h.hearing_date = $1
        AND h.status IN ('Scheduled', 'Rescheduled')
        AND (h.hearing_location = $2 OR h.assigned_personnel_id = $3)
        AND ABS(EXTRACT(EPOCH FROM (h.hearing_time - $4::time))) < 3600
    `;
    const result = await pool.query(conflictQuery, [
      hearing_date,
      hearing_location,
      assigned_personnel_id,
      hearing_time,
    ]);

    if (result.rows.length > 0) {
      return res.json({ available: false, conflict: result.rows[0] });
    }
    res.json({ available: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Save Confirmed Hearing & Log Activity
app.post("/api/hearings", async (req, res) => {
  const {
    complaint_id,
    hearing_type,
    hearing_date,
    hearing_time,
    hearing_location,
    assigned_personnel_id,
    notify_resident,
    additional_instructions,
    updated_by,
  } = req.body;

  try {
    const hearing = await pool.query(
      `INSERT INTO hearings
       (complaint_id, hearing_type, hearing_date, hearing_time, hearing_location, assigned_personnel_id, notify_resident, additional_instructions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        complaint_id,
        hearing_type,
        hearing_date,
        hearing_time,
        hearing_location,
        assigned_personnel_id,
        notify_resident,
        additional_instructions,
      ],
    );

    await pool.query(
      `UPDATE complaints SET status = 'For Hearing', assigned_to = $2 WHERE complaint_id = $1`,
      [complaint_id, assigned_personnel_id],
    );

    await pool.query(
      `INSERT INTO activity_logs (complaint_id, hearing_id, activity, new_status, remarks, updated_by)
       VALUES ($1, $2, 'Hearing Scheduled', 'For Hearing', $3, $4)`,
      [
        complaint_id,
        hearing.rows[0].hearing_id,
        `${hearing_date} at ${hearing_time} (${hearing_location})`,
        updated_by || 1,
      ],
    );

    res.status(201).json(hearing.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get Activity Logs (activity-log.html)
app.get("/api/activity-logs", async (req, res) => {
  try {
    const complaintFilter = req.query.complaint_id ? "WHERE a.complaint_id = $1" : "";
    const values = req.query.complaint_id ? [req.query.complaint_id] : [];
    const result = await pool.query(`
      SELECT a.*, c.reference_number, p.full_name AS updated_by_name
      FROM activity_logs a
      JOIN complaints c ON a.complaint_id = c.complaint_id
      LEFT JOIN personnel p ON a.updated_by = p.personnel_id
      ${complaintFilter}
      ORDER BY a.created_at DESC
    `, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Persist a request for more information against the existing complaint.
app.post("/api/complaints/:id/information-requests", async (req, res) => {
  const { id } = req.params;
  const { reason, information, missing_items, request_date, response_deadline,
    notification_message, updated_by } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const complaint = await client.query(
      "SELECT complaint_id, status, reference_number FROM complaints WHERE complaint_id = $1 FOR UPDATE", [id],
    );
    if (!complaint.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Complaint not found." });
    }
    await client.query("UPDATE complaints SET status = $1 WHERE complaint_id = $2", ["For Additional Information", id]);
    const details = [
      `Reason: ${reason || "Additional information requested"}`,
      `Requested information: ${information || ""}`,
      `Missing items: ${(missing_items || []).join(", ")}`,
      `Request date: ${request_date || "Not specified"}`,
      `Response deadline: ${response_deadline || "Not specified"}`,
      `Resident message: ${notification_message || ""}`,
    ].join("\n");
    const log = await client.query(
      `INSERT INTO activity_logs (complaint_id, activity, previous_status, new_status, remarks, updated_by)
       VALUES ($1, 'Additional information requested', $2, $3, $4, $5) RETURNING *`,
      [id, complaint.rows[0].status, "For Additional Information", details, updated_by || 1],
    );
    await client.query("COMMIT");
    res.status(201).json({ complaint_id: Number(id), status: "For Additional Information", request: log.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update status, assignment and activity without creating a duplicate complaint.
app.patch("/api/complaints/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, action_summary, action_date, assigned_to, remarks, channel,
    notify_resident, resident_message, acknowledgment, acknowledgment_notes, updated_by } = req.body;
  if (!status) return res.status(400).json({ error: "A new complaint status is required." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prev = await client.query("SELECT status FROM complaints WHERE complaint_id = $1 FOR UPDATE", [id]);
    if (!prev.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Complaint not found." });
    }
    const updated = await client.query(
      "UPDATE complaints SET status = $1, assigned_to = COALESCE($2, assigned_to) WHERE complaint_id = $3 RETURNING *",
      [status, assigned_to || null, id],
    );
    const logDetails = [
      action_summary && `Action: ${action_summary}`,
      action_date && `Date of action: ${action_date}`,
      remarks && `Remarks: ${remarks}`,
      channel && `Communication channel: ${channel}`,
      notify_resident && `Resident message: ${resident_message || ""}`,
      acknowledgment && `Resident acknowledgment: ${acknowledgment}`,
      acknowledgment_notes && `Acknowledgment notes: ${acknowledgment_notes}`,
    ].filter(Boolean).join("\n");
    await client.query(
      `INSERT INTO activity_logs (complaint_id, activity, previous_status, new_status, remarks, updated_by)
       VALUES ($1, 'Complaint status updated', $2, $3, $4, $5)`,
      [id, prev.rows[0].status, status, logDetails, updated_by || 1],
    );
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 8. Get All Personnel (for Routing & Hearing Assignment dropdowns)
app.get("/api/personnel", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT personnel_id, full_name, role FROM personnel ORDER BY full_name ASC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Route / Assign Complaint & Log Activity
app.patch("/api/complaints/:id/details", async (req, res) => {
  const { id } = req.params;
  const { resident_name, contact_number, resident_address, purok_location,
    category, incident_location, incident_date, incident_time, description, updated_by } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // These resident fields were not part of the original complaint table, so
    // add them in place to keep older installations compatible.
    await client.query(`ALTER TABLE complaints
      ADD COLUMN IF NOT EXISTS resident_address TEXT,
      ADD COLUMN IF NOT EXISTS purok_location TEXT`);
    const current = await client.query(
      "SELECT * FROM complaints WHERE complaint_id = $1 FOR UPDATE", [id],
    );
    if (!current.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Complaint not found." });
    }
    const before = current.rows[0];
    const edits = [
      ["resident name", "resident_name", resident_name],
      ["contact number", "contact_number", contact_number],
      ["resident address", "resident_address", resident_address],
      ["purok/location", "purok_location", purok_location],
      ["complaint category", "category", category],
      ["incident location", "incident_location", incident_location],
      ["incident date", "incident_date", incident_date],
      ["incident time", "incident_time", incident_time],
      ["complaint description", "description", description],
    ];
    const normalized = (key, value) => {
      if (value == null) return "";
      if (key === "incident_time") return String(value).slice(0, 5);
      if (key === "incident_date") return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
      return String(value).trim();
    };
    const changed = edits.filter(([, key, value]) => normalized(key, before[key]) !== normalized(key, value));
    if (!changed.length) {
      await client.query("COMMIT");
      return res.json(before);
    }
    const updated = await client.query(
      `UPDATE complaints SET resident_name=$1, contact_number=$2,
        resident_address=$3, purok_location=$4, category=$5,
        incident_location=$6, incident_date=$7, incident_time=$8, description=$9
       WHERE complaint_id=$10 RETURNING *`,
      [resident_name, contact_number, resident_address, purok_location, category,
        incident_location, incident_date || null, incident_time || null, description, id],
    );
    const changedText = changed.map(([label]) => label);
    const summary = changedText.length === 1 ? changedText[0] : `${changedText.slice(0, -1).join(", ")} and ${changedText[changedText.length - 1]}`;
    await client.query(
      `INSERT INTO activity_logs (complaint_id, activity, previous_status, new_status, remarks, updated_by)
       VALUES ($1, 'Complaint Details Updated', $2, $2, $3, $4)`,
      [id, before.status, `Updated ${summary}.`, updated_by || 1],
    );
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.patch("/api/complaints/:id/route", async (req, res) => {
  const { id } = req.params;
  const { assigned_to, status, decision, routing_notes, updated_by } = req.body;

  try {
    const prev = await pool.query(
      "SELECT status, reference_number FROM complaints WHERE complaint_id = $1",
      [id],
    );
    if (prev.rows.length === 0) {
      return res.status(404).json({ error: "Complaint not found." });
    }

    const updated = await pool.query(
      `UPDATE complaints
       SET assigned_to = $1,
           status = $2,
           decision = $3,
           routing_notes = $4,
           routing_date = CURRENT_DATE
       WHERE complaint_id = $5
       RETURNING *`,
      [assigned_to, status, decision, routing_notes, id],
    );

    await pool.query(
      `INSERT INTO activity_logs (complaint_id, activity, previous_status, new_status, remarks, updated_by)
       VALUES ($1, 'Complaint routed', $2, $3, $4, $5)`,
      [
        id,
        prev.rows[0].status,
        status,
        routing_notes ||
          `Routed ${prev.rows[0].reference_number} (${decision || status})`,
        updated_by || 1,
      ],
    );

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/complaints/:id", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT complaint_id, reference_number FROM complaints WHERE complaint_id = $1",
      [id],
    );
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Complaint not found." });
    }

    await client.query("DELETE FROM activity_logs WHERE complaint_id = $1", [id]);
    await client.query("DELETE FROM hearings WHERE complaint_id = $1", [id]);
    await client.query("DELETE FROM complaints WHERE complaint_id = $1", [id]);
    await client.query("COMMIT");

    res.json({
      deleted: true,
      complaint_id: Number(id),
      reference_number: existing.rows[0].reference_number,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.listen(process.env.PORT, () => {
  console.log(`E-Sumbong API running at http://localhost:${process.env.PORT}`);
});
