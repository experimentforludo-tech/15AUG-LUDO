const { sendToPlayersRolledNumber, sendWinner } = require('../socket/emits');
const Leaderboard = require('../models/leaderboard');

const rollDice = () => Math.ceil(Math.random() * 6);

// ===== EVALUATION =====
const evaluateMove = (room, pawn, newPos) => {
    let score = 0;
    const color = pawn.color;
    const opponentColors = ['red','blue','green','yellow'].filter(c => c !== color);

    // 1. Moving out of base
    if (pawn.position === pawn.basePos && (room.rolledNumber === 6 || room.rolledNumber === 1)) {
        score += 30;
    }

    // 2. Distance to home (closer is better)
    const maxPos = { red: 73, blue: 79, green: 85, yellow: 91 }[color];
    const distance = maxPos - newPos;
    score += (maxPos - distance) / maxPos * 20; // 0 to 20

    // 3. Capturing opponent
    const opponentPawnsOnPos = room.pawns.filter(p => p.position === newPos && opponentColors.includes(p.color));
    if (opponentPawnsOnPos.length > 0) {
        score += 40;
    }

    // 4. Risk: will opponent capture me next turn?
    const opponentPawns = room.pawns.filter(p => opponentColors.includes(p.color));
    for (const opp of opponentPawns) {
        for (let d = 1; d <= 6; d++) {
            const oppNewPos = opp.getPositionAfterMove(d);
            if (oppNewPos === newPos) {
                score -= 15;
                break;
            }
        }
    }

    // 5. Bonus for being in home stretch
    if (newPos > maxPos - 6) {
        score += 10;
    }

    return score;
};

const getBestMove = (room, pawnsThatCanMove, smartness) => {
    if (!pawnsThatCanMove.length) return null;

    // smartness = probability to choose best move
    if (Math.random() > smartness) {
        // Random move
        return pawnsThatCanMove[Math.floor(Math.random() * pawnsThatCanMove.length)];
    }

    // Best move
    let bestPawn = null;
    let bestScore = -Infinity;
    for (const pawn of pawnsThatCanMove) {
        const newPos = pawn.getPositionAfterMove(room.rolledNumber);
        const score = evaluateMove(room, pawn, newPos);
        if (score > bestScore) {
            bestScore = score;
            bestPawn = pawn;
        }
    }
    return bestPawn;
};

// ===== LEADERBOARD UPDATE =====
const updateLeaderboard = async (playerId, won) => {
    try {
        let stats = await Leaderboard.findOne({ playerId });
        if (!stats) {
            stats = new Leaderboard({ playerId, playerName: 'Player' });
        }
        stats.gamesPlayed += 1;
        if (won) stats.wins += 1;
        else stats.losses += 1;

        const ratio = stats.wins / stats.gamesPlayed;
        if (ratio > 0.8 && stats.gamesPlayed > 5) {
            stats.currentLevel = Math.min(stats.currentLevel + 1, 4);
        } else if (ratio < 0.3 && stats.currentLevel > 0) {
            stats.currentLevel = stats.currentLevel - 1;
        }
        stats.lastGameDate = new Date();
        await stats.save();
    } catch (err) {
        console.error('Leaderboard update error:', err);
    }
};

// ===== makeRandomMove – UPDATED =====
const makeRandomMove = async roomId => {
    const { updateRoom, getRoom } = require('../services/roomService');
    const room = await getRoom(roomId);
    if (room.winner) return;

    if (room.rolledNumber === null) {
        room.rolledNumber = rollDice();
        sendToPlayersRolledNumber(room._id.toString(), room.rolledNumber);
    }

    const pawnsThatCanMove = room.getPawnsThatCanMove();
    if (pawnsThatCanMove.length > 0) {
        const currentPlayer = room.getCurrentlyMovingPlayer();
        let chosenPawn = null;

        // ===== FOR HUMANS (old random logic) – UNTOUCHED =====
        if (!currentPlayer.isBot) {
            chosenPawn = pawnsThatCanMove[Math.floor(Math.random() * pawnsThatCanMove.length)];
        } 
        // ===== FOR BOTS (new smart logic) =====
        else {
            const smartness = currentPlayer.botSmartness || 0.6;
            chosenPawn = getBestMove(room, pawnsThatCanMove, smartness);
        }

        if (chosenPawn) {
            room.movePawn(chosenPawn);
        }
    }

    room.changeMovingPlayer();
    const winner = room.getWinner();
    if (winner) {
        room.endGame(winner);
        sendWinner(room._id.toString(), winner);

        // Update leaderboard (only if it's a bot game)
        const player = room.players.find(p => !p.isBot);
        if (player && room.players.some(p => p.isBot)) {
            const won = winner === player.color;
            await updateLeaderboard(player.sessionID || 'anonymous', won);
        }
    }
    await updateRoom(room);
};

// ===== FIXED: isMoveValid =====
// 🔧 FIX: pehle sirf color + turn-ownership check hota tha — move actually legal hai
// ya nahi (pawn.canMove) ye kabhi check nahi hota tha. Ab server bhi verify karta hai,
// sirf frontend ke canPawnMove.js pe trust nahi karta.
const isMoveValid = (session, pawn, room) => {
    if (session.color !== pawn.color) return false;
    if (session.playerId !== room.getCurrentlyMovingPlayer()._id.toString()) return false;
    if (!room.rolledNumber) return false;
    if (!pawn.canMove(room.rolledNumber)) return false;
    return true;
};

module.exports = { rollDice, makeRandomMove, isMoveValid };
