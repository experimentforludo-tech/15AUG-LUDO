import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocketContext } from '../../App';
import './LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const socket = useContext(SocketContext);
    const [joiningBot, setJoiningBot] = useState(false);

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
        if (socket) {
            console.log('📤 Emitting player:bot...');
            setJoiningBot(true);
            socket.emit('player:bot');
            // Navigation ab yahan manually nahi karni — App.js ka global
            // 'player:data' listener roomId aate hi khud /game pe le jayega
        } else {
            console.error('❌ Socket not available!');
            alert('Backend not connected! Please refresh and try again.');
        }
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

                {/* ===== FREE PLAY (BOT) ===== */}
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
        </div>
    );
};

export default LandingPage;
