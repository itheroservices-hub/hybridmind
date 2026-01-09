const express = require("express");
const router = express.Router();
const agenticWorkflow = require("../workflows/agent");

router.post("/", async (req, res) => {
  const { goal, code } = req.body;

  try {
    const output = await agenticWorkflow(goal, code);
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;