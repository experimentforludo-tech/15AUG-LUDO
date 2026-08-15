const COLORS = ['red', 'blue', 'green', 'yellow'];
const MOVE_TIME = 15000;

// ===== NEW: Safe squares (Ludo King jaisa) =====
// 4 starting/entry squares (16,29,42,55) + 4 star squares (har entry se 8 aage) = 8 total,
// classic Ludo layout ke mutabik. In squares pe koi bhi pawn capture nahi ho sakta, akela ho tab bhi.
const SAFE_POSITIONS = [16, 24, 29, 37, 42, 50, 55, 63];

module.exports = { COLORS, MOVE_TIME, SAFE_POSITIONS };
