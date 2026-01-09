const express = require("express");
const router = express.Router();
const runService = require("../services/runService");

router.post("/", async (req, res) => {
  const { models, prompt, code } = req.body;

  try {
    const output = await runService(models, prompt, code);
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;