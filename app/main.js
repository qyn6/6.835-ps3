// GAME SETUP
var initialState = SKIPSETUP ? "playing" : "setup";
var gameState = new GameState({state: initialState});
var cpuBoard = new Board({autoDeploy: true, name: "cpu"});
var playerBoard = new Board({autoDeploy: SKIPSETUP, name: "player"});
var cursor = new Cursor();

// UI SETUP
setupUserInterface();

// selectedTile: The tile that the player is currently hovering above
var selectedTile = false;

// grabbedShip/Offset: The ship and offset if player is currently manipulating a ship
var grabbedShip = false;
var grabbedOffset = [0, 0];

// isGrabbing: Is the player's hand currently in a grabbing pose
var isGrabbing = false;

// MAIN GAME LOOP
// Called every time the Leap provides a new frame of data
Leap.loop({ hand: function(hand) {
  // Clear any highlighting at the beginning of the loop
  unhighlightTiles();
  console.log(hand.grabStrength, hand.pinchStrength);
  // TODO: 4.1, Moving the cursor with Leap data
  // Use the hand data to control the cursor's screen position
  var cursorPosition = [hand.screenPosition()[0]-400, hand.screenPosition()[1]+200];
  cursor.setScreenPosition(cursorPosition);

  // TODO: 4.1
  // Get the tile that the player is currently selecting, and highlight it
  selectedTile = getIntersectingTile(cursorPosition);
  if (selectedTile !== false){
    highlightTile(selectedTile, Colors.GREEN);
  } 

  // SETUP mode
  if (gameState.get('state') == 'setup') {
    background.setContent("<h1>battleship</h1><h3 style='color: #7CD3A2;'>deploy ships</h3>");
    // TODO: 4.2, Deploying ships
    //  Enable the player to grab, move, rotate, and drop ships to deploy them
    var shipAndOffset = getIntersectingShipAndOffset(cursorPosition);
    // First, determine if grabbing pose or not

    isGrabbing = shipAndOffset && (hand.grabStrength > 0.9 || hand.pinchStrength > .9);
 
    // Grabbing, but no selected ship yet. Look for one.
    // TODO: Update grabbedShip/grabbedOffset if the user is hovering over a ship
    if (!grabbedShip && isGrabbing) {
      grabbedShip = shipAndOffset['ship'];
      grabbedOffset = shipAndOffset['offset'];
    }
    // Has selected a ship and is still holding it
    // TODO: Move the ship
    else if (grabbedShip && isGrabbing) {
      grabbedShip.setScreenPosition([cursorPosition[0] - grabbedOffset[0], cursorPosition[1] - grabbedOffset[1]]);
      grabbedShip.setScreenRotation(-hand.roll());
    }

    // Finished moving a ship. Release it, and try placing it.
    // TODO: Try placing the ship on the board and release the ship
    else if (grabbedShip && !isGrabbing) {
      placeShip(grabbedShip);
      grabbedShip = false;
    }

    console.log('grabbedship' + grabbedShip);
  }

  // PLAYING or END GAME so draw the board and ships (if player's board)
  // Note: Don't have to touch this code
  else {
    if (gameState.get('state') == 'playing') {
      background.setContent("<h1>battleship</h1><h3 style='color: #7CD3A2;'>game on</h3>");
      turnFeedback.setContent(gameState.getTurnHTML());
    }
    else if (gameState.get('state') == 'end') {
      var endLabel = gameState.get('winner') == 'player' ? 'you won!' : 'game over';
      background.setContent("<h1>battleship</h1><h3 style='color: #7CD3A2;'>"+endLabel+"</h3>");
      turnFeedback.setContent("");
    }

    var board = gameState.get('turn') == 'player' ? cpuBoard : playerBoard;
    // Render past shots
    board.get('shots').forEach(function(shot) {
      var position = shot.get('position');
      var tileColor = shot.get('isHit') ? Colors.RED : Colors.YELLOW;
      highlightTile(position, tileColor);
    });

    // Render the ships
    playerBoard.get('ships').forEach(function(ship) {
      if (gameState.get('turn') == 'cpu') {
        var position = ship.get('position');
        var screenPosition = gridOrigin.slice(0);
        screenPosition[0] += position.col * TILESIZE;
        screenPosition[1] += position.row * TILESIZE;
        ship.setScreenPosition(screenPosition);
        if (ship.get('isVertical'))
          ship.setScreenRotation(Math.PI/2);
      } else {
        ship.setScreenPosition([-500, -500]);
      }
    });

    // If playing and CPU's turn, generate a shot
    if (gameState.get('state') == 'playing' && gameState.isCpuTurn() && !gameState.get('waiting')) {
      gameState.set('waiting', true);
      generateCpuShot();
    }
  }
}}).use('screenPosition', {scale: LEAPSCALE});

