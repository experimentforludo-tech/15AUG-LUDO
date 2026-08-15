const socketManager = require('../socket/socketManager');
const registerPlayerHandlers = require('../handlers/playerHandler');
const registerRoomHandlers = require('../handlers/roomHandler');
const registerGameHandlers = require('../handlers/gameHandler');
const { sessionMiddleware, wrap } = require('../config/session');
const { hydrateAllFromDB } = require('../services/gameStateManager');
const persistenceQueue = require('../services/persistenceQueue');

module.exports = function (server) {
    socketManager.initialize(server);
    socketManager.getIO().engine.on('initial_headers', (headers, req) => {
        if (req.cookieHolder) {
            headers['set-cookie'] = req.cookieHolder;
            delete req.cookieHolder;
        }
    });
    socketManager.getIO().use(wrap(sessionMiddleware));
    socketManager.getIO().on('connection', socket => {
        registerPlayerHandlers(socket);
        registerRoomHandlers(socket);
        registerGameHandlers(socket);
        if (socket.request.session.roomId) {
            const roomId = socket.request.session.roomId.toString();
            socket.join(roomId);
            socket.emit('player:data', JSON.stringify(socket.request.session));
        }
    });

    // ===== NEW (Tier 2): in-memory state boot-up aur background persistence =====
    // Server start hote hi jo active rooms DB me pade hain unhe memory me le aao
    // (taaki restart ke baad bhi chalu games khatam na ho jaayein), phir write-behind
    // persistence queue chaalu karo.
    hydrateAllFromDB()
        .then(() => persistenceQueue.start())
        .catch(err => console.error('gameStateManager hydrate error:', err));

    // ===== NEW: graceful shutdown — memory me pending changes DB me flush karke exit =====
    const gracefulShutdown = async signal => {
        console.log(`${signal} mila — pending room state flush kar raha hoon...`);
        persistenceQueue.stop();
        await persistenceQueue.flushAll();
        process.exit(0);
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};
