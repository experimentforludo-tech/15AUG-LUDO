const socketManager = require('./socketManager');

// ===== NEW: last-emitted signature cache (per room) =====
// Redundant emits skip karne ke liye — agar room state pichli baar jo bheja tha usi jaisa hai,
// dobara poora JSON socket pe nahi bhejenge. (Poora field-level diffing Tier 3+ me frontend
// changes ke saath aayega; ye ek safe, backend-only optimization hai jo abhi ke wire-format
// ko frontend-breaking banaye bina traffic reduce karta hai.)
const lastEmittedSignature = new Map(); // roomId -> string signature

const computeSignature = room => {
    // Sirf gameplay-relevant fields — nextMoveTime jaise timestamp ko chhod ke,
    // taaki sirf timer refresh hone se hi false-positive "changed" na ho.
    const pawnsSig = room.pawns.map(p => `${p._id}:${p.position}`).join(',');
    const playersSig = room.players.map(p => `${p._id}:${p.nowMoving}:${p.ready}`).join(',');
    return `${room.rolledNumber}|${room.started}|${room.full}|${room.winner}|${playersSig}|${pawnsSig}`;
};

const sendToPlayersRolledNumber = (id, rolledNumber) => {
    socketManager.getIO().to(id).emit('game:roll', rolledNumber);
};

const sendToPlayersData = room => {
    socketManager.getIO().to(room._id.toString()).emit('room:data', JSON.stringify(room));
};

// ===== NEW: emit sirf tab jab kuch actually badla ho =====
const sendToPlayersDataIfChanged = room => {
    const id = room._id.toString();
    const signature = computeSignature(room);
    if (lastEmittedSignature.get(id) === signature) return; // kuch nahi badla, skip
    lastEmittedSignature.set(id, signature);
    sendToPlayersData(room);
};

const sendToOnePlayerData = (id, room) => {
    socketManager.getIO().to(id).emit('room:data', JSON.stringify(room));
};

const sendToOnePlayerRooms = (id, rooms) => {
    socketManager.getIO().to(id).emit('room:rooms', JSON.stringify(rooms));
};

const sendWinner = (id, winner) => {
    socketManager.getIO().to(id).emit('game:winner', winner);
};

module.exports = {
    sendToPlayersData,
    sendToPlayersDataIfChanged,
    sendToPlayersRolledNumber,
    sendToOnePlayerData,
    sendToOnePlayerRooms,
    sendWinner,
};
