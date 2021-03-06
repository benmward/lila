import { updateElements } from './clockView';
import { RoundData } from '../interfaces'
import { game } from 'game';


export type Seconds = number;
export type Centis = number;
export type Millis = number;

interface ClockOpts {
  onFlag(): void;
  soundColor?: Color
}

export type TenthsPref = 0 | 1 | 2;

export interface ClockData {
  running: boolean;
  initial: Seconds;
  increment: Seconds;
  white: Seconds;
  black: Seconds;
  emerg: Seconds;
  showTenths: TenthsPref;
  showBar: boolean;
  moretime: number;
}

interface Times {
  white: Millis;
  black: Millis;
  activeColor?: Color;
  lastUpdate: Millis;
}

type ColorMap<T> = { [C in Color]: T };

export interface ClockElements {
  time?: HTMLElement;
  clock?: HTMLElement;
  bar?: HTMLElement;
}

interface EmergSound {
  play(): void;
  next?: number;
  delay: Millis,
  playable: {
    white: boolean;
    black: boolean;
  };
}

const nowFun = window.performance && performance.now() > 0 ?
  performance.now.bind(performance) : Date.now;

export class ClockController {

  emergSound: EmergSound = {
    play: window.lichess.sound.lowtime,
    delay: 20000,
    playable: {
      white: true,
      black: true
    }
  };

  showTenths: TenthsPref;
  showBar: boolean;
  times: Times;

  timePercentDivisor: number
  emergMs: Millis;

  elements = {
    white: {},
    black: {}
  } as ColorMap<ClockElements>;

  constructor(d: RoundData, public opts: ClockOpts) {
    const cdata = d.clock!;

    this.showTenths = cdata.showTenths;
    this.showBar = cdata.showBar;
    this.timePercentDivisor = .1 / (Math.max(cdata.initial, 2) + 5 * cdata.increment);

    this.emergMs = 1000 * Math.min(60, Math.max(10, cdata.initial * .125));

    this.setClock(d, cdata.white, cdata.black);
  }

  timePercent = (millis: number): number =>
    Math.max(0, Math.min(100, millis * this.timePercentDivisor));

  setClock = (d: RoundData, white: Seconds, black: Seconds, delay: Centis = 0) => {
    const isClockRunning = game.playable(d) &&
           ((d.game.turns - d.game.startedAtTurn) > 1 || d.clock!.running);

    this.times = {
      white: white * 1000,
      black: black * 1000,
      activeColor: isClockRunning ? d.game.player : undefined,
      lastUpdate: nowFun() + delay * 10
    };
  };

  addTime = (color: Color, time: Centis): void => {
    this.times[color] += time * 10
  }

  stopClock = (): Millis|void => {
    const color = this.times.activeColor;
    if (color) {
      const curElapse = this.elapsed();
      this.times[color] = Math.max(0, this.times[color] - curElapse);
      this.times.activeColor = undefined;
      return curElapse;
    }
  }

  tick = (): void => {
    const color = this.times.activeColor;
    if (!color) return;

    const now = nowFun();
    const millis = this.times[color] - this.elapsed(now);

    if (millis <= 0) this.opts.onFlag();
    else updateElements(this, this.elements[color], millis);

    if (this.opts.soundColor === color) {
      if (this.emergSound.playable[color]) {
        if (millis < this.emergMs && !(now < this.emergSound.next!)) {
          this.emergSound.play();
          this.emergSound.next = now + this.emergSound.delay;
          this.emergSound.playable[color] = false;
        }
      } else if (millis > 1.5 * this.emergMs) {
        this.emergSound.playable[color] = true;
      }
    }
  };

  elapsed = (now = nowFun()) => Math.max(0, now - this.times.lastUpdate);

  millisOf = (color: Color): Millis => (this.times.activeColor === color ?
     Math.max(0, this.times[color] - this.elapsed()) :
     this.times[color]
  );
}
