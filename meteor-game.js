(function() {
    'use strict';
    var game = new Phaser.Game(window.innerWidth || 800, window.innerHeight || 800, Phaser.CANVAS, 'phaser-game',
        { preload: preload, create: create, update: update, render: render });
        
    var PLAYER_SPEED = 0.015;   //player movement speed (radians of rotation)
    var player;
    var planet;
    
    var MAX_METEORS = 300;
    var meteorGroup;
    var meteorTimer;
    var increaseDifficultyTimer;
    var meteorSpawnCircle;
    var METEOR_FALL_SPEED = 2.0;
    var meteorsAvoided = 0;
    
    var MAX_DUST_CLOUDS = 50;
    var dustGroup;
    var DUST_ALPHA_FALLOFF = 0.02;      //rate at which dust clouds fade
    var DUST_SCALE_MULTIPLIER = 1.03;   //how fast to expand dust clouds

    //preload all assets used by the game
    function preload() {
        game.load.image('background', 'assets/stars.jpg');
        game.load.image('planet', 'assets/dirtplanet.png');
        game.load.image('player', 'assets/stickman.png');
        game.load.image('meteor', 'assets/meteor.png');
        game.load.image('dust', 'assets/dust.png');
        game.time.advancedTiming = true;
    }
    
    //create all objects used by the game
    function create() {
        game.add.tileSprite(0, 0, game.width, game.height, 'background');
        
        planet = game.add.sprite(game.world.centerX, game.world.centerY, 'planet');
        planet.anchor.set(0.5, 0.5);
        
        player = game.add.sprite(planet.x, planet.y, 'player');
        player.y -= (planet.height / 2) + player.height;
        game.physics.enable(player, Phaser.Physics.ARCADE);
        
        initializeMeteors();
        meteorTimer = game.time.events.loop(200, spawnMeteor);
        increaseDifficultyTimer = game.time.events.loop(1000, increaseDifficulty);
        var spawnCircleDiameter = Math.max(game.width, game.height) * 1.5;
        meteorSpawnCircle = new Phaser.Circle(planet.x, planet.y, spawnCircleDiameter);
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
            var meteorAngle = game.rnd.angle();
            meteor.orbitRadius = meteorSpawnCircle.radius;
            meteor.angle = meteorAngle;
            meteor.events.onKilled.add(meteorKilled);
            
            var spawnPoint = getPointOnCircle(meteorSpawnCircle, meteorAngle);
            meteor.x = spawnPoint.x;
            meteor.y = spawnPoint.y;
            
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
    
    //returns the (x, y) coordinates of the point on the given circle at the given angle (polar -> cartesian)
    function getPointOnCircle(circle, angle) {
        var x = circle.x + (circle.radius * Math.cos(angle));
        var y = circle.y + (circle.radius * Math.sin(angle));
        return new Phaser.Point(x, y);
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
                meteorGroup.forEach(function(meteor) { if (meteor.exists) meteor.angle += PLAYER_SPEED; });
                dustGroup.forEach(function(dust) { if (dust.exists) dust.angle += PLAYER_SPEED; });
            }
            if (game.input.keyboard.isDown(Phaser.Keyboard.D) || game.input.keyboard.isDown(Phaser.Keyboard.RIGHT) ||
                pointerRight(game.input.pointer1) || pointerRight(game.input.pointer2)) {
                planet.rotation -= PLAYER_SPEED;
                meteorGroup.forEach(function(meteor) { if (meteor.exists) meteor.angle -= PLAYER_SPEED; });
                dustGroup.forEach(function(dust) { if (dust.exists) dust.angle += PLAYER_SPEED; });
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
        meteorGroup.forEach(function(meteor) {
            if (!meteor.exists) return;
            //collided with the planet?
            if (meteor.orbitRadius < (planet.width / 2) + (meteor.width / 2)) {
                meteor.kill();
                if (player.alive) meteorsAvoided++;
            }
            //nope, keep falling
            else {
                meteor.orbitRadius -= METEOR_FALL_SPEED;
                var orbitCircle = new Phaser.Circle(planet.x, planet.y, meteor.orbitRadius * 2);
                var newPosition = getPointOnCircle(orbitCircle, meteor.angle);
                meteor.x = newPosition.x;
                meteor.y = newPosition.y;
            }
        });
    }
    
    //fade out all dust clouds, removing them once they're no longer visible
    function updateDustClouds() {
        dustGroup.forEach(function(dust) {
            if (!dust.exists) return;
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
    
    //render a debug overlay
    function render() {
        game.debug.text('FPS: ' + game.time.fps || '--', 2, 20, "white");   
        game.debug.text('Meteors: ' + meteorGroup.iterate('exists', true, Phaser.Group.RETURN_TOTAL), 2, 40, 'white');
        game.debug.text('Rotation: ' + planet.angle.toFixed(1), 2, 60, 'white');
        game.debug.text('Spawn Freq: ' + meteorTimer.delay, 2, 80, 'white');
        game.debug.text('Score: ' + meteorsAvoided, 2, 100, 'white');
    }
}());