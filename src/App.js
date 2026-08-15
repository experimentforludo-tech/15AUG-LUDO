import React, { useEffect, useState, createContext } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ReactLoading from 'react-loading';
import Gameboard from './components/Gameboard/Gameboard';
import LoginPage from './components/LoginPage/LoginPage';
import LandingPage from './components/LandingPage/LandingPage';

export const PlayerDataContext = createContext();
export const SocketContext = createContext();

// 👇 Router ke andar rehta hai isliye useNavigate use kar sakta hai
function AppRoutes({ playerSocket, connectionStatus }) {
    const [playerData, setPlayerData] = useState();
    const navigate = useNavigate();

    useEffect(() => {
        if (!playerSocket) return;

        const handlePlayerData = (data) => {
            console.log('📥 player:data received:', data);
            data = JSON.parse(data);
            setPlayerData(data);

            // 👇 CRITICAL FIX: chahe user kisi bhi page pe ho (landing/login),
            // roomId aate hi seedha /game pe navigate — koi stale flag nahi
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

    return (
        <Routes>
            {/* ===== LANDING PAGE ===== */}
            <Route path="/" element={<LandingPage />} />

            {/* ===== LOGIN PAGE ===== */}
            <Route
                path="/login"
                element={
                    playerSocket ? (
                        <LoginPage />
                    ) : (
                        <div style={{ textAlign: 'center', color: 'white' }}>
                            <ReactLoading type='spinningBubbles' color='white' height={100} width={100} />
                            <p style={{ marginTop: '20px', fontFamily: 'monospace' }}>{connectionStatus}</p>
                        </div>
                    )
                }
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

    useEffect(() => {
        const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        console.log('🔗 Connecting to:', BACKEND_URL);

        const socket = io(BACKEND_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            timeout: 10000
        });

        socket.on('connect', () => {
            console.log('✅ Socket connected!');
            setConnectionStatus('✅ Connected to: ' + BACKEND_URL);
        });

        socket.on('connect_error', (err) => {
            console.error('❌ Socket connection error:', err);
            setConnectionStatus('❌ Error: ' + err.message);
        });

        socket.on('disconnect', () => {
            console.log('⚠️ Socket disconnected');
            setConnectionStatus('⚠️ Disconnected');
        });

        setPlayerSocket(socket);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'socket-status';
        statusDiv.style.cssText = `
            position: fixed; bottom: 10px; left: 10px; right: 10px;
            background: rgba(0,0,0,0.8); color: #0f0; padding: 8px 12px;
            border-radius: 8px; font-size: 11px; font-family: monospace;
            z-index: 9999; text-align: center; border: 1px solid #333;
        `;
        statusDiv.textContent = '🔌 Connecting...';
        document.body.appendChild(statusDiv);

        socket.on('connect', () => {
            statusDiv.textContent = '✅ Backend Connected!';
            statusDiv.style.color = '#0f0';
        });

        socket.on('connect_error', (err) => {
            statusDiv.textContent = '❌ Connection Failed: ' + err.message;
            statusDiv.style.color = '#f44';
        });

        return () => {
            socket.disconnect();
            const el = document.getElementById('socket-status');
            if (el) el.remove();
        };
    }, []);

    return (
        <SocketContext.Provider value={playerSocket}>
            <Router>
                <AppRoutes playerSocket={playerSocket} connectionStatus={connectionStatus} />
            </Router>
        </SocketContext.Provider>
    );
}

export default App;
