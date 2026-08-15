const mongoose = require('mongoose');
const { COLORS, MOVE_TIME, SAFE_POSITIONS } = require('../utils/constants');
const { makeRandomMove } = require('../handlers/handlersFunctions');
const timeoutManager = require('./timeoutManager.js');
const PawnSchema = require('./pawn');
const PlayerSchema = require('./player');

const RoomSchema = new mongoose.Schema({
    name: String,
    private: { type: Boolean, default: false },
    password: String,
    createDate: { type: Date, default: Date.now },
    started: { type: Boolean, default: false },
    full: { type: Boolean, default: false },
    maxPlayers: { type: Number, default: 4 },
    nextMoveTime: Number,
    rolledNumber: Number,
    // ===== NEW: current moving player ke lagatar-chhakke ka counter =====
    // Turn change hote hi 0 pe reset hota hai (changeMovingPlayer me).
    sixStreak: { type: Number, default: 0 },
    players: [PlayerSchema],
    winner: { type: String, default: null },
    pawns: {
        type: [PawnSchema],
        default: () => {
            const startPositions = [];
            for (let i = 0; i < 16; i++) {
                let pawn = {};
                pawn.basePos = i;
                pawn.position = i;
                if (i < 4) pawn.color = COLORS[0];
                else if (i < 8) pawn.color = COLORS[1];
                else if (i < 12) pawn.color = COLORS[2];
                else if (i < 16) pawn.color = COLORS[3];
                startPositions.push(pawn);
            }
            return startPositions;
        },
    },
});

// ===== BEAT PAWNS =====
// 🔧 FIX: safe square (SAFE_POSITIONS) pe ab koi capture nahi hoga, akela pawn ho tab bhi.
// Return value bhi add kiya — capture hua ya nahi, ye caller ko batana zaroori hai (extra-turn rule ke liye).
RoomSchema.methods.beatPawns = function (position, attackingPawnColor) {
    if (SAFE_POSITIONS.includes(position)) return false;
    let captured = false;
    const pawnsOnPosition = this.pawns.filter(pawn => pawn.position === position);
    pawnsOnPosition.forEach(pawn => {
        if (pawn.color !== attackingPawnColor) {
            const index = this.getPawnIndex(pawn._id);
            this.pawns[index].position = this.pawns[index].basePos;
            captured = true;
        }
    });
    return captured;
};

// ===== NEW: IS POSITION BLOCKED =====
// Ludo King jaisa blocking: agar kisi doosre color ke 2+ pawns ek hi cell pe stacked hain,
// wo cell "block" ban jaati hai — koi bhi teesra (alag color ka) pawn wahan land nahi kar sakta.
// Sirf common track (16-67) pe lagu hota hai — apne hi base/home-stretch me sirf apne pawns hote hain.
RoomSchema.methods.isPositionBlocked = function (position, movingColor) {
    if (position < 16 || position > 67) return false;
    const colorCounts = {};
    this.pawns.forEach(p => {
        if (p.position === position) {
            colorCounts[p.color] = (colorCounts[p.color] || 0) + 1;
        }
    });
    return Object.keys(colorCounts).some(color => color !== movingColor && colorCounts[color] >= 2);
};

// ===== CHANGE MOVING PLAYER (UPDATED WITH BOT SUPPORT) =====
RoomSchema.methods.changeMovingPlayer = function () {
    if (this.winner) return;
    const playerIndex = this.players.findIndex(player => player.nowMoving === true);
    this.players[playerIndex].nowMoving = false;
    let nextIndex;
    if (playerIndex + 1 === this.players.length) {
        nextIndex = 0;
    } else {
        nextIndex = playerIndex + 1;
    }
    this.players[nextIndex].nowMoving = true;
    this.nextMoveTime = Date.now() + MOVE_TIME;
    this.rolledNumber = null;
    this.sixStreak = 0; // 👈 NEW: naya player turn shuru karta hai — streak fresh
    timeoutManager.clear(this._id.toString());

    const nextPlayer = this.players[nextIndex];
    const delay = nextPlayer.isBot ? 1000 : MOVE_TIME;
    timeoutManager.set(makeRandomMove, delay, this._id.toString());
};

// ===== NEW: REGISTER ROLL =====
// Dice roll hote hi call hota hai — 6 aaya to streak++ , warna streak 0. Return: current streak.
RoomSchema.methods.registerRoll = function (rolledNumber) {
    this.rolledNumber = rolledNumber;
    this.sixStreak = rolledNumber === 6 ? (this.sixStreak || 0) + 1 : 0;
    return this.sixStreak;
};

// ===== NEW: FORFEIT TURN ON 3 CONSECUTIVE SIXES =====
// Teesra lagatar chhakka aane pe move ka mauka mile bina hi turn agle player ko chala jaata hai.
RoomSchema.methods.forfeitTurnForThreeSixes = function () {
    this.sixStreak = 0;
    this.changeMovingPlayer();
};

