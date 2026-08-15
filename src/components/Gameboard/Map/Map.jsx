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
const TOUCH_RADIUS_CSS = 20; // 🔧 NEW: minimum finger-friendly tap radius, real CSS px me

const Map = ({ pawns, nowMoving, rolledNumber }) => {
    const player = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);
    const canvasRef = useRef(null);

    const [hintPawn, setHintPawn] = useState();

    // ===== NEW: Responsive board size (device ke hisaab se) =====
    const [boardSize, setBoardSize] = useState(NATIVE_SIZE);

    // 🔧 NEW: image cache — map + pawn images sirf ek baar load hote hain,
    // uske baad reuse hote hain. Pehle har redraw pe `new Image()` bana ke
    // src reload/redecode hota tha — isi se move ke baad flicker/jank aata tha.
    const imagesRef = useRef({ map: null, pawns: {} });
    const [assetsReady, setAssetsReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const loadPromises = [];

        const mapImg = new Image();
        mapImg.src = mapImage;
        loadPromises.push(new Promise(resolve => { mapImg.onload = resolve; }));
        imagesRef.current.map = mapImg;

        Object.entries(pawnImages).forEach(([color, src]) => {
            const img = new Image();
            img.src = src;
            loadPromises.push(new Promise(resolve => { img.onload = resolve; }));
            imagesRef.current.pawns[color] = img;
        });

        Promise.all(loadPromises).then(() => {
            if (!cancelled) setAssetsReady(true);
        });

        return () => {
            cancelled = true;
        };
    }, []);

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

    // 🔧 NEW: board jitna chhota hoga, logical radius utna bada rakho —
    // taaki asli finger-tap area (~20 CSS px) har screen size pe roughly same rahe
    const getTouchRadius = () => TOUCH_RADIUS_CSS * (NATIVE_SIZE / boardSize);

    const paintPawn = (context, pawn) => {
        const { x, y } = positionMapCoords[pawn.position];
        const touchableArea = new Path2D();
        touchableArea.arc(x, y, getTouchRadius(), 0, 2 * Math.PI);
        const image = imagesRef.current.pawns[pawn.color];
        if (image && image.complete) {
            context.drawImage(image, x - 17, y - 15, 35, 30);
        }
        return touchableArea;
    };

    // 👇 CRITICAL FIX: cursor coordinates ko canvas ke internal resolution
    // (460x460, ab dpr ke saath) ke hisaab se scale karna zaroori hai, kyunki
    // display size (boardSize) aur internal resolution alag ho sakte hain
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

    // 🔧 NEW: touchscreens par real "hover" nahi hota, isliye mousemove-based
    // hint kabhi trigger nahi hota tha mobile pe. Ab tap-and-hold (touchstart) pe
    // wahi ghost-pawn preview dikhega jo desktop pe mouse-hover se dikhta hai.
    const handleTouchStart = event => {
        if (!nowMoving || !rolledNumber || event.touches.length === 0) return;
        const touch = event.touches[0];
        handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    };

    useEffect(() => {
        if (!assetsReady) return;

        const rerenderCanvas = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            // 🔧 NEW: backing-store resolution ko devicePixelRatio ke hisaab se
            // badhaya, taaki retina/high-DPI phones pe board aur pawns blurry na dikhein
            const dpr = window.devicePixelRatio || 1;
            const targetWidth = NATIVE_SIZE * dpr;
            const targetHeight = NATIVE_SIZE * dpr;
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            ctx.clearRect(0, 0, NATIVE_SIZE, NATIVE_SIZE);
            ctx.drawImage(imagesRef.current.map, 0, 0, NATIVE_SIZE, NATIVE_SIZE);
            pawns.forEach((pawn, index) => {
                pawns[index].touchableArea = paintPawn(ctx, pawn);
            });
            if (hintPawn) {
                paintPawn(ctx, hintPawn);
            }
        };
        rerenderCanvas();
    }, [hintPawn, pawns, assetsReady, boardSize]);

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
            onTouchStart={handleTouchStart}
        />
    );
};
export default Map;
