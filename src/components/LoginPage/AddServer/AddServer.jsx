import React, { useState, useContext, useEffect } from 'react';
import Switch from '@mui/material/Switch';
import { SocketContext } from '../../../App';
import WindowLayout from '../WindowLayout/WindowLayout';
import useInput from '../../../hooks/useInput';
import styles from './AddServer.module.css';

const AddServer = () => {
    const socket = useContext(SocketContext);
    const [isPrivate, setIsPrivate] = useState(false);
    const [isIncorrect, setIsIncorrect] = useState(false);
    const serverName = useInput('');
    const password = useInput('');
    
    // ===== DEBUG STATE =====
    const [debugLogs, setDebugLogs] = useState([]);
    const [socketStatus, setSocketStatus] = useState('Checking...');

    const addDebugLog = (message, isError = false) => {
        const timestamp = new Date().toLocaleTimeString();
        setDebugLogs(prev => [...prev, { time: timestamp, message, isError }]);
    };

    useEffect(() => {
        if (socket) {
            setSocketStatus('✅ Connected');
            addDebugLog('Socket connected successfully');
            
            socket.on('connect_error', (err) => {
                setSocketStatus('❌ Error');
                addDebugLog(`Socket error: ${err.message}`, true);
            });
            
            socket.on('connect', () => {
                setSocketStatus('✅ Connected');
                addDebugLog('Socket reconnected');
            });
            
            socket.on('room:create', (data) => {
                addDebugLog(`Room created: ${JSON.stringify(data)}`);
            });
            
            // Error listeners
            socket.on('error:changeRoom', () => {
                addDebugLog('❌ Error: Room full or started', true);
            });
            
            socket.on('error:wrongPassword', () => {
                addDebugLog('❌ Error: Wrong password', true);
            });
        } else {
            setSocketStatus('❌ No socket');
            addDebugLog('Socket not available', true);
        }
        
        return () => {
            socket?.off('connect_error');
            socket?.off('connect');
            socket?.off('room:create');
            socket?.off('error:changeRoom');
            socket?.off('error:wrongPassword');
        };
    }, [socket]);

    const handleButtonClick = e => {
        e.preventDefault();
        addDebugLog(`🔘 Host button clicked: "${serverName.value}"`);
        
        if (!serverName.value) {
            setIsIncorrect(true);
            addDebugLog('❌ Server name is empty', true);
            return;
        }
        
        const data = {
            name: serverName.value,
            password: password.value,
            private: isPrivate,
        };
        addDebugLog(`📤 Emitting 'room:create': ${JSON.stringify(data)}`);
        
        if (!socket) {
            addDebugLog('❌ Socket is null!', true);
            return;
        }
        
        socket.emit('room:create', data);
        addDebugLog(`✅ 'room:create' emitted successfully`);
    };

    return (
        <>
            <WindowLayout
                title='Host A Server'
                content={
                    <form className={styles.formContainer} onSubmit={e => e.preventDefault()}>
                        <input
                            type='text'
                            placeholder='Server Name'
                            {...serverName}
                            style={{
                                border: isIncorrect ? '1px solid red' : '1px solid white',
                            }}
                        />
                        <div className={styles.privateContainer}>
                            <label>Private</label>
                            <Switch checked={isPrivate} color='primary' onChange={() => setIsPrivate(!isPrivate)} />
                        </div>
                        <input type='text' placeholder='password' disabled={!isPrivate} {...password} />
                        <button onClick={handleButtonClick}>Host</button>
                        
                        {/* ===== DEBUG PANEL ===== */}
                        <div style={{
                            marginTop: '20px',
                            padding: '10px',
                            background: 'rgba(0,0,0,0.7)',
                            borderRadius: '8px',
                            width: '100%',
                            maxHeight: '200px',
                            overflow: 'auto',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: '#0f0',
                            border: '1px solid #333',
                            textAlign: 'left'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span style={{ fontWeight: 'bold', color: '#fff' }}>🔍 DEBUG</span>
                                <span style={{ color: socketStatus.includes('✅') ? '#0f0' : '#f00' }}>{socketStatus}</span>
                            </div>
                            <div style={{ borderTop: '1px solid #333', paddingTop: '5px' }}>
                                {debugLogs.length === 0 ? (
                                    <span style={{ color: '#888' }}>Waiting for activity...</span>
                                ) : (
                                    debugLogs.map((log, i) => (
                                        <div key={i} style={{ color: log.isError ? '#f44' : '#0f0' }}>
                                            <span style={{ color: '#666' }}>[{log.time}]</span> {log.message}
                                        </div>
                                    ))
                                )}
                            </div>
                            <button 
                                onClick={() => setDebugLogs([])}
                                style={{
                                    marginTop: '5px',
                                    padding: '2px 10px',
                                    fontSize: '10px',
                                    background: '#444',
                                    border: 'none',
                                    color: '#fff',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear Logs
                            </button>
                        </div>
                    </form>
                }
            />
        </>
    );
};

export default AddServer;