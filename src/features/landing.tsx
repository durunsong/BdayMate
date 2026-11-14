'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Bell,
  Cake,
  Check,
  Gift,
  Heart,
  Mail,
  Moon,
  Pause,
  Play,
  Sun,
} from 'lucide-react';
import { Brand } from '@/components/app-shell';
import { Button } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-provider';
import './landing.css';

function BirthdayScene() {
  return (
    <figure
      className="landing-scene"
      aria-label="重要的人围绕生日日历的产品示意"
    >
      <div className="landing-scene-art" aria-hidden="true">
        <div className="landing-orbit landing-orbit-outer" />
        <div className="landing-orbit landing-orbit-inner" />
        <div className="landing-orbit-traveler">
          <span />
        </div>
        <span className="landing-orbit-label">
          A LITTLE REMINDER. A LOT OF LOVE.
        </span>
        <div className="landing-paper-shadow" />
        <div className="landing-calendar-paper">
          <div className="landing-calendar-rings">
            <i />
            <i />
          </div>
          <div className="landing-paper-top">
            <span>JUNE</span>
            <Sun size={21} />
          </div>
          <div className="landing-paper-date">
            18<span>周四 · 好日子</span>
          </div>
          <svg
            className="landing-date-circle"
            viewBox="0 0 240 190"
            fill="none"
          >
            <path d="M200 34C158 4 58 12 31 60C-2 120 36 171 107 173C172 176 222 145 224 92C226 43 190 15 146 14" />
          </svg>
          <div className="landing-paper-footer">
            <Cake size={19} />
            <span>今天，记得说生日快乐。</span>
          </div>
        </div>
        <div className="landing-person landing-person-family">
          <span className="landing-person-avatar">
            <Heart size={21} />
          </span>
          <div>
            <b>妈妈的生日</b>
            <small>农历，也好好记着</small>
          </div>
          <Moon size={15} />
        </div>
        <div className="landing-person landing-person-friend">
          <span className="landing-person-avatar">
            <Gift size={21} />
          </span>
          <div>
            <b>老朋友的心愿</b>
            <small>那本聊了很久的书</small>
          </div>
        </div>
        <div className="landing-note">
          <Bell size={17} />
          <span>提前一点，准备心意。</span>
          <Check size={15} />
        </div>
        <svg
          className="landing-spark landing-spark-one"
          viewBox="0 0 64 64"
          fill="none"
        >
          <path d="M32 3V61M3 32H61M11 11L53 53M11 53L53 11" />
        </svg>
        <svg
          className="landing-spark landing-spark-two"
          viewBox="0 0 64 64"
          fill="none"
        >
          <path d="M32 5C32 24 24 32 5 32C24 32 32 40 32 59C32 40 40 32 59 32C40 32 32 24 32 5Z" />
        </svg>
        <span className="landing-confetti landing-confetti-one" />
        <span className="landing-confetti landing-confetti-two" />
        <span className="landing-confetti landing-confetti-three" />
      </div>
      <figcaption>产品示意 · 每一种在乎，都有自己的位置</figcaption>
    </figure>
  );
}

