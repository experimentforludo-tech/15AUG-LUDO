// ===== NEW: LOBBY CLEANUP MANAGER =====
// Room-create ke baad 30-min ka "agar abhi tak game start nahi hua to room delete kardo" timer.
// timeoutManager.js se alag rakha hai kyunki wo game-move-timeouts ke liye roomId key use karta hai —
// isi key pe lobby-cleanup timer daalne se dono ek dusre ko overwrite kar dete (collision).
const lobbyCleanupManager = {
    timeouts: new Map(),
    set: function (roomId, callback, delay) {
        this.clear(roomId);
        const timeoutId = setTimeout(() => {
            this.timeouts.delete(roomId);
            callback(roomId);
        }, delay);
        this.timeouts.set(roomId, timeoutId);
    },
    clear: function (roomId) {
        const existing = this.timeouts.get(roomId);
        if (existing) clearTimeout(existing);
        this.timeouts.delete(roomId);
    },
};

module.exports = lobbyCleanupManager;
