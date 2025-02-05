function setLevel (level: number) {
    sprites.destroyAllSpritesOfKind(SpriteKind.Enemy)
    level = level
    tiles.loadMap(levels[level])
    makeBadGuys(myImage, myImage)
    setStartLocationByLevel(level)
}
function registerStartLocations () {
    startLocations = ["16,0", "\"0,62"]
}
scene.onOverlapTile(SpriteKind.Player, assets.tile`myTile4`, function (sprite, location) {
    setLevel(level + 1)
})
function createOgre (col: number, row: number) {
    ogre = sprites.create(img`
        . . . . . . . . . . . . . . . . 
        . . . . . . . . . . . . . . . . 
        . . . . . . . . . . . e e e . . 
        . . . . . d . . d . . e e e . . 
        . . . . . d . . d . . e e e . . 
        . . . . . 7 7 7 7 . . e e e . . 
        . . . . 7 7 7 7 7 7 . . e . . . 
        . . . . 7 f 7 7 f 7 . . e . . . 
        . . . 7 7 7 2 2 7 7 7 . 7 . . . 
        . . . 4 7 2 7 7 2 7 4 4 . . . . 
        . . 4 4 4 7 7 7 7 4 4 4 . . . . 
        . 7 4 4 4 4 4 4 4 4 4 4 . . . . 
        . . 4 4 4 4 4 4 4 4 4 . . . . . 
        . . . 4 4 4 4 4 4 4 . . . . . . 
        . . . . 4 4 4 4 4 . . . . . . . 
        . . . 7 7 . . . 7 7 . . . . . . 
        `, SpriteKind.Enemy)
    ogre.setPosition(row * 16, col * 16)
    return ogre
}
scene.onOverlapTile(SpriteKind.Player, assets.tile`myTile3`, function (sprite, location) {
    setLevel(level + 1)
})
sprites.onOverlap(SpriteKind.Enemy, SpriteKind.Player, function (sprite, otherSprite) {
    soldier.sayText("OW!")
    pause(1000)
    game.gameOver(false)
})
function calcDistance (colA: number, rowA: number, colB: number, rowB: number) {
    return Math.sqrt((colA - colB) ** 2 + (rowA - rowB) ** 2)
}
function makeBadGuys (TileSpawnPoint: Image, TileBackground: Image) {
    for (let col = 0; col <= scene.screenWidth(); col++) {
        for (let row = 0; row <= scene.screenHeight(); row++) {
            if (tiles.tileAtLocationEquals(tiles.getTileLocation(col, row), tiles.util.object4)) {
                tiles.setTileAt(tiles.getTileLocation(col, row), sprites.castle.tilePath5)
                enemies.push(createOgre(col, row))
            }
        }
    }
}
function setStartLocationByLevel (num: number) {
    soldier.setPosition(parseFloat(startLocations[num].split(",")[0]), parseFloat(startLocations[num].split(",")[1]))
}
function registerLevelTilemaps () {
    levels = [tiles.createMap(tilemap`level2`), tiles.createMap(tilemap`level12`)]
}
let ogre: Sprite = null
let startLocations: string[] = []
let levels: tiles.WorldMap[] = []
let level = 0
let myImage: Image = null
let soldier: Sprite = null
let enemies: Sprite[] = []
game.splash("entering the dungeon")
enemies = []
soldier = sprites.create(img`
    ........................
    ....ffffff..............
    ..ffeeeef2f.............
    .ffeeeef222f............
    .feeeffeeeef...cc.......
    .ffffee2222ef.cdc.......
    .fe222ffffe2fcddc.......
    fffffffeeeffcddc........
    ffe44ebf44ecddc.........
    fee4d41fddecdc..........
    .feee4dddedccc..........
    ..ffee44e4dde...........
    ...f222244ee............
    ...f2222e2f.............
    ...f444455f.............
    ....ffffff..............
    .....fff................
    ........................
    ........................
    ........................
    ........................
    ........................
    ........................
    ........................
    `, SpriteKind.Player)
controller.moveSprite(soldier)
scene.cameraFollowSprite(soldier)
makeBadGuys(myImage, myImage)
game.setGameOverMessage(false, "GAME OVER!")
registerLevelTilemaps()
level = 0
setLevel(level)
forever(function () {
    for (let value of enemies) {
        if (calcDistance(value.x, soldier.x, value.y, soldier.y) < 20) {
            value.follow(soldier, 20)
        }
    }
    pause(1000)
})
