import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarPlus, Check, Filter, Menu, Network, Play, Radio, Search, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import './styles.css';

gsap.registerPlugin(ScrollTrigger);

const hackathons = [
  { id: 'DEVPOST-AI-042', title: 'Google AI Studio Developer Challenge', platform: 'Devpost', category: 'AI', location: 'Online / Global', prize: '$50,000 in prizes', deadline: '26 days left', match: 96, reasons: ['React + Gemini stack match', 'Open worldwide', 'Team size 1–4 builders'] },
  { id: 'DEVFOLIO-OSS-117', title: 'Hack the Mountain 7.0', platform: 'Devfolio', category: 'Open source', location: 'Dehradun, India / Hybrid', prize: '$18,000 prize pool', deadline: '12 days left', match: 91, reasons: ['Strong open-source fit', 'Travel distance considered', 'Registration still open'] },
  { id: 'DORA-ZK-009', title: 'ZK Frontier Buildathon', platform: 'DoraHacks', category: 'Web3', location: 'Online / Global', prize: '$100,000 grant pool', deadline: '34 days left', match: 84, reasons: ['TypeScript accepted', 'Global remote event', 'Smart-contract role recommended'] },
  { id: 'UNSTOP-CLOUD-031', title: 'Cloud Native Innovation Sprint', platform: 'Unstop', category: 'Cloud', location: 'Bengaluru, India / In-person', prize: '$12,500 in prizes', deadline: '8 days left', match: 79, reasons: ['Cloud deployment experience fit', 'In-person final round', 'Team size 2–4 builders'] },
];

const sourceNodes = [['DEVPOST', '18', 'healthy'], ['DEVFOLIO', '11', 'healthy'], ['DORAHACKS', '08', 'repairing'], ['UNSTOP', '05', 'healthy']];

function BracketLink({ children, href = '#', onClick, className = '' }) {
  return <a className={`bracket-link ${className}`} href={href} onClick={onClick}><span>{children}</span><span className="bracket-mark" aria-hidden="true">[ <ArrowUpRight /> ]</span></a>;
}

function Navigation() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="BuildRadar home" onClick={close}><span className="brand-sigil"><Radio /></span><span>BUILDRADAR</span></a>
      <nav className={open ? 'nav-links nav-open' : 'nav-links'} aria-label="Primary navigation">
        <a href="#intelligence" onClick={close}>How it works</a><a href="#matches" onClick={close}>Live matches</a><a href="#healing" onClick={close}>Self-healing</a><BracketLink href="#sources" onClick={close}>Data sources</BracketLink>
      </nav>
      <button className="icon-button menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X /> : <Menu />}</button>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <img className="hero-image" src="/images/earth-premium.avif" alt="Earth at night, representing hackathons discovered worldwide" />
      <div className="hero-scrim" aria-hidden="true" /><div className="hero-grid" aria-hidden="true" />
      <div className="hero-topline"><span><i className="live-dot" />42 active events indexed</span><span>Last sweep / 2 min ago / UTC</span></div>
      <div className="hero-content">
        <p className="eyebrow hero-eyebrow">Global hackathon intelligence</p>
        <h1 className="hero-title" aria-label="BuildRadar Find your next build"><span>BUILD</span><span className="outline-word">RADAR</span></h1>
        <div className="hero-bottom">
          <div className="hero-copy"><p className="hero-thesis">Every hackathon worth building for. One live, searchable signal.</p><p className="hero-problem">BuildRadar scans fragmented event platforms, standardizes deadlines and prize pools, then ranks every opportunity against your skills and availability.</p></div>
          <div className="hero-actions"><a className="primary-button" href="#matches"><Search /> Explore live matches</a><a className="text-link" href="#healing">See the scraper heal <ArrowDown /></a></div>
        </div>
      </div>
      <div className="hero-status" aria-label="BuildRadar index status"><div><span>Prize pools tracked</span><strong>$1.45M</strong></div><div><span>Sources live</span><strong>4 / 4</strong></div><div><span>Next deadline</span><strong>08 days</strong></div></div>
      <div className="scroll-cue"><span>Scroll to scan</span><ArrowDown /></div>
    </section>
  );
}

function StatementSection() {
  return (
    <section className="statement section-shell" id="intelligence">
      <div className="section-index"><span>01</span><span>The signal</span></div>
      <div className="statement-main"><h2 className="reveal-title">Stop hunting across tabs. Start building the right thing.</h2><p>Hackathons live across incompatible platforms with different filters, date formats, and event schemas. BuildRadar converts that scattered public web data into one reliable opportunity feed for developers, founders, and student teams.</p></div>
      <div className="system-metrics"><div className="metric-block"><strong>42</strong><span>Active events indexed</span></div><div className="metric-block"><strong>04</strong><span>Platforms normalized</span></div><div className="metric-block"><strong>1</strong><span>Builder-ready schema</span></div></div>
      <div className="architecture-rail" aria-label="BuildRadar workflow">{['Scrape platforms', 'Normalize events', 'Match your skills', 'Never miss the date'].map((item, index) => <div className="architecture-step" key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p>{index < 3 && <ArrowRight />}</div>)}</div>
    </section>
  );
}

