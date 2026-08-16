const COLORS = ['red', 'blue', 'green', 'yellow'];
const MOVE_TIME = 15000;

// ===== NEW: Safe squares (Ludo King jaisa) =====
// 4 starting/entry squares (16,29,42,55) + 4 star squares (har entry se 8 aage) = 8 total,
// classic Ludo layout ke mutabik. In squares pe koi bhi pawn capture nahi ho sakta, akela ho tab bhi.
const SAFE_POSITIONS = [16, 24, 29, 37, 42, 50, 55, 63];

// ===== NEW: agar "Play with Friends" wala room 30 minute tak start nahi hota
// (seat khaali reh gayi, ya sirf host akela baitha reh gaya), to wo apne aap delete ho jayega.
const LOBBY_CLEANUP_TIME = 30 * 60 * 1000; // 30 minutes

module.exports = { COLORS, MOVE_TIME, SAFE_POSITIONS, LOBBY_CLEANUP_TIME };
