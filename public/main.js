const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: { preload, create, update },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
};

const game = new Phaser.Game(config);

// Globals
let player, cursors, bombs, bombTimer;
let score = 0, scoreText;
let lives = 3, livesText;
let gameOverText, replayText;
let isGameOver = false;

// Difficulty control variables
let spawnDelay = 900;            // starting spawn delay (ms)
const MIN_SPAWN_DELAY = 250;     // minimal possible delay
const DIFFICULTY_STEP_MS = 50;   // how much we reduce delay at each step
const DIFFICULTY_INTERVAL = 8000; // every 8s we increase difficulty
let bombSpeedMin = 100;          // initial min bomb speed
let bombSpeedMax = 300;          // initial max bomb speed
const SPEED_STEP = 20;           // speed increase per difficulty step
const MAX_BOMB_SPEED = 500;      // cap speed

// High score
let bestScore = 0;

// ===============================
// 1️⃣ PRELOAD
// ===============================
function preload() {
  this.load.image('background', 'assets/bg.png');
  this.load.image('player', 'assets/player.png');
  this.load.image('bomb', 'assets/bomb.png');
  this.load.image('explosion', 'assets/explosion.png');
}

// ===============================
// 2️⃣ CREATE
// ===============================
function create() {
  // Background
  this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'background')
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

  // Reset game variables
  score = 0;
  lives = 3;
  isGameOver = false;
  spawnDelay = 900;
  bombSpeedMin = 100;
  bombSpeedMax = 300;

  // Load best score from localStorage (if exists)
  const saved = localStorage.getItem('avoider_best_score');
  bestScore = saved ? parseInt(saved, 10) : 0;

  // Player
  player = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 60, 'player')
    .setScale(0.5)
    .setCollideWorldBounds(true);

  // Adjust hitbox relative to scale (safe default)
  const pvw = player.width * player.scaleX;
  const pvh = player.height * player.scaleY;
  player.body.setSize(Math.floor(pvw * 0.7), Math.floor(pvh * 0.85));
  player.body.setOffset(Math.floor((pvw - (pvw * 0.7)) / 2), Math.floor(pvh - (pvh * 0.85)));
  player.invulnerable = false;

  // Bomb group
  bombs = this.physics.add.group({ defaultKey: 'bomb', maxSize: 300 });

  // Controls
  cursors = this.input.keyboard.createCursorKeys();
  this.keys = {
    A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
  };

  // UI: Score, Lives, Best
  scoreText = this.add.text(10, 10, '⭐ Score: 0', { fontSize: '18px', fill: '#fff', fontFamily: 'Comic Sans MS' });
  livesText = this.add.text(GAME_WIDTH - 160, 10, '❤️ Vies: 3', { fontSize: '18px', fill: '#fff', fontFamily: 'Comic Sans MS' });
  // Best score shown under lives
  this.add.text(GAME_WIDTH - 160, 30, 'Meilleur: ' + bestScore, { fontSize: '14px', fill: '#ffdd55', fontFamily: 'Comic Sans MS' });

  // Overlap detection
  this.physics.add.overlap(player, bombs, hitBomb, null, this);

  // Spawn timer (uses spawnDelay var, see difficulty code)
  bombTimer = this.time.addEvent({
    delay: spawnDelay,
    callback: spawnBomb,
    callbackScope: this,
    loop: true
  });

  // Difficulty ramp: increase difficulty every DIFFICULTY_INTERVAL ms
  this.time.addEvent({
    delay: DIFFICULTY_INTERVAL,
    callback: increaseDifficulty,
    callbackScope: this,
    loop: true
  });

  // Game over / replay texts
  gameOverText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '', { fontSize: '32px', fill: '#ff3333', fontFamily: 'Comic Sans MS' }).setOrigin(0.5);
  replayText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, '', { fontSize: '18px', fill: '#fff', backgroundColor: '#444', padding: 8, fontFamily: 'Comic Sans MS' })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => { if (isGameOver) this.scene.restart(); });

  gameOverText.setVisible(false);
  replayText.setVisible(false);
}

// ===============================
// 3️⃣ UPDATE
// ===============================
function update() {
  if (isGameOver) return;

  const moveSpeed = 250;
  let velocityX = 0;

  // Movement input
  if (cursors.left.isDown || this.keys.A.isDown) velocityX = -moveSpeed;
  if (cursors.right.isDown || this.keys.D.isDown) velocityX = moveSpeed;
  player.setVelocityX(velocityX);

  // Check bombs leaving screen -> award points + floating text
  bombs.getChildren().forEach(bomb => {
    if (!bomb.active) return;
    if (bomb.y > GAME_HEIGHT + 30) {
      // Remove bomb and give points
      bomb.disableBody(true, true);
      const points = 2;
      score += points;
      scoreText.setText('⭐ Score: ' + score);

      // Floating text feedback
      createFloatingText.call(this, bomb.x, GAME_HEIGHT - 120, '+' + points);

      // update best score display live (optional)
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('avoider_best_score', bestScore.toString());
        // update best score text (we created it at y=30, x=GAME_WIDTH-160)
        // it's easier to find and update if we stored reference; for simplicity, draw over it:
        this.add.text(GAME_WIDTH - 160, 30, 'Meilleur: ' + bestScore, { fontSize: '14px', fill: '#ffdd55', fontFamily: 'Comic Sans MS' });
      }
    }
  });
}

