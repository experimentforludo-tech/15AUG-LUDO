const { getRoom, updateRoom } = require('../services/roomService');
const { sendToPlayersRolledNumber, sendWinner } = require('../socket/emits');
const { rollDice, isMoveValid } = require('./handlersFunctions');

module.exports = socket => {
    const req = socket.request;

    // ===== handleMovePawn =====
    // 🔧 FIX: ab room.movePawn() use karta hai (jo capture bhi khud handle karta hai aur
    // batata hai capture hua ya nahi), aur turn-change ab resolveTurnAfterMove decide karta hai
    // (6 pe extra turn, capture pe extra turn, warna normal pass).
    const handleMovePawn = async pawnId => {
        const room = await getRoom(req.session.roomId);
        if (room.winner) return;
        const pawn = room.getPawn(pawnId);
        if (isMoveValid(req.session, pawn, room)) {
            const gotCapture = room.movePawn(pawn);
            room.resolveTurnAfterMove(gotCapture);
            const winner = room.getWinner();
            if (winner) {
                room.endGame(winner);
                sendWinner(room._id.toString(), winner);
            }
            await updateRoom(room);
        }
    };

    // ===== handleRollDice =====
    // 🔧 FIX: ab poora room fetch karke room.registerRoll() se sixStreak track hota hai.
    // 3 lagatar chhakke pe move ka mauka mile bina hi turn forfeit ho jaata hai.
    const handleRollDice = async () => {
        const room = await getRoom(req.session.roomId);
        if (room.winner) return;

        const rolledNumber = rollDice();
        const streak = room.registerRoll(rolledNumber);
        sendToPlayersRolledNumber(req.session.roomId, rolledNumber);

        if (streak >= 3) {
            room.forfeitTurnForThreeSixes();
            await updateRoom(room);
            return;
        }

        const player = room.getPlayer(req.session.playerId);
        if (!player.canMove(room, rolledNumber)) {
            // koi move possible nahi — phir bhi agar 6 aaya hai to extra turn milega
            room.resolveTurnAfterMove(false);
        }
        await updateRoom(room);
    };

    socket.on('game:roll', handleRollDice);
    socket.on('game:move', handleMovePawn);
};
