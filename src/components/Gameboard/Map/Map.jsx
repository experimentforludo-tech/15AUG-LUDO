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
const TOUCH_RADIUS_CSS = 20; // 🔧 minimum finger-friendly tap radius, real CSS px me
const STACK_SCALE = 0.82; // 🔧 stacked pawns thode chhote draw hote hain taaki cascade cell ke andar fit ho
const CASCADE_STEP_X = 6; // 🔧 har "peechhe" wale pawn ka horizontal offset (px, native coords)
const CASCADE_STEP_Y = -6; // 🔧 har "peechhe" wale pawn ka vertical offset — diagonal cascade (upar-daayein)

// ===== NEW: safe squares (backend constants.js ke SAFE_POSITIONS se match honi chahiye) =====
const SAFE_POSITIONS = [16, 24, 29, 37, 42, 50, 55, 63];

const Map = ({ pawns, nowMoving, rolledNumber }) => {
    const player = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);
    const canvasRef = useRef(null);

    const [hintPawn, setHintPawn] = useState();
    const [boardSize, setBoardSize] = useState(NATIVE_SIZE);

    const imagesRef = useRef({ map: null, pawns: {} });
    const [assetsReady, setAssetsReady] = useState(false);

    // ===== arrival-order tracking — batata hai kaunsa pawn kis order me apne current cell pe pahuncha =====
    const arrivalOrderRef = useRef(new Map());
    const arrivalCounterRef = useRef(0);
    const lastKnownPositionRef = useRef(new Map());

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

    // Jab bhi kisi pawn ka position badalta hai (ya pehli baar dikhta hai), uska arrival number update karo.
    useEffect(() => {
        pawns.forEach(pawn => {
            const prevPosition = lastKnownPositionRef.current.get(pawn._id);
            if (prevPosition !== pawn.position) {
                arrivalCounterRef.current += 1;
                arrivalOrderRef.current.set(pawn._id, arrivalCounterRef.current);
                lastKnownPositionRef.current.set(pawn._id, pawn.position);
            }
        });
    }, [pawns]);

    // 🔧 NEW: pawns ko "front-to-back" order me deta hai — sabse recent-arrival (front, upar
    // dikhne wala) sabse pehle. Tap/hint resolution isi order me check hota hai, taaki jo
    // pawn visually upar/front dikh raha hai, wahi select ho — koi random wala nahi.
    const getPawnsFrontToBack = () =>
        [...pawns].sort(
            (a, b) => (arrivalOrderRef.current.get(b._id) || 0) - (arrivalOrderRef.current.get(a._id) || 0)
        );

    const getTouchRadius = () => TOUCH_RADIUS_CSS * (NATIVE_SIZE / boardSize);

    const paintPawn = (context, pawn, offset = { dx: 0, dy: 0 }, scale = 1) => {
        const { x, y } = positionMapCoords[pawn.position];
        const drawX = x + offset.dx;
        const drawY = y + offset.dy;
        const width = 35 * scale;
        const height = 30 * scale;
        const touchableArea = new Path2D();
        touchableArea.arc(drawX, drawY, getTouchRadius() * scale, 0, 2 * Math.PI);
        const image = imagesRef.current.pawns[pawn.color];
        if (image && image.complete) {
            context.drawImage(image, drawX - width / 2, drawY - height / 2, width, height);
        }
        return touchableArea;
    };

    const paintSafeZones = context => {
        context.save();
        context.fillStyle = 'rgba(255, 215, 0, 0.55)';
        context.strokeStyle = 'rgba(120, 90, 0, 0.6)';
        context.lineWidth = 1;
        SAFE_POSITIONS.forEach(pos => {
            const coords = positionMapCoords[pos];
            if (!coords) return;
            const { x, y } = coords;
            context.beginPath();
            context.arc(x, y, 6, 0, 2 * Math.PI);
            context.fill();
            context.stroke();
        });
        context.restore();
    };

    const getScaledCoordsFromClient = (clientX, clientY) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    };

    // 🔧 FIX: ab sirf APNE color ke pawns consider hote hain (pehle koi bhi color match ho jaata tha),
    // aur front-to-back order me sirf PEHLA matching pawn move hota hai — fir turant return, baaki
    // stack ke pawns ko touch bhi nahi kiya jaata. Isse ek tap = ek hi pawn move, guaranteed.
    const tryMovePawnAt = (clientX, clientY) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x: cursorX, y: cursorY } = getScaledCoordsFromClient(clientX, clientY);
        for (const pawn of getPawnsFrontToBack()) {
            if (pawn.color !== player.color) continue; // 👈 sirf apne pawns
            if (!ctx.isPointInPath(pawn.touchableArea, cursorX, cursorY)) continue;
            if (canPawnMove(pawn, rolledNumber, pawns)) {
                socket.emit('game:move', pawn._id);
                break; // 👈 sirf ek pawn move — baaki stack ko chhedo mat
            }
        }
        setHintPawn(null);
    };

    const handleCanvasClick = event => {
        tryMovePawnAt(event.clientX, event.clientY);
    };

    // 🔧 UPDATED: front-to-back order me check karta hai (pehle plain `pawns` order tha)
    const showHintAt = (clientX, clientY) => {
        if (!nowMoving || !rolledNumber) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x, y } = getScaledCoordsFromClient(clientX, clientY);
        canvas.style.cursor = 'default';
        for (const pawn of getPawnsFrontToBack()) {
            if (
                ctx.isPointInPath(pawn.touchableArea, x, y) &&
                player.color === pawn.color &&
                canPawnMove(pawn, rolledNumber, pawns)
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

    const handleMouseMove = event => showHintAt(event.clientX, event.clientY);

    const handleTouchStart = event => {
        if (event.touches.length === 0) return;
        const touch = event.touches[0];
        event.preventDefault();
        showHintAt(touch.clientX, touch.clientY);
        tryMovePawnAt(touch.clientX, touch.clientY);
    };

    useEffect(() => {
        if (!assetsReady) return;

        const rerenderCanvas = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

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
            paintSafeZones(ctx);

            // Same cell pe jitne bhi pawns (same ya mixed color): purane se naye order me draw —
            // sabse naya (front) sabse upar aur bina offset ke, purane peeche/offset ke saath.
            const pawnsByPosition = {};
            pawns.forEach(pawn => {
                (pawnsByPosition[pawn.position] = pawnsByPosition[pawn.position] || []).push(pawn);
            });

            Object.values(pawnsByPosition).forEach(group => {
                if (group.length === 1) {
                    group[0].touchableArea = paintPawn(ctx, group[0]);
                    return;
                }
                const sortedByArrival = [...group].sort(
                    (a, b) =>
                        (arrivalOrderRef.current.get(a._id) || 0) - (arrivalOrderRef.current.get(b._id) || 0)
                );
                const total = sortedByArrival.length;
                sortedByArrival.forEach((pawn, i) => {
                    const stepsFromFront = total - 1 - i;
                    const offset = {
                        dx: stepsFromFront * CASCADE_STEP_X,
                        dy: stepsFromFront * CASCADE_STEP_Y,
                    };
                    pawn.touchableArea = paintPawn(ctx, pawn, offset, STACK_SCALE);
                });
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
                touchAction: 'none',
            }}
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
        />
    );
};
export default Map;
