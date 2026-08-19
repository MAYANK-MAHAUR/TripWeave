import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Filter,
  Menu,
  Network,
  Play,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import './styles.css';

gsap.registerPlugin(ScrollTrigger);

const supplierRows = [
  {
    id: 'ALT-IN-MH-042',
    title: '6061-T6 aluminium sheet / 2 mm / 1250 × 2500',
    authority: 'Pragati Metals & Alloys',
    category: 'India',
    location: 'Pune, Maharashtra',
    value: '₹2,460 / sheet',
    deadline: '3 days',
    match: 96,
    reasons: ['840 sheets available now', 'MOQ 25 sheets', 'Landed cost includes freight'],
  },
  {
    id: 'ALT-IN-GJ-117',
    title: 'AA6061 aluminium plate / 2 mm / cut-to-size',
    authority: 'Shreeji Industrial Supply',
    category: 'India',
    location: 'Ahmedabad, Gujarat',
    value: '₹2,390 / sheet',
    deadline: '5 days',
    match: 91,
    reasons: ['1,200 sheet equivalent', 'MOQ 50 sheets', 'Lowest normalized unit cost'],
  },
  {
    id: 'ALT-SG-009',
    title: 'Al 6061 flat sheet / 2 mm / export stock',
    authority: 'Eastern Alloy Trading',
    category: 'Regional',
    location: 'Jurong, Singapore',
    value: '₹2,780 / sheet',
    deadline: '7 days',
    match: 84,
    reasons: ['640 sheets available', 'MOQ 20 sheets', 'Import and freight normalized'],
  },
  {
    id: 'ALT-DE-031',
    title: 'EN AW-6061 sheet / 2 mm / certified mill stock',
    authority: 'NordWerk Materials GmbH',
    category: 'Global',
    location: 'Hamburg, Germany',
    value: '₹3,180 / sheet',
    deadline: '12 days',
    match: 79,
    reasons: ['Full mill certificates', 'MOQ 10 sheets', 'Longer international lead time'],
  },
];

const sourceNodes = [
  ['WEST INDIA', '04', 'healthy'],
  ['SOUTH INDIA', '03', 'healthy'],
  ['SOUTHEAST ASIA', '02', 'repairing'],
  ['EUROPE', '03', 'healthy'],
];

function BracketLink({ children, href = '#', onClick, className = '' }) {
  return (
    <a className={`bracket-link ${className}`} href={href} onClick={onClick}>
      <span>{children}</span>
      <span className="bracket-mark" aria-hidden="true">[ <ArrowUpRight /> ]</span>
    </a>
  );
}

function SignalCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: 0.7, y: 0.35 };
    let raf = 0;
    let time = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const move = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / rect.width;
      pointer.y = (event.clientY - rect.top) / rect.height;
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      time += reduced ? 0 : 0.008;

      const grid = Math.max(38, Math.min(68, width / 18));
      context.lineWidth = 1;
      context.strokeStyle = 'rgba(255,255,255,0.09)';
      for (let x = 0; x <= width + grid; x += grid) {
        context.beginPath();
        for (let y = 0; y <= height; y += 12) {
          const dx = x - pointer.x * width;
          const dy = y - pointer.y * height;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const pull = Math.max(0, 1 - distance / 220);
          const px = x + Math.sin(time * 3 + y * 0.018) * 2 + dx * pull * 0.05;
          if (y === 0) context.moveTo(px, y);
          else context.lineTo(px, y);
        }
        context.stroke();
      }

      for (let y = 0; y <= height + grid; y += grid) {
        context.beginPath();
        for (let x = 0; x <= width; x += 12) {
          const dx = x - pointer.x * width;
          const dy = y - pointer.y * height;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const pull = Math.max(0, 1 - distance / 220);
          const py = y + Math.cos(time * 2.5 + x * 0.014) * 2 + dy * pull * 0.05;
          if (x === 0) context.moveTo(x, py);
          else context.lineTo(x, py);
        }
        context.stroke();
      }

      const cx = pointer.x * width;
      const cy = pointer.y * height;
      context.strokeStyle = 'rgba(73, 119, 255, 0.85)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(cx, cy, 70 + Math.sin(time * 4) * 4, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(cx - 90, cy);
      context.lineTo(cx + 90, cy);
      context.moveTo(cx, cy - 90);
      context.lineTo(cx, cy + 90);
      context.stroke();

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', move);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', move);
    };
  }, []);

  return <canvas ref={canvasRef} className="signal-canvas" aria-hidden="true" />;
}

