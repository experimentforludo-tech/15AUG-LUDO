import React from 'react';
import Dice from './Dice/Dice';
import NameContainer from './NameContainer/NameContainer';
import ReadyButton from './ReadyButton/ReadyButton';
import { useContext } from 'react';
import { PlayerDataContext } from '../../App';
import styles from './Navbar.module.css';

const Navbar = ({ players, started, time, isReady, rolledNumber, nowMoving, movingPlayer, ended }) => {
    const context = useContext(PlayerDataContext);

    const diceProps = {
        rolledNumber,
        nowMoving,
        movingPlayer,
    };

    return (
        <>
            {players.map((player, index) => (
                <div
                    className={`${styles.playerContainer} ${player.color ? styles[player.color] : ''}`}
                    key={index}
                >
                    <NameContainer player={player} time={time} />
                    {started && !ended && player.color ? (
                        <Dice playerColor={player.color} {...diceProps} />
                    ) : null}
                    {context.color === player.color && !started ? <ReadyButton isReady={isReady} /> : null}
                </div>
            ))}
        </>
    );
};

export default Navbar;