// ===== NEW: RESOLVE TURN AFTER MOVE =====
// Move (ya no-move) ke baad decide karta hai turn same player ke paas rahega ya agle ko jaayega.
// Rules: 6 roll kiya → extra turn. Kisi pawn ko capture kiya → extra turn. Warna normal turn-change.
// (3-consecutive-six forfeiture already registerRoll/forfeitTurnForThreeSixes se pehle hi handle ho chuka hota hai,
// yahan streak>=3 check sirf safety-net ke liye hai.)
RoomSchema.methods.resolveTurnAfterMove = function (gotCapture) {
    if (this.sixStreak >= 3) {
        this.sixStreak = 0;
        this.changeMovingPlayer();
        return false;
    }

    if (this.rolledNumber === 6 || gotCapture) {
        const player = this.getCurrentlyMovingPlayer();
        this.rolledNumber = null;
        this.nextMoveTime = Date.now() + MOVE_TIME;
        timeoutManager.clear(this._id.toString());
        const delay = player.isBot ? 1000 : MOVE_TIME;
        timeoutManager.set(makeRandomMove, delay, this._id.toString());
        return true;
    }

    this.changeMovingPlayer();
    return false;
};

// ===== MOVE PAWN =====
// 🔧 FIX: ab capture hua ya nahi ye return karta hai (resolveTurnAfterMove ko chahiye extra-turn decide karne ke liye)
RoomSchema.methods.movePawn = function (pawn) {
    const newPositionOfMovedPawn = pawn.getPositionAfterMove(this.rolledNumber);
    this.changePositionOfPawn(pawn, newPositionOfMovedPawn);
    return this.beatPawns(newPositionOfMovedPawn, pawn.color);
};

// ===== GET PAWNS THAT CAN MOVE =====
// 🔧 FIX: ab blocked cells (isPositionBlocked) pe land karne wale moves bhi exclude hote hain
RoomSchema.methods.getPawnsThatCanMove = function () {
    const movingPlayer = this.getCurrentlyMovingPlayer();
    const playerPawns = this.getPlayerPawns(movingPlayer.color);
    return playerPawns.filter(pawn => {
        if (!pawn.canMove(this.rolledNumber)) return false;
        const newPos = pawn.getPositionAfterMove(this.rolledNumber);
        return !this.isPositionBlocked(newPos, movingPlayer.color);
    });
};

// ===== CHANGE POSITION OF PAWN =====
RoomSchema.methods.changePositionOfPawn = function (pawn, newPosition) {
    const pawnIndex = this.getPawnIndex(pawn._id);
    this.pawns[pawnIndex].position = newPosition;
};

// ===== CAN START GAME =====
RoomSchema.methods.canStartGame = function () {
    return this.players.filter(player => player.ready).length >= 2;
};

// ===== START GAME =====
RoomSchema.methods.startGame = function () {
    this.started = true;
    this.nextMoveTime = Date.now() + MOVE_TIME;
    this.players.forEach(player => (player.ready = true));
    this.players[0].nowMoving = true;
    timeoutManager.set(makeRandomMove, MOVE_TIME, this._id.toString());
};

// ===== END GAME =====
RoomSchema.methods.endGame = function (winner) {
    timeoutManager.clear(this._id.toString());
    this.rolledNumber = null;
    this.nextMoveTime = null;
    this.players.map(player => (player.nowMoving = false));
    this.winner = winner;
    this.save();
};

// ===== GET WINNER =====
RoomSchema.methods.getWinner = function () {
    if (this.pawns.filter(pawn => pawn.color === 'red' && pawn.position === 73).length === 4) {
        return 'red';
    }
    if (this.pawns.filter(pawn => pawn.color === 'blue' && pawn.position === 79).length === 4) {
        return 'blue';
    }
    if (this.pawns.filter(pawn => pawn.color === 'green' && pawn.position === 85).length === 4) {
        return 'green';
    }
    if (this.pawns.filter(pawn => pawn.color === 'yellow' && pawn.position === 91).length === 4) {
        return 'yellow';
    }
    return null;
};

// ===== IS FULL =====
RoomSchema.methods.isFull = function () {
    if (this.players.length >= this.maxPlayers) {
        this.full = true;
    }
    return this.full;
};

// ===== GET PLAYER =====
RoomSchema.methods.getPlayer = function (playerId) {
    return this.players.find(player => player._id.toString() === playerId.toString());
};

// ===== ADD PLAYER =====
RoomSchema.methods.addPlayer = function (name, id) {
    if (this.full) return;
    const colorSequence = this.maxPlayers === 2 ? [COLORS[0], COLORS[2]] : COLORS;
    this.players.push({
        sessionID: id,
        name: name,
        ready: false,
        color: colorSequence[this.players.length],
    });
};

// ===== GET PAWN INDEX =====
RoomSchema.methods.getPawnIndex = function (pawnId) {
    return this.pawns.findIndex(pawn => pawn._id.toString() === pawnId.toString());
};

// ===== GET PAWN =====
RoomSchema.methods.getPawn = function (pawnId) {
    return this.pawns.find(pawn => pawn._id.toString() === pawnId.toString());
};

// ===== GET PLAYER PAWNS =====
RoomSchema.methods.getPlayerPawns = function (color) {
    return this.pawns.filter(pawn => pawn.color === color);
};

// ===== GET CURRENTLY MOVING PLAYER =====
RoomSchema.methods.getCurrentlyMovingPlayer = function () {
    return this.players.find(player => player.nowMoving === true);
};

const Room = mongoose.model('Room', RoomSchema);

module.exports = Room;
