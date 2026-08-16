import React, { useContext, useEffect, useRef, useState } from 'react';
import { SocketContext } from '../../../App';
import images from '../../../constants/diceImages';
import styles from './Dice.module.css';

const MIN_ROLL_ANIMATION_MS = 700; // 👈 rolling.gif kam se kam itni der dikhegi, chahe server number turant bhej de

const Dice = ({ rolledNumber, nowMoving, playerColor, movingPlayer }) => {
    const socket = useContext(SocketContext);
    const [isRolling, setIsRolling] = useState(false);
    const rollStartRef = useRef(0);

    const isCurrentPlayer = movingPlayer === playerColor;
    const hasRolledNumber = rolledNumber !== null && rolledNumber !== undefined;

    const handleClick = () => {
        setIsRolling(true); // 🔧 FIX: click hote hi rolling.gif turant dikhna shuru
        rollStartRef.current = Date.now();
        socket.emit('game:roll');
    };

    // 🔧 FIX: yehi missing piece tha — pehle rolledNumber aate hi seedha number
    // dikh jaata tha, rolling.gif ke liye koi wait/state nahi thi. Ab kam se kam
    // MIN_ROLL_ANIMATION_MS tak rolling dikhegi, uske baad number.
    useEffect(() => {
        if (!hasRolledNumber || !isRolling) return;
        const elapsed = Date.now() - rollStartRef.current;
        const remaining = Math.max(0, MIN_ROLL_ANIMATION_MS - elapsed);
        const timer = setTimeout(() => setIsRolling(false), remaining);
        return () => clearTimeout(timer);
    }, [hasRolledNumber, rolledNumber, isRolling]);

    // Turn khatam/change hone pe rolling state reset (agli baar clean start ho)
    useEffect(() => {
        if (!isCurrentPlayer || !nowMoving) {
            setIsRolling(false);
        }
    }, [isCurrentPlayer, nowMoving]);

    return (
        <div className={styles.container}>
            {isCurrentPlayer ? (
                isRolling ? (
                    <img src={images[7]} className='rolling' alt='rolling' />
                ) : hasRolledNumber ? (
                    <img src={images[rolledNumber - 1]} alt={rolledNumber} />
                ) : nowMoving ? (
                    <img src={images[6]} className='roll' alt='roll' onClick={handleClick} />
                ) : null
            ) : null}
        </div>
    );
};

export default Dice;
