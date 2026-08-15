const mongoose = require('mongoose');

const LeaderboardSchema = new mongoose.Schema({
    playerId: { type: String, required: true, unique: true },
    playerName: { type: String, required: true },
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    currentLevel: { type: Number, default: 0 }, // 0-4
    lastGameDate: { type: Date, default: Date.now }
});

const Leaderboard = mongoose.model('Leaderboard', LeaderboardSchema);

module.exports = Leaderboard;