/**
 * Mahjong Solitaire Logic Engine
 * Handles tile generation, layout generation, and matching rules.
 */

class MahjongLogic {
    constructor() {
        this.tiles = [];
        this.layout = [];
        this.boardWidth = 0;
        this.boardHeight = 0;
        this.selectedTile = null;
        this.pairsRemoved = 0;
        this.totalPairs = 72;
    }

    // Initialize a new game
    init() {
        this.tiles = this.createTileSet();
        this.shuffle(this.tiles);
        this.layout = this.generateTurtleLayout();
        this.assignTilesToLayout();
        this.selectedTile = null;
        this.pairsRemoved = 0;
    }

    // 144 Tiles
    createTileSet() {
        let set = [];
        const suits = ['bamboo', 'character', 'dot'];
        const winds = ['east', 'south', 'west', 'north'];
        const dragons = ['red', 'green', 'white'];
        
        // 1-9 for 3 suits (108 tiles)
        for (let s of suits) {
            for (let i = 1; i <= 9; i++) {
                for (let j = 0; j < 4; j++) {
                    set.push({ type: 'suit', suit: s, value: i, matchKey: `${s}-${i}` });
                }
            }
        }
        
        // Winds (16 tiles)
        for (let w of winds) {
            for (let j = 0; j < 4; j++) {
                set.push({ type: 'wind', value: w, matchKey: `wind-${w}` });
            }
        }
        
        // Dragons (12 tiles)
        for (let d of dragons) {
            for (let j = 0; j < 4; j++) {
                set.push({ type: 'dragon', value: d, matchKey: `dragon-${d}` });
            }
        }
        
        // Flowers & Seasons (8 tiles) -> any flower matches any flower, any season matches any season
        for (let i = 1; i <= 4; i++) {
            set.push({ type: 'flower', value: i, matchKey: 'flower' });
            set.push({ type: 'season', value: i, matchKey: 'season' });
        }
        
        return set;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // Simplified Turtle Layout using relative coordinates (x, y, z)
    // x and y are typically half-tile coordinates for correct overlaps.
    // Standard turtle is 144 tiles.
    generateTurtleLayout() {
        const layout = [];
        // Map of standard turtle layout (very simplified for this example)
        // Let's create a functional overlapping structure
        // For real turtle, we need 144 positions.
        // We will define a grid where 1 unit = half a tile width/height.
        // Tile size in logical units: w=2, h=2
        
        let idCounter = 0;
        const addLayer = (z, pattern, offsetX=0, offsetY=0) => {
            for(let row=0; row<pattern.length; row++) {
                for(let col=0; col<pattern[row].length; col++) {
                    if(pattern[row][col] === 1) {
                        layout.push({
                            id: idCounter++,
                            logicalX: col * 2 + offsetX,
                            logicalY: row * 2 + offsetY,
                            z: z,
                            tile: null, // to be populated
                            state: 'normal' // normal, selected, removed
                        });
                    }
                }
            }
        };

        // Standard 144-tile turtle (approximate to fit grid)
        // Layer 0: 12x8 max dimension (87 tiles)
        // ... Rather than exact turtle manually written, let's create a programmatic pyramid that exactly uses 144 tiles
        // 144 total. 
        // Layer 0 (Bottom): 8x10 = 80 tiles
        // Layer 1: 6x8 = 48 tiles
        // Layer 2: 4x4 = 16 tiles
        // Total = 144
        
        let spotsCount = 0;
        
        // L0: Base flat layer (12 cols x 10 rows) = 120 max
        // Remove 4 corners (2x2 each = 16 tiles) -> 120 - 16 = 104 tiles
        for (let r=0; r<10; r++) {
            for (let c=0; c<12; c++) {
                // Skip corners (2x2 spaces = 4 tiles each corner)
                if ((r < 2 && c < 2) || (r < 2 && c >= 10) || 
                    (r >= 8 && c < 2) || (r >= 8 && c >= 10)) {
                    continue;
                }
                layout.push({id: spotsCount++, logicalX: c*2, logicalY: r*2, z: 0, state: 'normal'});
            }
        }
        
        // L1: (8 cols x 4 rows) = 32 tiles
        for (let r=0; r<4; r++) {
            for (let c=0; c<8; c++) {
                // offset by +4 on x (2 tiles) and +6 on y (3 tiles) to center it
                layout.push({id: spotsCount++, logicalX: c*2 + 4, logicalY: r*2 + 6, z: 1, state: 'normal'});
            }
        }
        
        // L2: (4 cols x 2 rows) = 8 tiles
        for (let r=0; r<2; r++) {
            for (let c=0; c<4; c++) {
                // offset by +8 on x (4 tiles) and +8 on y (4 tiles) to center
                layout.push({id: spotsCount++, logicalX: c*2 + 8, logicalY: r*2 + 8, z: 2, state: 'normal'});
            }
        }
        
        // Total check: 104 + 32 + 8 = 144!
        
        // Calculate max bounds
        let maxX = 0; let maxY = 0;
        for(let spot of layout) {
            if(spot.logicalX > maxX) maxX = spot.logicalX;
            if(spot.logicalY > maxY) maxY = spot.logicalY;
        }
        this.boardWidth = maxX + 2; // + tile width
        this.boardHeight = maxY + 2; // + tile height
        
        return layout;
    }

    assignTilesToLayout() {
        // To make the game significantly easier and guarantee solvability,
        // we will assign pairs backwards (from an empty board, removing two available slots at a time)
        // OR we can assign pairs to currently free tiles in the existing layout.
        
        let unassignedSpots = [...this.layout];
        let tilesToPlace = [...this.tiles];
        // Ensure tilesToPlace is grouped in pairs for this algorithm
        
        // We need to match pairs. tilesToPlace is already shuffled, but we need 2 of the same matchKey.
        // Let's pair them up.
        let parsedPairs = [];
        while (tilesToPlace.length > 0) {
            let t1 = tilesToPlace.pop();
            let matchIdx = tilesToPlace.findIndex(t => t.matchKey === t1.matchKey);
            let t2 = tilesToPlace.splice(matchIdx, 1)[0];
            parsedPairs.push([t1, t2]);
        }

        // We simulate clearing the board backwards to guarantee it's solvable
        // Wait, standard Mahjong Solitaire solvability algorithm:
        // 1. Start with full layout (empty tiles).
        // 2. Find all currently "free" spots (spots with no top and one side free).
        // 3. Pick 2 random free spots.
        // 4. Assign a pair of tiles to these 2 spots.
        // 5. Remove these spots from the simulated layout.
        // 6. Repeat until all spots are assigned.
        
        // We need a helper to check if a spot is free in a specific simulated layout state
        const isSpotFreeSim = (spot, currentLayout) => {
            let hasLeft = false;
            let hasRight = false;
            let hasTop = false;

            for (let other of currentLayout) {
                if (other.id === spot.id) continue;

                if (other.z > spot.z) {
                    if (Math.abs(other.logicalX - spot.logicalX) < 2 && 
                        Math.abs(other.logicalY - spot.logicalY) < 2) {
                        hasTop = true;
                        return false; 
                    }
                }
                if (other.z === spot.z) {
                    if (Math.abs(other.logicalY - spot.logicalY) < 2) {
                        if (other.logicalX === spot.logicalX - 2) hasLeft = true;
                        if (other.logicalX === spot.logicalX + 2) hasRight = true;
                    }
                }
            }
            if (hasLeft && hasRight) return false;
            return true;
        };

        let simLayout = [...this.layout];
        
        while (parsedPairs.length > 0) {
            // Find all free spots in simLayout
            let freeSpots = simLayout.filter(spot => isSpotFreeSim(spot, simLayout));
            
            // If we somehow get stuck (can happen in weird custom geometries), fallback to random
            if (freeSpots.length < 2) {
                break; // Fallback to totally random for remaining
            }
            
            // Pick 2 random free spots
            this.shuffle(freeSpots);
            let spot1 = freeSpots[0];
            let spot2 = freeSpots[1];
            
            // Assign a pair
            let pair = parsedPairs.pop();
            
            // In the real layout, set the tiles
            let realSpot1 = this.layout.find(s => s.id === spot1.id);
            let realSpot2 = this.layout.find(s => s.id === spot2.id);
            realSpot1.tile = pair[0];
            realSpot2.tile = pair[1];
            
            // Remove from sim
            simLayout = simLayout.filter(s => s.id !== spot1.id && s.id !== spot2.id);
        }
        
        // Fallback for any leftovers (if geometry got locked in simulation)
        // Usually, the backwards creation algorithm never gets stuck if the board has no hidden isolated tiles.
        if (parsedPairs.length > 0) {
            let leftoverTiles = [];
            for (let p of parsedPairs) {
                leftoverTiles.push(p[0], p[1]);
            }
            this.shuffle(leftoverTiles);
            
            for (let spot of simLayout) {
                let realSpot = this.layout.find(s => s.id === spot.id);
                realSpot.tile = leftoverTiles.pop();
            }
        }
        
        // Add one more final shuffle of the whole board just to ensure randomness,
        // but wait, standard backward generation means it IS entirely randomized but guaranteed solvable from the start!
        // So we don't shuffle it here, otherwise we break the guarantee.
    }

    // Check if a tile can be clicked
    // A tile is free if:
    // 1. No tile is directly on top of it (overlapping x, y at z+1)
    // 2. No tile is directly to its left OR no tile is directly to its right
    isTileFree(tileObj) {
        if (tileObj.state !== 'normal') return false;

        let hasLeft = false;
        let hasRight = false;
        let hasTop = false;

        for (let other of this.layout) {
            if (other.state === 'removed' || other.id === tileObj.id) continue;

            // Check Top (z + 1)
            // A tile is on top if z matches and x,y overlap.
            // Width/height is 2 logical units.
            // Overlap: Math.abs(x1 - x2) < 2 && Math.abs(y1 - y2) < 2
            if (other.z > tileObj.z) {
                if (Math.abs(other.logicalX - tileObj.logicalX) < 2 && 
                    Math.abs(other.logicalY - tileObj.logicalY) < 2) {
                    hasTop = true;
                    return false; // Early exit, cannot be selected
                }
            }

            // Check Left/Right (same z layer, overlapping y)
            if (other.z === tileObj.z) {
                if (Math.abs(other.logicalY - tileObj.logicalY) < 2) {
                    // It's in the same row
                    if (other.logicalX === tileObj.logicalX - 2) hasLeft = true;
                    if (other.logicalX === tileObj.logicalX + 2) hasRight = true;
                }
            }
            
            // Note: Since tiles are placed precisely on even grid coordinates (c*2), 
            // the distance is exactly 2 for left/right. 
        }

        // If it has both left and right neighbors, it's blocked.
        if (hasLeft && hasRight) return false;

        return true; // No top tile, and at least one side is free.
    }

    // Try to select a tile. Returns true if match happened.
    selectTile(tileId) {
        const spot = this.layout.find(s => s.id === tileId);
        if (!spot || spot.state !== 'normal' || !this.isTileFree(spot)) {
            return { success: false, match: false };
        }

        if (!this.selectedTile) {
            this.selectedTile = spot;
            spot.state = 'selected';
            return { success: true, match: false };
        } else {
            // Already have a selected tile
            if (this.selectedTile.id === spot.id) {
                // Deselect
                this.selectedTile.state = 'normal';
                this.selectedTile = null;
                return { success: true, match: false, deselect: true };
            }

            // Check if match
            if (this.selectedTile.tile.matchKey === spot.tile.matchKey) {
                // MATCH!
                this.selectedTile.state = 'removed';
                spot.state = 'removed';
                this.selectedTile = null;
                this.pairsRemoved++;
                
                let isGameOver = (this.pairsRemoved === this.totalPairs);
                let hasMoves = this.checkAvailableMoves();
                
                return { success: true, match: true, pair: [spot, this.selectedTile], isGameOver, hasMoves };
            } else {
                // No match, switch selection
                this.selectedTile.state = 'normal';
                this.selectedTile = spot;
                spot.state = 'selected';
                return { success: true, match: false, switch: true };
            }
        }
    }

    // Returns array of available matching pairs
    getAvailablePairs() {
        const freeTiles = this.layout.filter(s => s.state !== 'removed' && this.isTileFree(s));
        let matches = [];
        
        for (let i = 0; i < freeTiles.length; i++) {
            for (let j = i + 1; j < freeTiles.length; j++) {
                if (freeTiles[i].tile.matchKey === freeTiles[j].tile.matchKey) {
                    matches.push([freeTiles[i], freeTiles[j]]);
                }
            }
        }
        return matches;
    }

    checkAvailableMoves() {
        return this.getAvailablePairs().length > 0;
    }

    // Provide a hint (returns null if no moves)
    getHint() {
        const pairs = this.getAvailablePairs();
        if (pairs.length > 0) {
            return pairs[0]; // Return the first available pair
        }
        return null;
    }

    // Shuffle only remaining tiles (when stuck)
    shuffleRemaining() {
        let remainingSpots = this.layout.filter(s => s.state !== 'removed');
        let remainingTiles = remainingSpots.map(s => s.tile);
        
        this.shuffle(remainingTiles);
        
        for (let i = 0; i < remainingSpots.length; i++) {
            remainingSpots[i].tile = remainingTiles[i];
            remainingSpots[i].state = 'normal'; // Reset selection
        }
        
        this.selectedTile = null;
    }
}

// Export for browser (if modules not used)
// window.MahjongLogic = MahjongLogic;
