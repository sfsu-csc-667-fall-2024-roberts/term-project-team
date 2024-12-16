export class AnimationService {
  public static readonly ANIMATION_DURATION = 500;
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private isAudioEnabled: boolean = false;

  constructor() {
    this.initializeAudio();
    this.loadSounds();
  }

  private initializeAudio(): void {
    try {
      this.audioContext = new AudioContext();
      this.isAudioEnabled = true;
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      this.isAudioEnabled = false;
    }
  }

  private async loadSounds(): Promise<void> {
    if (!this.isAudioEnabled) return;

    const soundFiles = {
      roll: '/assets/sounds/dice-roll.mp3',
      move: '/assets/sounds/move.mp3',
      buy: '/assets/sounds/buy.mp3',
      sell: '/assets/sounds/sell.mp3',
      card: '/assets/sounds/card.mp3',
      money: '/assets/sounds/money.mp3',
      jail: '/assets/sounds/jail.mp3',
      win: '/assets/sounds/win.mp3',
      lose: '/assets/sounds/lose.mp3'
    };

    for (const [name, path] of Object.entries(soundFiles)) {
      try {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
        this.sounds.set(name, audioBuffer);
      } catch (error) {
        console.warn(`Failed to load sound: ${name}`, error);
      }
    }
  }

  private playSound(name: string): void {
    if (!this.isAudioEnabled || !this.sounds.has(name)) return;

    const source = this.audioContext!.createBufferSource();
    source.buffer = this.sounds.get(name)!;
    source.connect(this.audioContext!.destination);
    source.start();
  }

  public async animatePlayerMove(
    token: HTMLElement,
    fromPosition: number,
    toPosition: number,
    isPassingGo: boolean
  ): Promise<void> {
    this.playSound('move');

    const positions: number[] = [];
    let currentPos = fromPosition;

    // Calculate path
    while (currentPos !== toPosition) {
      currentPos = (currentPos + 1) % 40;
      positions.push(currentPos);

      if (currentPos === 0 && isPassingGo) {
        await this.animatePassingGo();
      }
    }

    // Animate through each position
    for (const position of positions) {
      const space = document.querySelector(`[data-position="${position}"]`);
      if (space) {
        const rect = space.getBoundingClientRect();
        token.style.transition = `all ${AnimationService.ANIMATION_DURATION}ms ease-in-out`;
        token.style.left = `${rect.left}px`;
        token.style.top = `${rect.top}px`;
        await new Promise(resolve => setTimeout(resolve, AnimationService.ANIMATION_DURATION));
      }
    }
  }

  public async animateDiceRoll(dice: [number, number]): Promise<void> {
    this.playSound('roll');

    const diceContainer = document.createElement('div');
    diceContainer.className = 'dice-container';
    
    const die1 = document.createElement('div');
    const die2 = document.createElement('div');
    die1.className = 'die';
    die2.className = 'die';
    
    diceContainer.appendChild(die1);
    diceContainer.appendChild(die2);
    document.body.appendChild(diceContainer);

    // Animate rolling
    for (let i = 0; i < 10; i++) {
      die1.textContent = Math.floor(Math.random() * 6 + 1).toString();
      die2.textContent = Math.floor(Math.random() * 6 + 1).toString();
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Show final values
    die1.textContent = dice[0].toString();
    die2.textContent = dice[1].toString();

    // Remove after delay
    setTimeout(() => {
      diceContainer.remove();
    }, 2000);
  }

  public async animateMoneyTransaction(
    amount: number,
    fromElement: HTMLElement,
    toElement: HTMLElement
  ): Promise<void> {
    this.playSound('money');

    const moneyElement = document.createElement('div');
    moneyElement.className = 'money-animation';
    moneyElement.textContent = `$${amount}`;

    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    moneyElement.style.left = `${fromRect.left + fromRect.width / 2}px`;
    moneyElement.style.top = `${fromRect.top + fromRect.height / 2}px`;

    document.body.appendChild(moneyElement);

    // Animate to target
    requestAnimationFrame(() => {
      moneyElement.style.transform = 'scale(1)';
      moneyElement.style.left = `${toRect.left + toRect.width / 2}px`;
      moneyElement.style.top = `${toRect.top + toRect.height / 2}px`;
    });

    // Remove after animation
    setTimeout(() => {
      moneyElement.remove();
    }, AnimationService.ANIMATION_DURATION);
  }

  public async animatePropertyPurchase(property: HTMLElement): Promise<void> {
    this.playSound('buy');

    property.classList.add('purchasing');
    await new Promise(resolve => setTimeout(resolve, AnimationService.ANIMATION_DURATION));
    property.classList.remove('purchasing');
  }

  public async animateJail(playerToken: HTMLElement): Promise<void> {
    this.playSound('jail');

    const jailSpace = document.querySelector('[data-position="10"]');
    if (!jailSpace) return;

    const rect = jailSpace.getBoundingClientRect();
    playerToken.style.transition = `all ${AnimationService.ANIMATION_DURATION}ms ease-in-out`;
    playerToken.style.left = `${rect.left}px`;
    playerToken.style.top = `${rect.top}px`;

    // Add jail bars animation
    const bars = document.createElement('div');
    bars.className = 'jail-bars';
    playerToken.appendChild(bars);

    await new Promise(resolve => setTimeout(resolve, AnimationService.ANIMATION_DURATION));
  }

  public async animatePassingGo(): Promise<void> {
    this.playSound('money');

    const goSpace = document.querySelector('[data-position="0"]');
    if (!goSpace) return;

    const animation = document.createElement('div');
    animation.className = 'passing-go-animation';
    animation.textContent = '+$200';
    
    const rect = goSpace.getBoundingClientRect();
    animation.style.left = `${rect.left}px`;
    animation.style.top = `${rect.top}px`;

    document.body.appendChild(animation);

    setTimeout(() => {
      animation.remove();
    }, AnimationService.ANIMATION_DURATION);
  }

  public async animateWin(playerName: string): Promise<void> {
    this.playSound('win');

    const animation = document.createElement('div');
    animation.className = 'win-animation';
    animation.innerHTML = `
      <div class="win-content">
        <h2>🎉 Congratulations! 🎉</h2>
        <p>${playerName} wins the game!</p>
      </div>
    `;

    document.body.appendChild(animation);

    // Add confetti effect
    this.createConfetti();

    setTimeout(() => {
      animation.remove();
    }, 5000);
  }

  private createConfetti(): void {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    
    for (let i = 0; i < 100; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = `${Math.random() * 100}vw`;
      confetti.style.animationDelay = `${Math.random() * 3}s`;
      document.body.appendChild(confetti);

      setTimeout(() => {
        confetti.remove();
      }, 5000);
    }
  }
}

// Add CSS styles for animations
const style = document.createElement('style');
style.textContent = `
  .dice-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    gap: 16px;
    z-index: 1000;
  }

  .die {
    width: 60px;
    height: 60px;
    background: white;
    border: 2px solid #333;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: bold;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    animation: roll 0.5s ease-out;
  }

  @keyframes roll {
    0% { transform: rotateZ(0deg); }
    100% { transform: rotateZ(360deg); }
  }

  .money-animation {
    position: fixed;
    font-size: 24px;
    font-weight: bold;
    color: #4CAF50;
    pointer-events: none;
    transform: scale(0);
    transition: all ${AnimationService.ANIMATION_DURATION}ms ease-in-out;
    z-index: 1000;
  }

  .purchasing {
    animation: purchase ${AnimationService.ANIMATION_DURATION}ms ease-in-out;
  }

  @keyframes purchase {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }

  .jail-bars {
    position: absolute;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 4px,
      #333 4px,
      #333 6px
    );
    animation: jail-in ${AnimationService.ANIMATION_DURATION}ms ease-in-out;
  }

  @keyframes jail-in {
    from { opacity: 0; transform: scaleY(0); }
    to { opacity: 1; transform: scaleY(1); }
  }

  .passing-go-animation {
    position: fixed;
    font-size: 32px;
    font-weight: bold;
    color: #4CAF50;
    pointer-events: none;
    animation: passing-go ${AnimationService.ANIMATION_DURATION}ms ease-in-out;
    z-index: 1000;
  }

  @keyframes passing-go {
    0% { transform: translateY(0) scale(0); opacity: 0; }
    50% { transform: translateY(-30px) scale(1.2); opacity: 1; }
    100% { transform: translateY(-60px) scale(1); opacity: 0; }
  }

  .win-animation {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.8);
    z-index: 2000;
    animation: fade-in 0.5s ease-in-out;
  }

  .win-content {
    background: white;
    padding: 32px;
    border-radius: 16px;
    text-align: center;
    animation: pop-in 0.5s ease-in-out;
  }

  .confetti {
    position: fixed;
    width: 10px;
    height: 10px;
    pointer-events: none;
    animation: confetti-fall 5s linear forwards;
    z-index: 1999;
  }

  @keyframes confetti-fall {
    0% { transform: translateY(-100vh) rotate(0deg); }
    100% { transform: translateY(100vh) rotate(360deg); }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes pop-in {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
`;

document.head.appendChild(style); 