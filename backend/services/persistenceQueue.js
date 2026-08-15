// ===== NEW FILE (Tier 2) =====
// Write-behind persistence: gameStateManager ke in-memory rooms ko background me,
// batched interval pe, MongoDB me async save karta hai — real-time path (move/roll/broadcast)
// isse kabhi block nahi hota.

const { getRoomState } = require('./gameStateManager');

const FLUSH_INTERVAL_MS = 2000; // har 2 second me dirty rooms save honge
const dirtyRoomIds = new Set();
let intervalHandle = null;

const markDirty = roomId => {
    dirtyRoomIds.add(roomId.toString());
};

// ===== FLUSH ONE ROOM IMMEDIATELY =====
// Critical moments (game khatam, room delete) pe turant save karne ke liye —
// interval ka wait nahi karna taaki data loss na ho.
const flushRoom = async roomId => {
    const id = roomId.toString();
    const room = getRoomState(id);
    if (!room) {
        dirtyRoomIds.delete(id);
        return;
    }
    try {
        await room.save();
        dirtyRoomIds.delete(id);
    } catch (err) {
        console.error(`persistenceQueue: room ${id} save fail hui:`, err.message);
        // dirty hi rehne do — agla flush cycle retry karega
    }
};

// ===== FLUSH ALL DIRTY ROOMS =====
const flushAll = async () => {
    const ids = Array.from(dirtyRoomIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map(flushRoom));
};

// ===== START/STOP INTERVAL =====
const start = () => {
    if (intervalHandle) return; // already running
    intervalHandle = setInterval(() => {
        flushAll().catch(err => console.error('persistenceQueue flush error:', err));
    }, FLUSH_INTERVAL_MS);
};

const stop = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
};

module.exports = { markDirty, flushRoom, flushAll, start, stop };
