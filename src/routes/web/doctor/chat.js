const express = require('express');
const router = express.Router();

// Chat routes for future implementation
router.get('/active', (req, res) => {
  res.json({ success: true, message: 'Chat feature coming soon' });
});

module.exports = router;