// ===============================
// floating text helper
// ===============================
function createFloatingText(x, y, text) {
  // small pop-up that rises and fades
  const t = this.add.text(x, y, text, { fontSize: '18px', fill: '#ffea00', fontFamily: 'Comic Sans MS', stroke: '#333', strokeThickness: 3 })
    .setOrigin(0.5)
    .setDepth(20);
  this.tweens.add({
    targets: t,
    y: y - 50,
    alpha: 0,
    duration: 800,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy()
  });
}

// ===============================
// 4️⃣ spawnBomb (uses current bomb speed range)
// ===============================
function spawnBomb() {
  if (isGameOver) return;

  const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
  const speed = Phaser.Math.Between(bombSpeedMin, bombSpeedMax);

  const bomb = bombs.create(x, -30, 'bomb')
    .setScale(0.25)
    .setVelocityY(speed)
    .setAngularVelocity(Phaser.Math.Between(-180, 180))
    .setOrigin(0.5);

  // compute visual size & set hitbox smaller for forgiving gameplay
  const bombVisualW = bomb.width * bomb.scaleX;
  const bombVisualH = bomb.height * bomb.scaleY;
  const bombHitW = Math.floor(bombVisualW * 0.75);
  const bombHitH = Math.floor(bombVisualH * 0.75);
  bomb.body.setAllowGravity(false);
  bomb.body.setSize(bombHitW, bombHitH);
  bomb.body.setOffset(Math.floor((bombVisualW - bombHitW) / 2), Math.floor((bombVisualH - bombHitH) / 2));

  // Optionally use circular body if bomb is round:
  // const radius = Math.floor(Math.min(bombVisualW, bombVisualH) * 0.4);
  // bomb.body.setCircle(radius, Math.floor((bombVisualW - radius*2)/2), Math.floor((bombVisualH - radius*2)/2));
}

// ===============================
// 5️⃣ hitBomb - when player is hit
// ===============================
function hitBomb(playerObj, bombObj) {
  if (playerObj.invulnerable) return;

  bombObj.disableBody(true, true);
  lives--;
  livesText.setText('❤️ Vies: ' + lives);

  // Camera shake for impact
  this.cameras.main.shake(200, 0.01);

  // Explosion visual
  const explosion = this.add.sprite(playerObj.x, playerObj.y, 'explosion').setScale(0.8).setAlpha(0.9);
  this.tweens.add({
    targets: explosion,
    scale: 1.2,
    alpha: 0,
    duration: 300,
    onComplete: () => explosion.destroy()
  });

  // Invulnerability + blink
  playerObj.invulnerable = true;
  this.tweens.add({
    targets: playerObj,
    alpha: 0.3,
    duration: 100,
    yoyo: true,
    repeat: 6,
    onComplete: () => { playerObj.alpha = 1; playerObj.invulnerable = false; }
  });

  // If no lives -> game over
  if (lives <= 0) handleGameOver.call(this);
}

// ===============================
// 6️⃣ increaseDifficulty - periodically called
// ===============================
function increaseDifficulty() {
  // Reduce spawn delay (but not below MIN_SPAWN_DELAY)
  if (spawnDelay > MIN_SPAWN_DELAY) {
    spawnDelay = Math.max(MIN_SPAWN_DELAY, spawnDelay - DIFFICULTY_STEP_MS);
    // Reset timer with new delay (preserve looping)
    if (bombTimer) bombTimer.reset({ delay: spawnDelay, callback: spawnBomb, callbackScope: this, loop: true });
  }

  // Increase bomb speeds (bounded)
  bombSpeedMin = Math.min(MAX_BOMB_SPEED, bombSpeedMin + SPEED_STEP);
  bombSpeedMax = Math.min(MAX_BOMB_SPEED, bombSpeedMax + SPEED_STEP);
}

// ===============================
// 7️⃣ handleGameOver
// ===============================
function handleGameOver() {
  isGameOver = true;
  this.physics.pause();
  if (bombTimer) bombTimer.remove(false);

  // Show game over UI
  gameOverText.setText('💀 GAME OVER 💀').setVisible(true);
  replayText.setText('🔁 Rejouer').setVisible(true);

  // Remove remaining bombs
  bombs.children.each(bomb => { if (bomb.active) bomb.disableBody(true, true); });

  // Save best score if current > saved
  const saved = parseInt(localStorage.getItem('avoider_best_score') || '0', 10);
  if (score > saved) {
    localStorage.setItem('avoider_best_score', score.toString());
  }
}
