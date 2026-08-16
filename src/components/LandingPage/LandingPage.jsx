import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocketContext } from '../../App';
import './LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const socket = useContext(SocketContext);
    const [joiningBot, setJoiningBot] = useState(false);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [botPlayerName, setBotPlayerName] = useState('');

    useEffect(() => {
        if (socket) {
            console.log('✅ Socket available in LandingPage');
            socket.on('connect', () => console.log('✅ Socket connected!'));
            socket.on('connect_error', (err) => console.error('❌ Socket error:', err));
        } else {
            console.warn('⚠️ Socket not available in LandingPage');
        }
    }, [socket]);

    const handlePlayWithFriends = () => {
        console.log('🔘 Play with Friends clicked');
        navigate('/login');
    };

    const handleFreePlay = () => {
        console.log('🔘 Free Play clicked');
        if (!socket) {
            console.error('❌ Socket not available!');
            alert('Backend not connected! Please refresh and try again.');
            return;
        }
        setShowNamePrompt(true);
    };

    const startBotGame = () => {
        const finalName = botPlayerName.trim() || 'You';
        console.log('📤 Emitting player:bot with name:', finalName);
        setJoiningBot(true);
        setShowNamePrompt(false);
        socket.emit('player:bot', { name: finalName });
    };

    return (
        <div className="landing-wrapper">
            <div className="frame-corner tl"></div>
            <div className="frame-corner tr"></div>
            <div className="frame-corner bl"></div>
            <div className="frame-corner br"></div>
            <div className="hud-status">
                <span className="dot"></span>
                Network Live
            </div>

            <div className="stack">
                <div className="card card--cyan" tabIndex="0">
                    <span className="tag tag--cyan">Hot</span>
                    <div className="eyebrow">Featured Room</div>
                    <div className="title-cyan">ludo king</div>
                    <div className="subtitle-cyan">premium</div>
                    <div className="divider"></div>
                    <div className="credit">@powered by Creative Mind 😁</div>
                </div>

                {/* ===== FREE PLAY (BOT) — jaisa tha waisa hi ===== */}
                <div
                    className="card card--purple"
                    tabIndex="0"
                    onClick={joiningBot ? undefined : handleFreePlay}
                    style={{ cursor: joiningBot ? 'default' : 'pointer', opacity: joiningBot ? 0.6 : 1 }}
                >
                    <span className="tag tag--purple">No Entry Fee</span>
                    <div className="row-purple">
                        <div className="title-purple">
                            {joiningBot ? 'joining...' : 'free play'}
                        </div>
                    </div>
                    <div className="sub-purple">Practice Mode · Unlimited</div>
                </div>

                {/* ===== PLAY WITH FRIENDS (MULTIPLAYER) ===== */}
                <div
                    className="card card--green"
                    tabIndex="0"
                    onClick={handlePlayWithFriends}
                    style={{ cursor: 'pointer' }}
                >
                    <span className="tag tag--green">Multiplayer</span>
                    <div className="title-green">
                        <span className="ico">▶</span>play with friends
                    </div>
                    <div className="sub-green">Create · Invite · Battle</div>
                </div>
            </div>

            {/* ===== Name prompt before starting Bot game ===== */}
            {showNamePrompt && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '20px',
                        boxSizing: 'border-box',
                    }}
                >
                    <div
                        style={{
                            background: '#0a1747',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '12px',
                            padding: '24px',
                            width: '100%',
                            maxWidth: '320px',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ color: 'white', marginBottom: '16px', fontSize: '15px' }}>
                            Apna naam batao 👇
                        </p>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={botPlayerName}
                            onChange={e => setBotPlayerName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && startBotGame()}
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #ccc',
                                marginBottom: '16px',
                                boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button
                                onClick={() => setShowNamePrompt(false)}
                                style={{ background: 'rgba(255,255,255,0.1)' }}
                            >
                                Cancel
                            </button>
                            <button onClick={startBotGame}>Start Game</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;
