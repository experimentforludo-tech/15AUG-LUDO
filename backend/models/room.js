const mongoose = require('mongoose');
const { COLORS, MOVE_TIME } = require('../utils/constants');
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
RoomSchema.methods.beatPawns = function (position, attackingPawnColor) {
    const pawnsOnPosition = this.pawns.filter(pawn => pawn.position === position);
    pawnsOnPosition.forEach(pawn => {
        if (pawn.color !== attackingPawnColor) {
            const index = this.getPawnIndex(pawn._id);
            this.pawns[index].position = this.pawns[index].basePos;
        }
    });
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
    timeoutManager.clear(this._id.toString());

    const nextPlayer = this.players[nextIndex];
    const delay = nextPlayer.isBot ? 1000 : MOVE_TIME;
    timeoutManager.set(makeRandomMove, delay, this._id.toString());
};

// ===== MOVE PAWN =====
RoomSchema.methods.movePawn = function (pawn) {
    const newPositionOfMovedPawn = pawn.getPositionAfterMove(this.rolledNumber);
    this.changePositionOfPawn(pawn, newPositionOfMovedPawn);
    this.beatPawns(newPositionOfMovedPawn, pawn.color);
};

// ===== GET PAWNS THAT CAN MOVE =====
RoomSchema.methods.getPawnsThatCanMove = function () {
    const movingPlayer = this.getCurrentlyMovingPlayer();
    const playerPawns = this.getPlayerPawns(movingPlayer.color);
    return playerPawns.filter(pawn => pawn.canMove(this.rolledNumber));
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
// 👇 CRITICAL FIX: color ab room ke maxPlayers ke hisaab se decide hota hai.
// 2-player room → [red, green] (diagonal opposite corners)
// 4-player room → [red, blue, green, yellow] (sabhi 4 corners, normal sequence)
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