// processSpeech(transcript)
//  Is called anytime speech is recognized by the Web Speech API
// Input: 
//    transcript, a string of possibly multiple words that were recognized
// Output: 
//    processed, a boolean indicating whether the system reacted to the speech or not
var processSpeech = function(transcript) {
  // Helper function to detect if any commands appear in a string
  var userSaid = function(str, commands) {
    for (var i = 0; i < commands.length; i++) {
      str = str.toLowerCase();
      if (str.indexOf(commands[i]) > -1)
        return true;
    }
    return false;
  };

  var processed = false;
  if (gameState.get('state') == 'setup') {
    // TODO: 4.3, Starting the game with speech
    // Detect the 'start' command, and start the game if it was said
    if (userSaid(transcript, ['start'])) {
      gameState.startGame();
      processed = true;
    }
  }

  else if (gameState.get('state') == 'playing') {
    if (gameState.isPlayerTurn()) {
      // TODO: 4.4, Player's turn
      // Detect the 'fire' command, and register the shot if it was said
      if (userSaid(transcript, ['fire'])) {
        registerPlayerShot();

        processed = true;
      }
    }

    else if (gameState.isCpuTurn() && gameState.waitingForPlayer()) {
      // TODO: 4.5, CPU's turn
      // Detect the player's response to the CPU's shot: hit, miss, you sunk my ..., game over
      // and register the CPU's shot if it was said
      if (userSaid(transcript, ['hit'])) {
        var response = 'hit';
        registerCpuShot(response);

        processed = true;
      } else if (userSaid(transcript, ['miss'])) {
        var response = 'miss';
        registerCpuShot(response);

        processed = true;
      } else if (userSaid(transcript, ['sunk'])) {
        var response = 'sunk';
        registerCpuShot(response);

        processed = true;
      } else if (userSaid(transcript, ['game over'])) {
        var response = 'game over';
        registerCpuShot(response);

        processed = true;
      } 
    }
  }

  return processed;
};

// TODO: 4.4, Player's turn
// Generate CPU speech feedback when player takes a shot
var registerPlayerShot = function() {
  // TODO: CPU should respond if the shot was off-board
  if (!selectedTile) {
    generateSpeech('you suck');
  }

  // If aiming at a tile, register the player's shot
  else {
    var shot = new Shot({position: selectedTile});
    var result = cpuBoard.fireShot(shot);

    // Duplicate shot
    if (!result) return;

    // TODO: Generate CPU feedback in three cases
    // Game over
    if (result.isGameOver) {
      gameState.endGame("player");
      generateSpeech('game over');
      return;
    }
    // Sunk ship
    else if (result.sunkShip) {
      var shipName = result.sunkShip.get('type');
      generateSpeech('you sunk my ' + shipName);
    }
    // Hit or miss
    else {
      var isHit = result.shot.get('isHit');
      if (isHit) {
        generateSpeech('hit');
      } else {
        generateSpeech("you can't hit me!");
      }
    }

    if (!result.isGameOver) {
      // TODO: Uncomment nextTurn to move onto the CPU's turn
      nextTurn();
    }
  }
};

// TODO: 4.5, CPU's turn
// Generate CPU shot as speech and blinking
var cpuShot;
var generateCpuShot = function() {
  // Generate a random CPU shot
  cpuShot = gameState.getCpuShot();
  var tile = cpuShot.get('position');
  var rowName = ROWNAMES[tile.row]; // e.g. "A"
  var colName = COLNAMES[tile.col]; // e.g. "5"

  // TODO: Generate speech and visual cues for CPU shot
  generateSpeech('fire ' + rowName + ' ' + colName);
  blinkTile(tile);
};

// TODO: 4.5, CPU's turn
// Generate CPU speech in response to the player's response
// E.g. CPU takes shot, then player responds with "hit" ==> CPU could then say "AWESOME!"
var registerCpuShot = function(playerResponse) {
  // Cancel any blinking
  unblinkTiles();
  var result = playerBoard.fireShot(cpuShot);
  console.log(result);
  // NOTE: Here we are using the actual result of the shot, rather than the player's response
  // In 4.6, you may experiment with the CPU's response when the player is not being truthful!

  // TODO: Generate CPU feedback in three cases

  // Game over
  if (result.isGameOver) {
    if (playerResponse !== 'game over') {
      generateSpeech('you lying son of a sea biscuit');
    }
    gameState.endGame("cpu");
    generateSpeech('All I do is win win win');
    return;
  }
  // Sunk ship
  else if (result.sunkShip) {
    if (playerResponse !== 'sunk') {
      generateSpeech('you lying son of a sea biscuit');
    }
    var shipName = result.sunkShip.get('type');
    generateSpeech('HA HA sunked you')
  }
  // Hit or miss
  else {
    var isHit = result.shot.get('isHit');
    if (isHit) {
      if (playerResponse !== 'hit') {
      generateSpeech('you lying son of a sea biscuit');
      }
      generateSpeech('AWESOME!');
    } else {
      if (playerResponse !== 'miss') {
      generateSpeech('you lying son of a sea biscuit');
      }
      generateSpeech('poopy');
    }
  }

  if (!result.isGameOver) {
    // TODO: Uncomment nextTurn to move onto the player's next turn
    nextTurn();
  }
};

