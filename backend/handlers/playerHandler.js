const { getRoom, updateRoom, createNewRoom } = require('../services/roomService');
const { COLORS } = require('../utils/constants');
const { getBotName, getBotLevel, getBotSmartness } = require('../models/botManager');
const Leaderboard = require('../models/leaderboard');

module.exports = socket => {
    const req = socket.request;

    // ===== EXISTING: handleLogin (UNCHANGED) =====
    const handleLogin = async data => {
        const room = await getRoom(data.roomId);
        if (room.isFull()) return socket.emit('error:changeRoom');
        if (room.started) return socket.emit('error:changeRoom');
        if (room.private && room.password !== data.password) return socket.emit('error:wrongPassword');
        addPlayerToExistingRoom(room, data);
    };

    // ===== NEW: Bot mode =====
    const handleBotLogin = async () => {
        // Get or create player stats
        let stats = await Leaderboard.findOne({ playerId: req.session.id });
        if (!stats) {
            stats = new Leaderboard({
                playerId: req.session.id,
                playerName: 'Player'
            });
            await stats.save();
        }

        const botName = getBotName();
        const level = getBotLevel(stats);
        const smartness = getBotSmartness(level);
        const levelNames = ['Easy', 'Medium', 'Hard', 'Hard+', 'Legendary'];
        const displayName = `${botName} (${levelNames[level]})`;

        const roomData = {
            name: `vs ${botName}`,
            private: false,
            password: '',
            players: [],
            started: false,
            full: false,
            maxPlayers: 2
        };
        const room = await createNewRoom(roomData);

        // Player (user) — COLORS[0] = 'red'
        // 🔧 FIX: req.session.id ab pass ho raha hai taaki player.sessionID set ho
        // (isse leaderboard update sahi player ke record ko target karega, 'anonymous' ko nahi)
        room.addPlayer('You', req.session.id);

        // Bot player
        // 👇 CRITICAL FIX: COLORS order hai ['red','blue','green','yellow']
        // Human 'red' (COLORS[0]) pe hai, uska diagonal-opposite corner 'green' (COLORS[2]) hai — blue (COLORS[1]) nahi
        const botPlayer = {
            sessionID: 'bot',
            name: displayName,
            color: COLORS[2],
            ready: true,
            nowMoving: false,
            isBot: true,
            botLevel: level,
            botSmartness: smartness
        };
        room.players.push(botPlayer);

        room.full = true;
        room.started = true;
        room.players[0].ready = true;
        room.players[0].nowMoving = true;
        room.players[1].ready = true;

        // Store stats ID for later update
        req.session._statsId = stats._id;

        await updateRoom(room);

        req.session.reload(err => {
            if (err) return socket.disconnect();
            req.session.roomId = room._id.toString();
            req.session.playerId = room.players[0]._id.toString();
            req.session.color = COLORS[0];
            req.session.save();
            socket.join(room._id.toString());
            socket.emit('player:data', JSON.stringify(req.session));
        });
    };
    // ============================

    // ===== EXISTING: handleExit (UNCHANGED) =====
    const handleExit = async () => {
        req.session.reload(err => {
            if (err) return socket.disconnect();
            req.session.destroy();
            socket.emit('redirect');
        });
    };

    // ===== EXISTING: handleReady (UNCHANGED) =====
    const handleReady = async () => {
        const room = await getRoom(req.session.roomId);
        room.getPlayer(req.session.playerId).changeReadyStatus();
        if (room.canStartGame()) {
            room.startGame();
        }
        await updateRoom(room);
    };

    // ===== FIXED: addPlayerToExistingRoom =====
    // 🔧 FIX: req.session.id ab addPlayer ko pass ho raha hai (pehle sessionID hamesha undefined rehta tha)
    const addPlayerToExistingRoom = async (room, data) => {
        room.addPlayer(data.name, req.session.id);
        if (room.isFull()) {
            room.startGame();
        }
        await updateRoom(room);
        reloadSession(room);
    };

    // ===== FIXED: reloadSession =====
    // 🔧 FIX: pehle `COLORS[room.players.length - 1]` use hota tha, jo sirf 4-player
    // rooms (sequential red/blue/green/yellow) ke liye sahi tha. 2-player rooms me
    // room.addPlayer() color [red, green] assign karta hai, isliye ab hum wahi color
    // seedha newly-added player object se read kar rahe hain — koi index-guessing nahi.
    const reloadSession = room => {
        req.session.reload(err => {
            if (err) return socket.disconnect();
            const newPlayer = room.players[room.players.length - 1];
            req.session.roomId = room._id.toString();
            req.session.playerId = newPlayer._id.toString();
            req.session.color = newPlayer.color;
            req.session.save();
            socket.join(room._id.toString());
            socket.emit('player:data', JSON.stringify(req.session));
        });
    };

    // ===== SOCKET EVENTS =====
    socket.on('player:login', handleLogin);
    socket.on('player:bot', handleBotLogin);   // 👈 NEW
    socket.on('player:ready', handleReady);
    socket.on('player:exit', handleExit);
};
