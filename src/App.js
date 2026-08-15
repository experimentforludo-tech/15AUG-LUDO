import React, { useEffect, useState, createContext } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ReactLoading from 'react-loading';
import Gameboard from './components/Gameboard/Gameboard';
import LoginPage from './components/LoginPage/LoginPage';
import LandingPage from './components/LandingPage/LandingPage';

export const PlayerDataContext = createContext();
export const SocketContext = createContext();

function App() {
    const [playerData, setPlayerData] = useState();
    const [playerSocket, setPlayerSocket] = useState();
    const [redirect, setRedirect] = useState(false);
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

        socket.on('player:data', data => {
            console.log('📥 player:data received:', data);
            data = JSON.parse(data);
            setPlayerData(data);
            if (data.roomId != null) {
                setRedirect(true);
            }
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
                <Routes>
                    <Route path="/" element={<LandingPage />} />

                    <Route
                        path="/login"
                        element={
                            // ⚠️ CRITICAL FIX: Agar redirect true hai toh game pe bhejo, warna login page
                            redirect ? 
                            <Navigate to="/game" /> : 
                            playerSocket ? 
                            <LoginPage setRedirect={setRedirect} /> : 
                            (
                                <div style={{ textAlign: 'center', color: 'white' }}>
                                    <ReactLoading type='spinningBubbles' color='white' height={100} width={100} />
                                    <p style={{ marginTop: '20px', fontFamily: 'monospace' }}>{connectionStatus}</p>
                                </div>
                            )
                        }
                    />

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
            </Router>
        </SocketContext.Provider>
    );
}

export default App;