(function() {
    'use strict';
    var game = new Phaser.Game(window.innerWidth || 800, window.innerHeight || 800, Phaser.CANVAS, 'phaser-game',
        { preload: preload, create: create, update: update, render: render });
        
    var PLAYER_SPEED = 0.015;   //player movement speed (radians of rotation)
    var planet;
    
    var MAX_METEORS = 50;
    var meteorGroup;
    var meteorTimer;
    var meteorSpawnCircle;
    var METEOR_FALL_SPEED = 2.0;

    //preload all assets used by the game
    function preload() {
        game.load.image('background', 'assets/stars.jpg');
        game.load.image('planet', 'assets/dirtplanet.png');
        game.load.image('player', 'assets/stickman.png');
        game.load.image('meteor', 'assets/meteor.png');
        game.time.advancedTiming = true;
    }
    
    //create all objects used by the game
    function create() {
        game.add.tileSprite(0, 0, game.width, game.height, 'background');
        
        planet = game.add.sprite(game.world.centerX, game.world.centerY, 'planet');
        planet.anchor.set(0.5, 0.5);
        
        var player = game.add.sprite(planet.x, planet.y, 'player');
        player.y -= (planet.height / 2) + player.height;
        
        initializeMeteorGroup();
        meteorTimer = game.time.events.loop(250, spawnMeteor);
        var spawnCircleDiameter = Math.max(game.width, game.height) + (game.cache.getImage('meteor').width / 2);
        meteorSpawnCircle = new Phaser.Circle(planet.x, planet.y, spawnCircleDiameter);
    }
    
    //load a bunch of meteors into a group so they're ready to appear without delay during the game
    //TODO: show a loading screen while this runs (how?)
    function initializeMeteorGroup() {
        meteorGroup = game.add.group();
        for(var i = 0; i < MAX_METEORS; i++) {
            //add meteors to the game, defaulting to not existing so they're not drawn yet
            var meteor = meteorGroup.create(0, 0, 'meteor');
            meteor.anchor.set(0.5);
            meteor.exists = false;
        }
    }
    
    //spawn a meteor, provided there's a free one in the group, at a random point on the spawn circle
    function spawnMeteor() {
        var meteor = meteorGroup.getFirstExists(false);
        if (meteor) {
            var meteorAngle = game.rnd.angle();
            meteor.orbitRadius = meteorSpawnCircle.radius;
            meteor.angle = meteorAngle;
            
            var spawnPoint = getPointOnCircle(meteorSpawnCircle, meteorAngle);
            meteor.x = spawnPoint.x;
            meteor.y = spawnPoint.y;
            
            meteor.exists = true;
        }
    }
    
    //returns the (x, y) coordinates of the point on the given circle at the given angle (polar -> cartesian)
    function getPointOnCircle(circle, angle) {
        var x = circle.x + (circle.radius * Math.cos(angle));
        var y = circle.y + (circle.radius * Math.sin(angle));
        return new Phaser.Point(x, y);
    }
    
    //main game update loop: handle input and update all objects
    function update() {
        if (game.input.keyboard.isDown(Phaser.Keyboard.A)) {
            planet.rotation += PLAYER_SPEED;
            meteorGroup.forEach(function(meteor) { meteor.angle += PLAYER_SPEED; });
        }
        if (game.input.keyboard.isDown(Phaser.Keyboard.D)) {
            planet.rotation -= PLAYER_SPEED;
            meteorGroup.forEach(function(meteor) { meteor.angle -= PLAYER_SPEED; });
        }
        
        updateMeteors();
    }
    
    //update all active meteors in the meteor group, making them fall, and detecting collision with the player or planet
    function updateMeteors() {
        meteorGroup.forEach(function(meteor) {
            if (!meteor.exists) return;
            meteor.orbitRadius -= METEOR_FALL_SPEED;
            
            //check for planet collision detection
            if (meteor.orbitRadius < (planet.width / 2)) {
                meteor.exists = false;
            }
            //TODO: check for player collision detection
            //else if { ... }
            //else, no collision, keep falling
            else {
                var orbitCircle = new Phaser.Circle(planet.x, planet.y, meteor.orbitRadius * 2);
                var newPosition = getPointOnCircle(orbitCircle, meteor.angle);
                meteor.x = newPosition.x;
                meteor.y = newPosition.y;
            }
        });
    }
    
    //render a debug overlay
    function render() {
        game.debug.text('FPS: ' + game.time.fps || '--', 2, 20, "white");   
        game.debug.text('Meteors: ' + meteorGroup.iterate('exists', true, Phaser.Group.RETURN_TOTAL), 2, 40, 'white');
        game.debug.text('Rotation: ' + planet.angle.toFixed(1), 2, 60, 'white');
    }
}());