function CalendarDemo() {
  const [calendar, setCalendar] = useState<'solar' | 'lunar'>('solar');
  const lunar = calendar === 'lunar';
  return (
    <section
      id="how-it-works"
      className="landing-demo landing-container"
      data-reveal
    >
      <div className="landing-section-copy">
        <h2>
          他们记生日的方式，
          <br />
          <span>我们都懂。</span>
        </h2>
        <p>
          有人过六月十八，有人认八月十五。记下对方习惯的日期，剩下的换算，交给生日搭子。
        </p>
        <div
          className="landing-demo-switch"
          role="group"
          aria-label="生日历法演示"
        >
          <button
            type="button"
            aria-pressed={!lunar}
            onClick={() => setCalendar('solar')}
          >
            <Sun size={18} />
            公历生日
          </button>
          <button
            type="button"
            aria-pressed={lunar}
            onClick={() => setCalendar('lunar')}
          >
            <Moon size={18} />
            农历生日
          </button>
        </div>
        <p className="landing-demo-hint">点击切换，看看两种生日怎样被记住。</p>
      </div>
      <div className="landing-demo-stage" data-calendar={calendar}>
        <div className="landing-demo-orbit" aria-hidden="true">
          <span />
        </div>
        <div className="landing-demo-illustration" aria-hidden="true">
          <Sun className="landing-demo-sun" size={42} strokeWidth={1.4} />
          <Moon className="landing-demo-moon" size={48} strokeWidth={1.4} />
        </div>
        <div
          className="landing-demo-date"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="landing-demo-calendar-name">
            {lunar ? '农历 · 记住传统的日子' : '公历 · 记住熟悉的日期'}
          </span>
          <strong key={calendar}>
            {lunar ? (
              <>
                <span>八月</span>十五
              </>
            ) : (
              <>
                06<span className="landing-date-slash">/</span>18
              </>
            )}
          </strong>
          <div className="landing-demo-rule">
            <span className="landing-rule-dot" />
            {lunar ? '每年重新换算对应的公历日期' : '每年，同一个月，同一天'}
          </div>
          <p>
            {lunar
              ? '闰月与大小月，也有明确的处理方式。'
              : '2 月 29 日，也可以设定自己的庆祝方式。'}
          </p>
        </div>
        <span className="landing-demo-caption">交互示例，不会创建联系人</span>
      </div>
    </section>
  );
}

function CelebrationDrawing() {
  return (
    <svg
      className="landing-celebration-drawing"
      viewBox="0 0 480 430"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="246"
        cy="350"
        rx="172"
        ry="26"
        className="landing-drawing-shadow"
      />
      <g className="landing-gift-back">
        <path
          d="M267 199L387 170L406 296L285 324Z"
          className="landing-drawing-indigo"
        />
        <path
          d="M255 173L389 141L396 180L263 213Z"
          className="landing-drawing-purple"
        />
        <path
          d="M319 158L341 153L367 305L345 310Z"
          className="landing-drawing-ribbon"
        />
        <path
          d="M331 159C281 142 279 108 300 108C319 106 331 140 331 159ZM332 159C367 114 396 107 401 124C408 148 356 159 332 159Z"
          className="landing-drawing-line"
        />
      </g>
      <g className="landing-envelope">
        <path
          d="M90 206L248 180L271 325L114 350Z"
          className="landing-drawing-peach"
        />
        <path
          d="M89 206L178 253L249 181M114 349L166 264M269 323L192 260"
          className="landing-drawing-fold"
        />
        <path
          d="M144 180L148 136L287 145L277 249L248 271"
          className="landing-drawing-note"
        />
        <path
          d="M171 166L256 173M169 182L247 189M167 198L217 202"
          className="landing-drawing-writing"
        />
        <path
          d="M171 263C154 245 137 260 150 273L176 292L194 268C205 253 184 243 171 263Z"
          className="landing-drawing-heart"
        />
      </g>
      <g
        className="landing-drawing-stars"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M102 104V130M89 117H115M365 61V85M353 73H377" />
        <path d="M70 174L59 169M239 92L246 81M417 236L428 241M313 370L318 381" />
        <circle cx="168" cy="76" r="5" />
        <circle cx="409" cy="113" r="4" />
      </g>
    </svg>
  );
}

