import getPositionAfterMove from './getPositionAfterMove';

// ===== NEW: blocking check (frontend hint ke liye) =====
// Backend jaisa hi rule: common track (16-67) pe agar kisi doosre color ke 2+ pawns
// ek hi cell pe hain, wahan landing allowed nahi.
const isPositionBlocked = (allPawns, position, movingColor) => {
    if (position < 16 || position > 67) return false;
    const colorCounts = {};
    allPawns.forEach(p => {
        if (p.position === position) {
            colorCounts[p.color] = (colorCounts[p.color] || 0) + 1;
        }
    });
    return Object.keys(colorCounts).some(color => color !== movingColor && colorCounts[color] >= 2);
};

// 🔧 UPDATED: teesra parameter `allPawns` add hua (default [] — purane calls break nahi honge)
const canPawnMove = (pawn, rolledNumber, allPawns = []) => {
    let canMoveBasic = false;

    if ((rolledNumber === 1 || rolledNumber === 6) && pawn.position === pawn.basePos) {
        canMoveBasic = true;
    } else if (pawn.position !== pawn.basePos) {
        switch (pawn.color) {
            case 'red':
                canMoveBasic = pawn.position + rolledNumber <= 73;
                break;
            case 'blue':
                canMoveBasic = pawn.position + rolledNumber <= 79;
                break;
            case 'green':
                canMoveBasic = pawn.position + rolledNumber <= 85;
                break;
            case 'yellow':
                // 🔧 FIX: pehle yahan 85 tha (green ki limit) — yellow ka apna max 91 hai
                canMoveBasic = pawn.position + rolledNumber <= 91;
                break;
            default:
                canMoveBasic = false;
        }
    }

    if (!canMoveBasic) return false;

    // 👇 NEW: blocked cell pe landing allowed nahi
    const landingPosition = getPositionAfterMove(pawn, rolledNumber);
    if (isPositionBlocked(allPawns, landingPosition, pawn.color)) return false;

    return true;
};

export default canPawnMove;
