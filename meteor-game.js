(function() {
    'use strict';
    var game = new Phaser.Game(window.innerWidth || 800, window.innerHeight || 800, Phaser.CANVAS, 'phaser-game',
        { preload: preload, create: create, update: update });
        
    var PLAYER_SPEED = 0.015;   //player movement speed (radians of rotation)
    var player;
    var planet;
    var planetCircle;
    
    var MAX_METEORS = 300;
    var meteorGroup;
    var meteorSpawnCircle;
    var METEOR_FALL_SPEED = 2.0;
    var meteorsAvoided = 0;
    var INITIAL_METEOR_SPAWN_TIMER = 200;
    var meteorTimer;
    var DIFFICULTY_INCREASE_TIMER = 1000;
    var increaseDifficultyTimer;
    
    var MAX_DUST_CLOUDS = 50;
    var dustGroup;
    var DUST_ALPHA_FALLOFF = 0.02;      //rate at which dust clouds fade
    var DUST_SCALE_MULTIPLIER = 1.03;   //how fast to expand dust clouds
    
    var gameOverControls;
    var gameOverText;

    //preload all assets used by the game
    function preload() {
        game.load.image('background', 'assets/stars.jpg');
        game.load.image('planet', 'assets/dirtplanet.png');
        game.load.image('player', 'assets/stickman.png');
        game.load.image('meteor', 'assets/meteor.png');
        game.load.image('dust', 'assets/dust.png');
        game.load.spritesheet('startButton', 'assets/startbutton.png', 192, 64);
        game.time.advancedTiming = true;
    }
    
    //create all objects used by the game
    function create() {
        game.add.tileSprite(0, 0, game.width, game.height, 'background');
        
        planet = game.add.sprite(game.world.centerX, game.world.centerY, 'planet');
        planet.anchor.set(0.5, 0.5);
        planetCircle = new Phaser.Circle(planet.x, planet.y, planet.width);
        
        player = game.add.sprite(planet.x, planet.y, 'player');
        player.y -= (planet.height / 2) + player.height;
        game.physics.enable(player, Phaser.Physics.ARCADE);
        player.events.onKilled.add(playerKilled);
        
        initializeMeteors();
        meteorTimer = game.time.events.loop(INITIAL_METEOR_SPAWN_TIMER, spawnMeteor);
        increaseDifficultyTimer = game.time.events.loop(DIFFICULTY_INCREASE_TIMER, increaseDifficulty);
        var spawnCircleDiameter = Math.max(game.width, game.height) * 1.5;
        meteorSpawnCircle = new Phaser.Circle(planet.x, planet.y, spawnCircleDiameter);
        
        gameOverControls = initializeGameOverControls();
    }
    
    //load a bunch of meteors into a group so they're ready to appear without delay during the game
    //TODO: show a loading screen while this runs (how?)
    function initializeMeteors() {
        meteorGroup = game.add.group();
        for(var i = 0; i < MAX_METEORS; i++) {
            //add meteors to the game, defaulting to not existing so they're not drawn yet
            var meteor = meteorGroup.create(0, 0, 'meteor');
            game.physics.enable(meteor, Phaser.Physics.ARCADE);
            meteor.anchor.set(0.5);
            meteor.exists = false;
        }
        
        //dust clouds for when meteors explode
        dustGroup = game.add.group();
        for(var j = 0; j < MAX_DUST_CLOUDS; j++) {
            var dust = dustGroup.create(0, 0, 'dust');
            dust.anchor.set(0.5);
            dust.exists = false;
        }
    }
    
    //spawn a meteor, provided there's a free one in the group, at a random point on the spawn circle
    function spawnMeteor() {
        var meteor = meteorGroup.getFirstExists(false);
        if (meteor) {
            meteor.orbitRadius = meteorSpawnCircle.radius;
            meteor.angle = game.rnd.angle();
            meteor.events.onKilled.add(meteorKilled);
            positionSpriteOnCircle(meteor, meteorSpawnCircle);
            meteor.exists = true;
        }
    }
    
    //a meteor was just killed, spawn a dust cloud wherever it was
    function meteorKilled(meteor) {
        spawnDustCloud(meteor);
    }
    
    //spawn an expanding, fading dust cloud at the given meteor's position
    function spawnDustCloud(meteor) {
        var dust = dustGroup.getFirstExists(false);
        if(dust) {
            dust.x = meteor.x;
            dust.y = meteor.y;
            dust.rotation = meteor.rotation;
            dust.alpha = 0.75;
            dust.scale.x = 1;
            dust.scale.y = 1;
            dust.exists = true;
        }
    }
    
    //increase the game difficulty by making meteors spawn more frequently
    function increaseDifficulty() {
        if (!player.alive) return;
        if (meteorTimer.delay <= 0) return;
        meteorTimer.delay--;
    }
    
    //returns the (x, y) coordinates of the point on the given circle at the given angle (in radians)
    function getPointOnCircle(circle, angle) {
        var x = circle.x + (circle.radius * Math.cos(angle));
        var y = circle.y + (circle.radius * Math.sin(angle));
        return new Phaser.Point(x, y);
    }
    
    //places the given sprite on the given circle, at the angle (in radians) specified by sprite.rotation
    function positionSpriteOnCircle(sprite, circle) {
        var newPosition = getPointOnCircle(circle, sprite.rotation);
        sprite.x = newPosition.x;
        sprite.y = newPosition.y;
    }
    
    //main game update loop: handle input and update all objects
    function update() {
        if (player.alive) {
            //detect input: 
            //keyboard input (A/D or left/right arrow keys)
            //touch input (tap and hold left/right sides of the screen)
            if (game.input.keyboard.isDown(Phaser.Keyboard.A) || game.input.keyboard.isDown(Phaser.Keyboard.LEFT) ||
                pointerLeft(game.input.pointer1) || pointerLeft(game.input.pointer2)) {
                planet.rotation += PLAYER_SPEED;
                meteorGroup.forEach(function(meteor) { if (meteor.exists) meteor.rotation += PLAYER_SPEED; });
                dustGroup.forEach(function(dust) { if (dust.exists) dust.rotation += PLAYER_SPEED; });
            }
            if (game.input.keyboard.isDown(Phaser.Keyboard.D) || game.input.keyboard.isDown(Phaser.Keyboard.RIGHT) ||
                pointerRight(game.input.pointer1) || pointerRight(game.input.pointer2)) {
                planet.rotation -= PLAYER_SPEED;
                meteorGroup.forEach(function(meteor) { if (meteor.exists) meteor.rotation -= PLAYER_SPEED; });
                dustGroup.forEach(function(dust) { if (dust.exists) dust.rotation -= PLAYER_SPEED; });
            }
        }
        
        updateMeteors();
        updateDustClouds();
    }
    
    //returns true if the given pointer is being held down on the left side of the screen
    function pointerLeft(pointer) {
        return pointer && pointer.isDown && pointer.x <= (game.width / 2);
    }
    
    //returns true if the given pointer is being held down on the right side of the screen
    function pointerRight(pointer) {
        return pointer && pointer.isDown && pointer.x > (game.width / 2);
    }
    
    //update all active meteors in the meteor group, making them fall, and detecting collision with the player or planet
    function updateMeteors() {
        //have Phaser run quadtree collision against the player
        game.physics.arcade.overlap(player, meteorGroup, function() { player.kill(); });
        
        //make each meteor fall, blowing it up if it reaches the planet
        meteorGroup.forEachExists(function(meteor) {
            //collided with the planet?
            if (meteor.orbitRadius < (planet.width / 2) + (meteor.width / 2)) {
                meteor.kill();
                if (player.alive) meteorsAvoided++;
            }
            //nope, keep falling
            else {
                meteor.orbitRadius -= METEOR_FALL_SPEED;
                var orbitCircle = new Phaser.Circle(planet.x, planet.y, meteor.orbitRadius * 2);
                positionSpriteOnCircle(meteor, orbitCircle);
            }
        });
    }
    
    //fade out all dust clouds, removing them once they're no longer visible
    function updateDustClouds() {
        dustGroup.forEachExists(function(dust) {
            positionSpriteOnCircle(dust, planetCircle);
            dust.alpha -= DUST_ALPHA_FALLOFF;
            if (dust.alpha <= 0) {
                dust.kill();
            }
            else {
                dust.scale.x *= DUST_SCALE_MULTIPLIER;
                dust.scale.y *= DUST_SCALE_MULTIPLIER;
            }
        });
    }
    
    //the player was just killed, show the game over screen
    function playerKilled() {
        gameOverText.text = 'You avoided ' + meteorsAvoided.toLocaleString() + ' meteors!';
        gameOverControls.visible = true;
        var tween = game.add.tween(gameOverControls);
        tween.to({y: (planet.y / 2)}, 2000, Phaser.Easing.Bounce.Out, true);
    }
    
    //create game over text and a restart button in a separate, initially
    //invisible group, to be tweened onto the screen once the player dies
    function initializeGameOverControls() {
        var controls = game.add.group();
        
        gameOverText = new Phaser.Text(game, game.world.centerX, 0, 'You avoided xxx meteors!', {font: 'bold 42pt Arial', fill: 'white'});
        gameOverText.anchor.set(0.5, 0);
        controls.add(gameOverText);
        
        var startButton = new Phaser.Button(game, game.world.centerX, gameOverText.y + 100, 'startButton', startButtonPressed, null, 0, 0, 1, 0);
        startButton.anchor.set(0.5, 0);
        controls.add(startButton);
        
        controls.y = game.height;
        controls.visible = false;
        return controls;
    }
    
    //the start/restart button was pressed, reset the game
    function startButtonPressed() {
        resetGame();
    }
    
    //reset game objects and variables for a new playthrough
    function resetGame() {
        meteorGroup.forEachExists(function(meteor) { meteor.exists = false; });
        dustGroup.forEachExists(function(dust) { dust.exists = false; });
        meteorsAvoided = 0;
        meteorTimer.delay = INITIAL_METEOR_SPAWN_TIMER;
        increaseDifficultyTimer.delay = DIFFICULTY_INCREASE_TIMER;
        player.revive();
        gameOverControls.y = game.height;
        gameOverControls.visible = false;
    }
}());