export function Landing({ signedIn }: { signedIn: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const destination = signedIn ? '/dashboard' : '/register';

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in-view');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.16 },
    );
    root
      .querySelectorAll('[data-reveal]')
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className="landing"
      data-motion={paused ? 'paused' : 'running'}
    >
      <a className="skip-link" href="#landing-main">
        跳到主要内容
      </a>
      <header className="landing-header landing-container">
        <Brand href="/" />
        <nav aria-label="首页导航" className="landing-nav">
          <a href="#how-it-works">怎么记</a>
          <a href="#little-things">不止记得</a>
        </nav>
        <div className="landing-header-actions">
          <ThemeToggle />
          <Link
            className="landing-login"
            href={signedIn ? '/dashboard' : '/login'}
          >
            {signedIn ? '进入工作台' : '登录'}
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>
      <main id="landing-main">
        <section
          className="landing-hero landing-container"
          aria-labelledby="landing-title"
        >
          <div className="landing-hero-copy">
            <h1 id="landing-title">
              把在乎，
              <br />
              放进
              <span className="landing-title-word">
                日历。
                <svg viewBox="0 0 300 23" fill="none" aria-hidden="true">
                  <path d="M4 16C80 3 177 2 291 10M36 21C108 11 192 10 265 15" />
                </svg>
              </span>
            </h1>
            <p className="landing-hero-english">Never Miss a Special Day.</p>
            <p className="landing-hero-description">
              忙碌的日子里，总有一些人值得你记得。
              <br />
              公历、农历、提前提醒，把每一份心意，
              <br className="landing-desktop-break" />
              留给刚刚好的那一天。
            </p>
            <div className="landing-hero-actions">
              <Button asChild className="landing-primary-cta">
                <Link href={destination}>
                  {signedIn ? '回到我的生日日历' : '开始记住重要的人'}
                  <ArrowRight size={19} />
                </Link>
              </Button>
              <a className="landing-preview-link" href="#how-it-works">
                先体验一下
                <ArrowDown size={17} />
              </a>
            </div>
            <span className="landing-hero-note">
              <Heart size={14} />
              生日你来记，心意慢慢准备。
            </span>
          </div>
          <BirthdayScene />
          <div className="landing-hero-bottom">
            <a href="#how-it-works">
              <span className="landing-scroll-line" />
              向下，发现一点小心意
            </a>
            <button
              type="button"
              className="landing-motion-toggle"
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
              {paused ? '播放装饰动效' : '暂停装饰动效'}
            </button>
          </div>
        </section>
        <div className="landing-promise-strip" aria-label="生日搭子的功能">
          <div className="landing-container">
            <span>
              <Sun size={17} />
              公历与农历
            </span>
            <span>
              <Bell size={17} />
              提前邮件提醒
            </span>
            <span>
              <Gift size={17} />
              礼物与祝福
            </span>
            <span>
              <Heart size={17} />
              只属于你的生日簿
            </span>
          </div>
        </div>
        <CalendarDemo />
        <section id="little-things" className="landing-ritual" data-reveal>
          <div className="landing-container landing-ritual-inner">
            <div className="landing-ritual-art">
              <CelebrationDrawing />
              <p>
                小事放在心上，
                <br />
                <span>就是一件很大的事。</span>
              </p>
            </div>
            <div className="landing-section-copy landing-ritual-copy">
              <h2>
                不止一句，
                <br />
                <span>生日快乐。</span>
              </h2>
              <p>
                从想起那个人，到准备好惊喜。那些微小而认真的念头，都有地方安放。
              </p>
              <div className="landing-feature-lines">
                {[
                  {
                    icon: Bell,
                    title: '让提醒，先到一步',
                    copy: '提前几天、几点提醒，都由你决定。邮件发给自己，为准备留出时间。',
                  },
                  {
                    icon: Gift,
                    title: '记下随口提起的喜欢',
                    copy: '想送的礼物、预算和往年的心意，留在联系人身边，下次不用重新想。',
                  },
                  {
                    icon: Mail,
                    title: '让祝福，带着你的语气',
                    copy: '收藏自己的祝福语；也可为单个联系人主动开启生日祝福邮件。',
                  },
                ].map(({ icon: Icon, title, copy }, index) => (
                  <div
                    className="landing-feature-line"
                    key={title}
                    style={
                      { '--feature-delay': `${index * 100}ms` } as CSSProperties
                    }
                  >
                    <Icon size={22} strokeWidth={1.6} />
                    <div>
                      <h3>{title}</h3>
                      <p>{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="landing-close landing-container" data-reveal>
          <div className="landing-close-line" aria-hidden="true">
            <span />
            <Heart size={23} strokeWidth={1.4} />
            <span />
          </div>
          <h2>
            下一个特别的日子，
            <br />
            从今天开始记得。
          </h2>
          <p>先写下一个名字。剩下的，和生日搭子一起慢慢准备。</p>
          <Button asChild className="landing-primary-cta">
            <Link href={destination}>
              {signedIn ? '打开我的工作台' : '创建我的生日簿'}
              <ArrowRight size={19} />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="landing-footer landing-container">
        <Brand href="/" />
        <p>为重要的人，留一点心。</p>
        <a href="#landing-title">
          回到顶部
          <ArrowRight size={15} />
        </a>
      </footer>
    </div>
  );
}
