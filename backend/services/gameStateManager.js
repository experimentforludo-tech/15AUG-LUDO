// ===== NEW FILE (Tier 2) =====
// In-memory authoritative game state.
// Har room ka live mongoose document RAM me rehta hai — koi bhi read/write DB round-trip
// ka wait nahi karta. DB sirf durability ke liye background me likhi jaati hai (persistenceQueue.js).
//
// Isse latency drastically kam hoti hai: pehle har dice-roll/move pe poora room object
// MongoDB me save hota tha, phir change-stream event aata tha, tab jaake broadcast hota tha.
// Ab move ke turant baad hi (same tick) broadcast ho jaata hai — DB save alag se, async, batched.

const Room = require('../models/room');

const rooms = new Map(); // roomId (string) -> mongoose Room document

const setRoomState = room => {
    rooms.set(room._id.toString(), room);
    return room;
};

const getRoomState = roomId => {
    return rooms.get(roomId.toString()) || null;
};

const deleteRoomState = roomId => {
    rooms.delete(roomId.toString());
};

const getAllRoomStates = () => {
    return Array.from(rooms.values());
};

// ===== HYDRATE =====
// Agar room memory me nahi hai (server abhi start hua ho, ya restart ke baad), DB se ek baar load
// karke memory me cache kar leta hai. Uske baad sab kuch memory se hi serve hota hai.
const hydrateFromDB = async roomId => {
    const existing = getRoomState(roomId);
    if (existing) return existing;

    const room = await Room.findOne({ _id: roomId }).exec();
    if (room) setRoomState(room);
    return room;
};

// ===== HYDRATE ALL (server boot pe, taaki restart ke baad bhi purane active rooms dikhein) =====
const hydrateAllFromDB = async () => {
    const activeRooms = await Room.find({ winner: null }).exec();
    activeRooms.forEach(setRoomState);
    console.log(`gameStateManager: ${activeRooms.length} active room(s) memory me load hue`);
};

module.exports = {
    setRoomState,
    getRoomState,
    deleteRoomState,
    getAllRoomStates,
    hydrateFromDB,
    hydrateAllFromDB,
};
