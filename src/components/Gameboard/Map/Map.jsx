import React, { useEffect, useRef, useState, useContext } from 'react';
import { PlayerDataContext, SocketContext } from '../../../App';

import mapImage from '../../../images/map.jpg';
import positionMapCoords from '../positions';
import pawnImages from '../../../constants/pawnImages';
import canPawnMove from './canPawnMove';
import getPositionAfterMove from './getPositionAfterMove';

const NATIVE_SIZE = 460; // 👈 canvas internal drawing resolution — kabhi mat badalna, sab coordinates isi pe calibrated hain
const MIN_PADDING = 15; // 👈 board ke chaaro taraf minimum gap (px)
const RESERVED_FOR_NAVBAR = 190; // 👈 top+bottom navbar (name boxes + dice) ke liye approx space

const Map = ({ pawns, nowMoving, rolledNumber }) => {
    const player = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);
    const canvasRef = useRef(null);

    const [hintPawn, setHintPawn] = useState();

    // ===== NEW: Responsive board size (device ke hisaab se) =====
    const [boardSize, setBoardSize] = useState(NATIVE_SIZE);

    useEffect(() => {
        const computeBoardSize = () => {
            const maxWidth = window.innerWidth - MIN_PADDING * 2;
            const maxHeight = window.innerHeight - RESERVED_FOR_NAVBAR - MIN_PADDING * 2;
            // Chhoti screen pe shrink karo, bada screen pe native size (460) se zyada mat karo — blur na ho
            const size = Math.max(220, Math.min(maxWidth, maxHeight, NATIVE_SIZE));
            setBoardSize(size);
        };

        computeBoardSize();
        window.addEventListener('resize', computeBoardSize);
        window.addEventListener('orientationchange', computeBoardSize);

        return () => {
            window.removeEventListener('resize', computeBoardSize);
            window.removeEventListener('orientationchange', computeBoardSize);
        };
    }, []);

    const paintPawn = (context, pawn) => {
        const { x, y } = positionMapCoords[pawn.position];
        const touchableArea = new Path2D();
        touchableArea.arc(x, y, 12, 0, 2 * Math.PI);
        const image = new Image();
        image.src = pawnImages[pawn.color];
        image.onload = function () {
            context.drawImage(image, x - 17, y - 15, 35, 30);
        };
        return touchableArea;
    };

    // 👇 CRITICAL FIX: cursor coordinates ko canvas ke internal resolution
    // (460x460) ke hisaab se scale karna zaroori hai, kyunki ab display size
    // (boardSize) aur internal resolution alag ho sakte hain
    const getScaledCoords = event => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };
    };

    const handleCanvasClick = event => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x: cursorX, y: cursorY } = getScaledCoords(event);
        for (const pawn of pawns) {
            if (ctx.isPointInPath(pawn.touchableArea, cursorX, cursorY)) {
                if (canPawnMove(pawn, rolledNumber)) socket.emit('game:move', pawn._id);
            }
        }
        setHintPawn(null);
    };

    const handleMouseMove = event => {
        if (!nowMoving || !rolledNumber) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x, y } = getScaledCoords(event);
        canvas.style.cursor = 'default';
        for (const pawn of pawns) {
            if (
                ctx.isPointInPath(pawn.touchableArea, x, y) &&
                player.color === pawn.color &&
                canPawnMove(pawn, rolledNumber)
            ) {
                const pawnPosition = getPositionAfterMove(pawn, rolledNumber);
                if (pawnPosition) {
                    canvas.style.cursor = 'pointer';
                    if (hintPawn && hintPawn.id === pawn._id) return;
                    setHintPawn({ id: pawn._id, position: pawnPosition, color: 'grey' });
                    return;
                }
            }
        }
        setHintPawn(null);
    };

    useEffect(() => {
        const rerenderCanvas = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const image = new Image();
            image.src = mapImage;
            image.onload = function () {
                ctx.drawImage(image, 0, 0);
                pawns.forEach((pawn, index) => {
                    pawns[index].touchableArea = paintPawn(ctx, pawn);
                });
                if (hintPawn) {
                    paintPawn(ctx, hintPawn);
                }
            };
        };
        rerenderCanvas();
    }, [hintPawn, pawns]);

    return (
        <canvas
            className='canvas-container'
            width={NATIVE_SIZE}
            height={NATIVE_SIZE}
            style={{
                width: `${boardSize}px`,
                height: `${boardSize}px`,
                touchAction: 'manipulation',
            }}
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
        />
    );
};
export default Map;