function Navigation() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Resilix home" onClick={close}>
        <span className="brand-sigil"><Radio /></span>
        <span>RESILIX<sup>/</sup>OS</span>
      </a>
      <nav className={open ? 'nav-links nav-open' : 'nav-links'} aria-label="Primary navigation">
        <a href="#intelligence" onClick={close}>Recovery system</a>
        <a href="#recovery" onClick={close}>Live recovery</a>
        <a href="#sources" onClick={close}>Supplier network</a>
        <BracketLink href="#matches" onClick={close}>Open shortlist</BracketLink>
      </nav>
      <button
        className="icon-button menu-button"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? <X /> : <Menu />}
      </button>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-content">
        <p className="eyebrow hero-eyebrow">Autonomous B2B sourcing recovery</p>
        <h1 className="hero-title" aria-label="Resilix Recovery">
          <span>RESILIX</span>
          <span className="outline-word">RECOVERY</span>
        </h1>
        <div className="hero-bottom">
          <div className="hero-copy">
            <p className="hero-thesis">When a frequently used part runs out at your primary vendor, production should not stop while your team calls supplier after supplier.</p>
            <p className="hero-problem">Resilix detects the stockout, searches regional supplier sites, standardizes every offer, and returns the best replacement inventory before the shortage becomes downtime.</p>
          </div>
          <div className="hero-actions">
            <a className="primary-button" href="#matches">
              <Search /> View backup suppliers
            </a>
            <a className="text-link" href="#recovery">
              Run recovery story <ArrowDown />
            </a>
          </div>
        </div>
      </div>
      <div className="hero-status" aria-label="Live recovery status">
        <div><span>Primary vendor</span><strong>Stockout</strong></div>
        <div><span>Suppliers scanned</span><strong>12</strong></div>
        <div><span>Recovery time</span><strong>47 sec</strong></div>
      </div>
      <div className="scroll-cue"><span>SCROLL TO TRACE</span><ArrowDown /></div>
    </section>
  );
}

function StatementSection() {
  return (
    <section className="statement section-shell" id="intelligence">
      <div className="section-index">
        <span>01</span>
        <span>THE PROBLEM</span>
      </div>
      <div className="statement-main">
        <h2 className="reveal-title">One stockout should not stop an entire production line.</h2>
        <p>
          Procurement teams lose days searching fragmented regional catalogs after a critical component disappears. Resilix turns that emergency into an automated recovery run across long-tail supplier sites.
        </p>
      </div>
      <div className="system-metrics">
        <div className="metric-block"><strong data-value="12">12</strong><span>Regional supplier portals</span></div>
        <div className="metric-block"><strong>04</strong><span>Offer formats normalized</span></div>
        <div className="metric-block"><strong>&lt;60s</strong><span>Target recovery window</span></div>
      </div>
      <div className="architecture-rail" aria-label="System workflow">
        {['Detect stockout', 'Fan out sourcing', 'Normalize offers', 'Rank backups'].map((item, index) => (
          <div className="architecture-step" key={item}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{item}</p>
            {index < 3 && <ArrowRight />}
          </div>
        ))}
      </div>
    </section>
  );
}

