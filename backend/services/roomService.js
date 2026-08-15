// ===== REWRITTEN (Tier 2) =====
// Pehle: har getRoom/updateRoom call MongoDB tak jaati thi (network round-trip), aur
// broadcast Room.watch() change-stream ke bharose hota tha (jise replica-set chahiye
// aur jo apne aap me ek extra async hop tha).
//
// Ab: state gameStateManager (RAM) me rehta hai. getRoom/updateRoom turant resolve hote hain,
// DB save persistenceQueue background me async karta hai, aur broadcast turant (same tick) hota hai.
// Baaki poore codebase (handlers) ko is change ka pata bhi nahi chalega — function signatures same hain.

const Room = require('../models/room');
const { sendToPlayersDataIfChanged } = require('../socket/emits');
const {
    setRoomState,
    getRoomState,
    getAllRoomStates,
    hydrateFromDB,
    deleteRoomState,
} = require('./gameStateManager');
const persistenceQueue = require('./persistenceQueue');

// ===== GET ROOM =====
// Memory se turant milta hai; sirf pehli baar (cold start / restart ke baad) DB se hydrate karta hai.
const getRoom = async roomId => {
    const cached = getRoomState(roomId);
    if (cached) return cached;
    return await hydrateFromDB(roomId);
};

// ===== GET ROOMS (lobby listing) =====
// Ab DB query nahi — jitne bhi rooms memory me active hain, unhi ki list milti hai.
const getRooms = async () => {
    return getAllRoomStates();
};

// ===== UPDATE ROOM =====
// Room state ab already memory me mutate ho chuka hota hai (schema methods room object ko
// in-place badalte hain). Yahan bas: (1) memory me confirm-set, (2) async save queue me daalna,
// (3) turant players ko naya state bhejna — teeno kaam DB write ka wait kiye bina.
const updateRoom = async room => {
    setRoomState(room);
    persistenceQueue.markDirty(room._id);
    sendToPlayersDataIfChanged(room);
    return room;
};

// ===== GET JOINABLE ROOM =====
const getJoinableRoom = async () => {
    return getAllRoomStates().find(room => !room.full && !room.started) || null;
};

// ===== CREATE NEW ROOM =====
// 🔧 FIX: room ab turant memory me available hai — player ko room-create ke baad DB write
// ka wait nahi karna padta. Actual DB insert background me persistenceQueue karta hai.
const createNewRoom = async data => {
    const room = new Room(data);
    setRoomState(room);
    persistenceQueue.markDirty(room._id);
    return room;
};

// ===== NEW: REMOVE ROOM (khaali/finished room cleanup ke liye) =====
const removeRoom = async roomId => {
    await persistenceQueue.flushRoom(roomId); // pehle final state save karo
    deleteRoomState(roomId);
    await Room.deleteOne({ _id: roomId }).exec();
};

module.exports = { getRoom, getRooms, updateRoom, getJoinableRoom, createNewRoom, removeRoom };
