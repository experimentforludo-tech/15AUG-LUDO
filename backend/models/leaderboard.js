const mongoose = require('mongoose');

const LeaderboardSchema = new mongoose.Schema({
    playerId: { type: String, required: true, unique: true },
    playerName: { type: String, required: true },
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    currentLevel: { type: Number, default: 0 },
    lastGameDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Leaderboard', LeaderboardSchema);