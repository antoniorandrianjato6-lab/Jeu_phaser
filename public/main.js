// Dimensions du jeu
const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;

// Configuration Phaser
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: { preload, create, update },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);

// Variables globales
let player, cursors, bombs, bombTimer;
let score = 0, scoreText;
let lives = 3, livesText;
let gameOverText, replayText;
let isGameOver = false;

// ===============================
// 1️⃣ Préchargement des assets
// ===============================
function preload() {
  this.load.image('background', 'assets/bg.png');
  this.load.image('player', 'assets/player.png');
  this.load.image('bomb', 'assets/bomb.png');
  this.load.image('explosion', 'assets/explosion.png');
}

// ===============================
// 2️⃣ Création de la scène
// ===============================
function create() {
  // Arrière-plan
  this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'background')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

  // Réinitialisation des variables
  score = 0;
  lives = 3;
  isGameOver = false;

   // Création du joueur (après avoir chargé 'player' en preload)
  player = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 60, 'player')
    .setScale(0.5)                // -> scale visuel
    .setCollideWorldBounds(true);

  // ======= Ajuster la hitbox en fonction du scale =======
  // Utilise la taille visuelle réelle du sprite (width/height * scale)
  const playerVisualWidth  = player.width  * player.scaleX;
  const playerVisualHeight = player.height * player.scaleY;

  // Réduis légèrement la hitbox pour un gameplay plus permissif
  const playerHitboxWidth  = Math.floor(playerVisualWidth * 0.7);
  const playerHitboxHeight = Math.floor(playerVisualHeight * 0.85);

  player.body.setSize(playerHitboxWidth, playerHitboxHeight);
  // centre la hitbox sous le sprite (ajuste si ton sprite a de l'espace vide)
  player.body.setOffset(
    Math.floor((playerVisualWidth - playerHitboxWidth) / 2),
    Math.floor((playerVisualHeight - playerHitboxHeight))
  );

  player.invulnerable = false;


  // Groupe des bombes
  bombs = this.physics.add.group(   );

  // Contrôles clavier
  cursors = this.input.keyboard.createCursorKeys();
  this.keys = {
    A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
  };

  // Texte Score & Vies
  scoreText = this.add.text(10, 10, '⭐ Score: 0', { fontSize: '18px', fill: '#fff', fontFamily: 'Comic Sans MS' });
  livesText = this.add.text(GAME_WIDTH - 100, 10, '❤️ Vies: 3', { fontSize: '18px', fill: '#fff', fontFamily: 'Comic Sans MS' });

  // Collision joueur / bombes
  this.physics.add.overlap(player, bombs, hitBomb, null, this);

  // Génération régulière des bombes
  bombTimer = this.time.addEvent({
    delay: 900,
    callback: spawnBomb,
    callbackScope: this,
    loop: true
  });

  // Texte Game Over
  gameOverText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '', {
    fontSize: '32px', fill: '#ff3333', fontFamily: 'Comic Sans MS'
  }).setOrigin(0.5);

  replayText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, '', {
    fontSize: '18px', fill: '#fff', backgroundColor: '#444', padding: 8, fontFamily: 'Comic Sans MS'
  })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => { if (isGameOver) this.scene.restart(); });

  gameOverText.setVisible(false);
  replayText.setVisible(false);
}

// ===============================
// 3️⃣ Boucle du jeu (update)
// ===============================
function update() {
  if (isGameOver) return;

  const moveSpeed = 250;
  let velocityX = 0;

  // Gestion des touches
  if (cursors.left.isDown || this.keys.A.isDown) velocityX = -moveSpeed;
  if (cursors.right.isDown || this.keys.D.isDown) velocityX = moveSpeed;

  // 💡 Applique la vitesse au joueur
  player.setVelocityX(velocityX);

  // Vérifie les bombes qui sortent de l’écran
  bombs.getChildren().forEach(bomb => {
    if (bomb.y > GAME_HEIGHT + 100) {
      bomb.disableBody(true, true);
      score += 2; 
      scoreText.setText('⭐ Score: ' + score);
    }
  });
}

// ===============================
// 4️⃣ Génération des bombes
// ===============================
function spawnBomb() {
  if (isGameOver) return;

  const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
  const speed = Phaser.Math.Between(100, 300);

  // create retourne un ArcadeSprite si le groupe est un physics group
  const bomb = bombs.create(x, -30, 'bomb')
    .setScale(0.25)
    .setVelocityY(speed)
    .setAngularVelocity(Phaser.Math.Between(-180, 180))
    .setOrigin(0.5);

  // taille visuelle réelle
  const bombVisualW = bomb.width * bomb.scaleX;
  const bombVisualH = bomb.height * bomb.scaleY;

  // hitbox légèrement plus petite que la taille visuelle
  const bombHitW = Math.floor(bombVisualW * 0.75);
  const bombHitH = Math.floor(bombVisualH * 0.75);

  bomb.body.setAllowGravity(false);
  bomb.body.setSize(bombHitW, bombHitH);
  bomb.body.setOffset(
    Math.floor((bombVisualW - bombHitW) / 2),
    Math.floor((bombVisualH - bombHitH) / 2)
  );

  // si tu veux un hitbox circulaire (si la bombe est ronde), tu peux utiliser setCircle :
  const radius = Math.floor(Math.min(bombVisualW, bombVisualH) * 0.4);
  bomb.body.setCircle(radius, Math.floor((bombVisualW - radius*2)/2), Math.floor((bombVisualH - radius*2)/2));
}


// ===============================
// 5️⃣ Collision joueur / bombe
// ===============================
function hitBomb(playerObj, bombObj) {
  if (playerObj.invulnerable) return;

  bombObj.disableBody(true, true);
  lives--;
  livesText.setText('❤️ Vies: ' + lives);

  // Effet de secousse de l'ecran
  this.cameras.main.shake(200, 0.01);

  // Explosion visuelle
  const explosion = this.add.sprite(playerObj.x, playerObj.y, 'explosion')
    .setScale(0.8)
    .setAlpha(0.8);

    this.tweens.add({
        targets: explosion,
        scale: 1.2,
        alpha: 0,
        duration: 300,
        onComplete: () => explosion.destroy()
    });
    

  // Effet d’invincibilité temporaire
  playerObj.invulnerable = true;
  this.tweens.add({
    targets: playerObj,
    alpha: 0.3,
    duration: 100,
    yoyo: true,
    repeat: 6,
    onComplete: () => { 
        playerObj.alpha = 1; 
        playerObj.invulnerable = false; 
    }
  });

  // Si plus de vies -> Game Over
  if (lives <= 0) handleGameOver.call(this);
}

// ===============================
// 6️⃣ Game Over
// ===============================
function handleGameOver() {
  isGameOver = true;
  this.physics.pause();
  if (bombTimer) bombTimer.remove(false);

  gameOverText.setText('💀 GAME OVER 💀').setVisible(true);
  replayText.setText('🔁 Rejouer').setVisible(true);

  bombs.children.each(bomb => {
    if (bomb.active) bomb.disableBody(true, true);
  });
}