function MatchConsole() {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(hackathons[0].id);
  const filters = ['All', 'AI', 'Open source', 'Web3', 'Cloud'];
  const visibleRows = useMemo(() => filter === 'All' ? hackathons : hackathons.filter((event) => event.category === filter), [filter]);
  const current = hackathons.find((event) => event.id === selected) || visibleRows[0];
  useEffect(() => { if (visibleRows.length && !visibleRows.some((event) => event.id === selected)) setSelected(visibleRows[0].id); }, [visibleRows, selected]);
  return (
    <section className="match-section" id="matches">
      <div className="match-header section-shell"><div className="section-index light-index"><span>02</span><span>Your matches</span></div><div><p className="eyebrow">Profile / React · AI · Cloud</p><h2>Less searching.<br />More shipping.</h2></div><p className="match-intro">Events ranked by your stack, location, format, eligibility, deadline, and the kind of role your team still needs.</p></div>
      <div className="console-shell">
        <div className="console-toolbar"><div className="console-brand"><Radio /><span>Live opportunity index</span></div><div className="filter-tabs" role="group" aria-label="Filter events by technology">{filters.map((item) => <button className={filter === item ? 'filter-tab active' : 'filter-tab'} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><button className="icon-button console-filter" type="button" aria-label="More event filters" title="More filters"><Filter /></button></div>
        <div className="console-grid">
          <div className="tender-list" role="list" aria-label="Recommended hackathons"><div className="list-heading"><span>{visibleRows.length} opportunities</span><span>Match</span></div>{visibleRows.map((event) => <button className={selected === event.id ? 'tender-row selected' : 'tender-row'} type="button" key={event.id} onClick={() => setSelected(event.id)}><span className="row-source">{event.platform} / {event.category}</span><span className="row-title">{event.title}</span><span className="row-meta">{event.location} / {event.deadline}</span><span className="row-score">{event.match}<small>%</small></span><ArrowRight className="row-arrow" /></button>)}</div>
          {current && <aside className="match-detail" aria-live="polite"><div className="detail-topline"><span>{current.id}</span><span className="verified"><ShieldCheck /> Source verified</span></div><h3>{current.title}</h3><p className="detail-authority">Indexed from {current.platform}</p><div className="detail-value"><span>Total prize pool</span><strong>{current.prize}</strong></div><div className="confidence-wrap"><div><span>Builder match</span><strong>{current.match}%</strong></div><div className="confidence-track"><span style={{ width: `${current.match}%` }} /></div></div><div className="reason-list"><span className="detail-label">Why it fits</span>{current.reasons.map((reason) => <p key={reason}><Check />{reason}</p>)}</div><button className="primary-button detail-button" type="button">Add deadline <CalendarPlus /></button></aside>}
        </div>
      </div>
    </section>
  );
}

function RepairLoop() {
  const [status, setStatus] = useState('idle');
  const [stage, setStage] = useState(4);
  const [logs, setLogs] = useState([['18:42:08', 'publish', '42 normalized hackathons ready'], ['18:42:07', 'normalize', 'deadlines converted to ISO-8601 UTC'], ['18:41:52', 'collect', 'four public event sources scanned']]);
  const timers = useRef([]);
  const stages = ['DOM change found', 'Extraction fails', 'Scraper self-heals', 'Schema validates', 'Feed stays live'];
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const simulate = () => {
    if (status === 'running') return;
    timers.current.forEach(clearTimeout); setStatus('running'); setStage(0); setLogs([['NOW', 'alert', 'DoraHacks moved deadline field'], ['NOW', 'schema', 'submission_deadline returned null']]);
    const events = [['+02s', 'detect', 'field-level health check triggered'], ['+05s', 'inspect', 'new page structure mapped'], ['+09s', 'self-heal', 'extractor rewritten from field description'], ['+13s', 'validate', 'deadline normalized to ISO-8601 UTC'], ['+16s', 'publish', '8 DoraHacks events restored; zero schema drift']];
    events.forEach((entry, index) => timers.current.push(setTimeout(() => { setStage(index); setLogs((previous) => [entry, ...previous].slice(0, 6)); if (index === events.length - 1) setStatus('complete'); }, index * 900 + 500)));
  };
  return (
    <section className="repair-section" id="healing"><div className="repair-content section-shell">
      <div className="section-index"><span>03</span><span>Self-healing</span></div>
      <div className="repair-heading"><p className="eyebrow">Built on Bright Data Scraper Studio</p><h2>The page changes. Your opportunity feed does not.</h2><p>BuildRadar monitors field completeness, detects extraction failures, and uses plain-language field definitions to repair a collector when an event platform changes its DOM. Downstream cards keep the same normalized shape.</p></div>
      <div className="repair-console">
        <div className="repair-console-header"><div><span className={status === 'running' ? 'status-lamp warning' : 'status-lamp'} /> Collector / dorahacks-v2</div><div>{status === 'running' ? 'Repair in progress' : status === 'complete' ? 'Feed restored' : 'Monitoring'}</div></div>
        <div className="repair-stages">{stages.map((item, index) => <div className={`repair-stage ${stage >= index ? 'stage-active' : ''}`} key={item}><span>{stage > index || status === 'complete' ? <Check /> : String(index + 1).padStart(2, '0')}</span><p>{item}</p></div>)}</div>
        <div className="log-window"><div className="log-heading"><span>Collector event stream</span><span>Auto-scroll / on</span></div><div className="logs">{logs.map(([time, type, message], index) => <div className="log-line" key={`${time}-${type}-${index}`}><span>{time}</span><span className={type === 'alert' ? 'log-type alert' : 'log-type'}>{type}</span><p>{message}</p></div>)}</div></div>
        <button className="simulate-button" type="button" onClick={simulate} disabled={status === 'running'}>{status === 'running' ? <><Sparkles /> Repairing collector...</> : status === 'complete' ? <><Play /> Replay DOM change</> : <><Zap /> Simulate DOM change</>}</button>
        <p className="repair-footnote">Demo simulation of a Bright Data collector repair; the normalized BuildRadar schema remains stable.</p>
      </div>
    </div></section>
  );
}

function SourceMap() {
  return (
    <section className="source-section source-immersive" id="sources">
      <img className="source-bg" src="/images/earth-premium.avif" alt="Earth's horizon representing BuildRadar's global event coverage" /><div className="source-bg-shade" /><div className="source-grid" aria-hidden="true" />
      <div className="source-ambient-label"><Network /><span>Global event network / live</span></div><div className="source-section-index section-index light-index"><span>04</span><span>Source network</span></div>
      <div className="source-copy source-copy-light"><p className="eyebrow">One builder-ready schema</p><h2>Four platforms.<br />One radar.</h2><p className="source-thesis">Devpost, Devfolio, DoraHacks, and Unstop describe the same opportunity in different ways. BuildRadar standardizes format, location, prize, eligibility, team size, tags, and deadline.</p></div>
      <div className="source-table source-table-light"><div className="source-table-head"><span>Platform</span><span>Active events</span><span>Collector</span></div>{sourceNodes.map(([name, count, state]) => <div className="source-line" key={name}><span>{name}</span><strong>{count}</strong><span className={state === 'repairing' ? 'state repairing' : 'state'}><i />{state}</span></div>)}</div>
    </section>
  );
}

function HackathonBand() {
  return <section className="hackathon-band" aria-label="Into the Scrape-Verse project context"><img src="/images/earth-premium.avif" alt="Global network seen from orbit" /><div className="hackathon-copy"><p className="eyebrow">Built for Into the Scrape-Verse</p><h2>Public web data, turned into something builders can act on.</h2><p>WeMakeDevs × Bright Data / August 17–23, 2026 / Scraper Studio at the core</p><BracketLink href="https://www.wemakedevs.org/hackathons/scrape-verse">View hackathon brief</BracketLink></div></section>;
}

function Footer() {
  return <footer className="site-footer"><div className="footer-signal"><Radio /><span>Opportunity radar online</span></div><div className="footer-title">BUILD<sup>RADAR</sup></div><div className="footer-grid"><p>Global, self-healing hackathon intelligence for people who would rather build than browse.</p><div><span>Prototype</span><strong>Scrape-Verse / 2026</strong></div><a href="#top">Back to top <ArrowUpRight /></a></div></footer>;
}

function App() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = new Lenis({ duration: reduced ? 0 : 1.05, smoothWheel: !reduced });
    let rafId; const raf = (time) => { lenis.raf(time); rafId = requestAnimationFrame(raf); }; rafId = requestAnimationFrame(raf); lenis.on('scroll', ScrollTrigger.update);
    let context;
    if (!reduced) context = gsap.context(() => {
      gsap.from('.hero-title > span', { yPercent: 115, opacity: 0, duration: 1.15, stagger: 0.12, ease: 'power4.out', delay: 0.15 });
      gsap.from('.hero-thesis, .hero-actions', { y: 28, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', delay: 0.65 });
      gsap.utils.toArray('.reveal-title, .match-header h2, .repair-heading h2, .source-copy h2').forEach((element) => gsap.from(element, { y: 70, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 86%', once: true } }));
      gsap.to('.hero-image', { scale: 1.12, yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.from('.architecture-step', { x: -32, opacity: 0, stagger: 0.12, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: '.architecture-rail', start: 'top 85%', once: true } });
      gsap.from('.source-line', { x: 24, opacity: 0, stagger: 0.1, scrollTrigger: { trigger: '.source-table', start: 'top 84%', once: true } });
    });
    return () => { context?.revert(); cancelAnimationFrame(rafId); lenis.destroy(); };
  }, []);
  return <><Navigation /><main><Hero /><StatementSection /><MatchConsole /><RepairLoop /><SourceMap /><HackathonBand /></main><Footer /></>;
}

createRoot(document.getElementById('root')).render(<App />);