function MatchConsole() {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(supplierRows[0].id);
  const filters = ['All', 'India', 'Regional', 'Global'];
  const visibleRows = useMemo(
    () => (filter === 'All' ? supplierRows : supplierRows.filter((row) => row.category === filter)),
    [filter],
  );
  const current = supplierRows.find((row) => row.id === selected) || visibleRows[0];

  useEffect(() => {
    if (visibleRows.length && !visibleRows.some((row) => row.id === selected)) setSelected(visibleRows[0].id);
  }, [visibleRows, selected]);

  return (
    <section className="match-section" id="matches">
      <div className="match-header section-shell">
        <div className="section-index light-index"><span>02</span><span>THE SHORTLIST</span></div>
        <div>
          <p className="eyebrow">Recovery run / aluminium sheet 6061-T6</p>
          <h2>Three verified backups.<br />No production guesswork.</h2>
        </div>
        <p className="match-intro">Normalized offers ranked on available stock, total landed cost, lead time, and supplier signal.</p>
      </div>

      <div className="console-shell">
        <div className="console-toolbar">
          <div className="console-brand"><Radio /><span>LIVE RECOVERY INDEX</span></div>
          <div className="filter-tabs" role="group" aria-label="Filter supplier regions">
            {filters.map((item) => (
              <button
                className={filter === item ? 'filter-tab active' : 'filter-tab'}
                type="button"
                key={item}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <button className="icon-button console-filter" type="button" aria-label="More filters" title="More filters"><Filter /></button>
        </div>

        <div className="console-grid">
          <div className="tender-list" role="list" aria-label="Backup suppliers">
            <div className="list-heading"><span>{visibleRows.length} BACKUP SOURCES</span><span>FIT</span></div>
            {visibleRows.map((row) => (
              <button
                className={selected === row.id ? 'tender-row selected' : 'tender-row'}
                type="button"
                key={row.id}
                onClick={() => setSelected(row.id)}
              >
                <span className="row-source">{row.authority}</span>
                <span className="row-title">{row.title}</span>
                <span className="row-meta">{row.location} / arrives in {row.deadline}</span>
                <span className="row-score">{row.match}<small>%</small></span>
                <ArrowRight className="row-arrow" />
              </button>
            ))}
          </div>

          {current && (
            <aside className="match-detail" aria-live="polite">
              <div className="detail-topline"><span>{current.id}</span><span className="verified"><ShieldCheck /> VERIFIED SOURCE</span></div>
              <h3>{current.title}</h3>
              <p className="detail-authority">{current.authority}</p>
              <div className="detail-value"><span>Total landed cost</span><strong>{current.value}</strong></div>
              <div className="confidence-wrap">
                <div><span>Recovery fit</span><strong>{current.match}%</strong></div>
                <div className="confidence-track"><span style={{ width: `${current.match}%` }} /></div>
              </div>
              <div className="reason-list">
                <span className="detail-label">WHY THIS BACKUP WINS</span>
                {current.reasons.map((reason) => <p key={reason}><Check />{reason}</p>)}
              </div>
              <button className="primary-button detail-button" type="button">
                Review supplier <ArrowUpRight />
              </button>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

function RepairLoop() {
  const [status, setStatus] = useState('idle');
  const [stage, setStage] = useState(4);
  const [logs, setLogs] = useState([
    ['18:42:08', 'rank', '3 backup suppliers ready for review'],
    ['18:42:07', 'normalize', 'units, currency, MOQ, lead times standardized'],
    ['18:41:52', 'trigger', 'primary vendor marked aluminium sheet out of stock'],
  ]);
  const timers = useRef([]);
  const stages = ['Stockout detected', 'Fan out suppliers', 'Heal failed source', 'Normalize offers', 'Rank backups'];

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const simulate = () => {
    if (status === 'running') return;
    timers.current.forEach(clearTimeout);
    setStatus('running');
    setStage(0);
    setLogs([['NOW', 'trigger', 'primary vendor now shows OUT OF STOCK'], ['NOW', 'component', '6061-T6 aluminium sheet / 2 mm']]);

    const events = [
      ['+02s', 'fan-out', '12 regional supplier pages queued'],
      ['+05s', 'self-heal', 'one supplier page changed; extraction repaired'],
      ['+09s', 'normalize', 'per-case, per-sheet and USD offers converted'],
      ['+13s', 'rank', 'price, stock, lead time and reliability scored'],
      ['+16s', 'ready', '3 verified alternatives delivered'],
    ];

    events.forEach((entry, index) => {
      const timer = setTimeout(() => {
        setStage(index);
        setLogs((previous) => [entry, ...previous].slice(0, 6));
        if (index === events.length - 1) setStatus('complete');
      }, index * 900 + 500);
      timers.current.push(timer);
    });
  };

  return (
    <section className="repair-section" id="recovery">
      <div className="repair-content section-shell">
        <div className="section-index light-index"><span>03</span><span>LIVE RECOVERY</span></div>
        <div className="repair-heading">
          <p className="eyebrow">The moment the primary vendor fails</p>
          <h2>Resilix fans out, cleans the mess, and hands procurement a real backup plan.</h2>
          <p>When aluminium sheet disappears from the primary vendor, Resilix searches long-tail supplier portals, heals a source if its page has changed, converts inconsistent units and currencies, and ranks the alternatives a production team can act on now.</p>
        </div>

        <div className="repair-console">
          <div className="repair-console-header">
            <div><span className={status === 'running' ? 'status-lamp warning' : 'status-lamp'} /> RECOVERY RUN / PRIMARY VENDOR A-17</div>
            <div>{status === 'running' ? 'FAN-OUT IN PROGRESS' : status === 'complete' ? 'BACKUPS READY' : 'MONITORING'}</div>
          </div>
          <div className="repair-stages">
            {stages.map((item, index) => (
              <div className={`repair-stage ${stage >= index ? 'stage-active' : ''}`} key={item}>
                <span>{stage > index || status === 'complete' ? <Check /> : String(index + 1).padStart(2, '0')}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
          <div className="log-window">
            <div className="log-heading"><span>EVENT STREAM</span><span>AUTO-SCROLL / ON</span></div>
            <div className="logs">
              {logs.map(([time, type, message], index) => (
                <div className="log-line" key={`${time}-${type}-${index}`}>
                  <span>{time}</span><span className={type === 'alert' ? 'log-type alert' : 'log-type'}>{type}</span><p>{message}</p>
                </div>
              ))}
            </div>
          </div>
          <button className="simulate-button" type="button" onClick={simulate} disabled={status === 'running'}>
            {status === 'running' ? <><Sparkles /> Recovering supply...</> : status === 'complete' ? <><Play /> Run recovery again</> : <><Zap /> Simulate stockout</>}
          </button>
          <p className="repair-footnote">Resilix keeps procurement moving when the primary source cannot.</p>
        </div>
      </div>
    </section>
  );
}

function SourceMap() {
  return (
    <section className="source-section source-immersive" id="sources">
      <img className="source-bg" src="/images/earth-premium.avif" alt="Earth's horizon seen from orbit" />
      <div className="source-bg-shade" />
      <div className="source-grid" aria-hidden="true" />
      <div className="source-ambient-label"><Network /><span>REGIONAL SUPPLIER NETWORK / LIVE</span></div>
      <div className="source-section-index section-index light-index"><span>04</span><span>SUPPLIER NETWORK</span></div>
      <div className="source-copy source-copy-light">
        <p className="eyebrow">One operating picture</p>
        <h2>Long-tail suppliers.<br />One recovery picture.</h2>
        <p className="source-thesis">Regional vendors list stock in different units, currencies, and formats. Resilix turns that fragmented supply into one comparable shortlist.</p>
      </div>
      <div className="source-table source-table-light">
        <div className="source-table-head"><span>REGION</span><span>LISTINGS FOUND</span><span>STATE</span></div>
        {sourceNodes.map(([name, count, state]) => (
          <div className="source-line" key={name}>
            <span>{name}</span><strong>{count}</strong>
            <span className={state === 'repairing' ? 'state repairing' : 'state'}><i />{state}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-signal"><Radio /><span>RECOVERY SYSTEM READY</span></div>
      <div className="footer-title">RESILIX<sup>/</sup>OS</div>
      <div className="footer-grid">
        <p>Autonomous B2B sourcing recovery for production teams under pressure.</p>
        <div><span>PROTOTYPE</span><strong>SCRAPE-VERSE / 2026</strong></div>
        <a href="#top">BACK TO TOP <ArrowUpRight /></a>
      </div>
    </footer>
  );
}

function App() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = new Lenis({ duration: reduced ? 0 : 1.05, smoothWheel: !reduced });
    let rafId;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    lenis.on('scroll', ScrollTrigger.update);

    if (!reduced) {
      const context = gsap.context(() => {
        gsap.from('.hero-title > span', { yPercent: 115, opacity: 0, duration: 1.15, stagger: 0.12, ease: 'power4.out', delay: 0.15 });
        gsap.from('.hero-thesis, .hero-actions', { y: 28, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', delay: 0.65 });
        gsap.utils.toArray('.reveal-title, .match-header h2, .repair-heading h2, .source-copy h2').forEach((element) => {
          gsap.from(element, {
            y: 70,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: { trigger: element, start: 'top 86%', once: true },
          });
        });
        gsap.to('.hero-image', {
          scale: 1.12,
          yPercent: 8,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });
        gsap.from('.architecture-step', {
          x: -32,
          opacity: 0,
          stagger: 0.12,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: { trigger: '.architecture-rail', start: 'top 85%', once: true },
        });
        gsap.from('.source-line', {
          x: 24,
          opacity: 0,
          stagger: 0.1,
          scrollTrigger: { trigger: '.source-table', start: 'top 84%', once: true },
        });
      });

      return () => {
        context.revert();
        cancelAnimationFrame(rafId);
        lenis.destroy();
      };
    }

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <StatementSection />
        <MatchConsole />
        <RepairLoop />
        <SourceMap />
      </main>
      <Footer />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
