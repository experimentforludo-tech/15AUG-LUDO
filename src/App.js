import React, { useEffect, useState, createContext } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ReactLoading from 'react-loading';
import Gameboard from './components/Gameboard/Gameboard';
import LoginPage from './components/LoginPage/LoginPage';
import LandingPage from './components/LandingPage/LandingPage';

export const PlayerDataContext = createContext();
export const SocketContext = createContext();

function AppRoutes({ playerSocket, connectionStatus, isTimedOut, onRetry }) {
    const [playerData, setPlayerData] = useState();
    const navigate = useNavigate();

    useEffect(() => {
        if (!playerSocket) return;

        const handlePlayerData = (data) => {
            console.log('📥 player:data received:', data);
            data = JSON.parse(data);
            setPlayerData(data);

            if (data.roomId != null) {
                console.log('➡️ Navigating to /game');
                navigate('/game');
            }
        };

        playerSocket.on('player:data', handlePlayerData);

        return () => {
            playerSocket.off('player:data', handlePlayerData);
        };
    }, [playerSocket, navigate]);

    const connectingScreen = (
        <div className="connecting-screen">
            {isTimedOut ? (
                <>
                    <p className="connecting-status connecting-status--error">
                        ⚠️ Connection is taking longer than usual
                    </p>
                    <button className="connecting-retry-btn" onClick={onRetry}>
                        Retry Connection
                    </button>
                </>
            ) : (
                <>
                    <div className="connecting-spinner-box">
                        <ReactLoading type="spinningBubbles" color="white" height={80} width={80} />
                    </div>
                    <p className="connecting-status">{connectionStatus}</p>
                </>
            )}
        </div>
    );

    return (
        <Routes>
            {/* ===== LANDING PAGE ===== */}
            <Route path="/" element={<LandingPage />} />

            {/* ===== LOGIN PAGE ===== */}
            <Route
                path="/login"
                element={playerSocket ? <LoginPage /> : connectingScreen}
            />

            {/* ===== GAME PAGE ===== */}
            <Route
                path="/game"
                element={
                    playerData ? (
                        <PlayerDataContext.Provider value={playerData}>
                            <Gameboard />
                        </PlayerDataContext.Provider>
                    ) : (
                        <Navigate to="/login" />
                    )
                }
            />
        </Routes>
    );
}

function App() {
    const [playerSocket, setPlayerSocket] = useState();
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [isTimedOut, setIsTimedOut] = useState(false);
    const [connectionAttempt, setConnectionAttempt] = useState(0);

    useEffect(() => {
        const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        console.log('🔗 Connecting to:', BACKEND_URL);

        setIsTimedOut(false);
        setPlayerSocket(undefined);

        const socket = io(BACKEND_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            timeout: 10000
        });

        // 👇 Agar 12 second me connect nahi hua toh "stuck spinner" ki jagah
        // Retry button dikhao — infinite spinning se user ko bacha ke
        const stuckTimer = setTimeout(() => {
            setIsTimedOut(prevSocketConnected => {
                return !socket.connected;
            });
        }, 12000);

        socket.on('connect', () => {
            console.log('✅ Socket connected!');
            setConnectionStatus('✅ Connected to: ' + BACKEND_URL);
            setIsTimedOut(false);
            clearTimeout(stuckTimer);
            setPlayerSocket(socket);
        });

        socket.on('connect_error', (err) => {
            console.error('❌ Socket connection error:', err);
            setConnectionStatus('❌ Error: ' + err.message);
        });

        socket.on('disconnect', () => {
            console.log('⚠️ Socket disconnected');
            setConnectionStatus('⚠️ Disconnected');
        });

        return () => {
            clearTimeout(stuckTimer);
            socket.disconnect();
        };
    }, [connectionAttempt]);

    const handleRetry = () => {
        console.log('🔄 Retrying connection...');
        setConnectionStatus('Connecting...');
        setConnectionAttempt(prev => prev + 1);
    };

    return (
        <SocketContext.Provider value={playerSocket}>
            <Router>
                <AppRoutes
                    playerSocket={playerSocket}
                    connectionStatus={connectionStatus}
                    isTimedOut={isTimedOut}
                    onRetry={handleRetry}
                />
            </Router>
        </SocketContext.Provider>
    );
}

export default App;
