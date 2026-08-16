const { getRoom, getRooms, updateRoom, createNewRoom, removeRoom } = require('../services/roomService');
const { sendToOnePlayerRooms, sendToOnePlayerData, sendWinner } = require('../socket/emits');
const { LOBBY_CLEANUP_TIME } = require('../utils/constants');
const lobbyCleanupManager = require('../models/lobbyCleanupManager');

module.exports = socket => {
    const req = socket.request;

    const handleGetData = async () => {
        const room = await getRoom(req.session.roomId);
        if (room.nextMoveTime <= Date.now()) {
            room.changeMovingPlayer();
            await updateRoom(room);
        }
        sendToOnePlayerData(socket.id, room);
        if (room.winner) sendWinner(socket.id, room.winner);
    };

    const handleGetAllRooms = async () => {
        const rooms = await getRooms();
        sendToOnePlayerRooms(socket.id, rooms);
    };

    const handleCreateRoom = async data => {
        const allowedCounts = [2, 4];
        const maxPlayers = allowedCounts.includes(Number(data.maxPlayers)) ? Number(data.maxPlayers) : 4;

        const roomData = {
            ...data,
            maxPlayers,
        };

        const room = await createNewRoom(roomData);

        // ===== NEW: 30-min auto-delete agar room start nahi hota =====
        // (khaali seat, ya sirf host akela — dono cases me room.started hamesha false rahega,
        // startGame() sirf canStartGame() [>=2 ready players] pe hi call hota hai)
        scheduleLobbyCleanup(room._id.toString());

        sendToOnePlayerRooms(socket.id, await getRooms());
    };

    // ===== NEW: cleanup scheduler =====
    const scheduleLobbyCleanup = roomId => {
        lobbyCleanupManager.set(roomId, async id => {
            const room = await getRoom(id);
            // Room already delete ho chuki, ya already start ho chuki (real game chal rahi hai) — kuch mat karo
            if (!room || room.started) return;
            await removeRoom(id);
        }, LOBBY_CLEANUP_TIME);
    };

    socket.on('room:data', handleGetData);
    socket.on('room:rooms', handleGetAllRooms);
    socket.on('room:create', handleCreateRoom);
};
