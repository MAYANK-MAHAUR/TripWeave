import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  AlertTriangle, ArrowDown, ArrowRight, ArrowUpRight, BedDouble, BusFront, CalendarDays,
  CarFront, ChevronLeft, ChevronRight, Clock3, Compass, Hotel, LoaderCircle, MapPin,
  Menu, Pause, Plane, Play, RefreshCw, Route, Search, ShieldCheck, Sparkles,
  TrainFront, Users, Wifi, WifiOff, X,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);
const Globe = lazy(() => import('react-globe.gl'));
const terminalStatuses = new Set(['ready', 'partial', 'error']);
const modeIcons = { Flight: Plane, Train: TrainFront, Bus: BusFront, Cab: CarFront, Van: BusFront, Hotel };
const day = (offset) => { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); };
const INITIAL_QUERY = { from: '', to: '', departDate: day(21), returnDate: day(23), adults: 2, currency: 'INR' };
const formatInr = (value) => Number.isFinite(value) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value) : 'Price unavailable';
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : 'Flexible';
const collectorState = (status) => status === 'complete' ? 'healthy' : status === 'failed' ? 'failed' : status === 'skipped' ? 'standby' : status || 'standby';

function InlineLink({ children, href = '#', onClick, className = '' }) {
  return <a className={`inline-link ${className}`} href={href} onClick={onClick}><span>{children}</span><ArrowUpRight aria-hidden="true" /></a>;
}

function Navigation({ job }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <header className="site-header"><a className="brand" href="/" onClick={close} aria-label="TripWeave home"><span className="brand-mark"><Route /></span><span>TRIPWEAVE</span></a><nav className={open ? 'nav-links nav-open' : 'nav-links'} aria-label="Primary navigation"><a href="/#how" onClick={close}>Why TripWeave</a><a href={job?.id ? `/trip/${job.id}` : '/#planner'} onClick={close}>Live comparison</a><a href="/#pipeline" onClick={close}>Data pipeline</a><InlineLink href="/#network" onClick={close}>Source health</InlineLink></nav><button className="menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X /> : <Menu />}</button></header>;
}

function SearchField({ icon: Icon, label, value, onChange, type = 'text', placeholder, min, max }) {
  return <label className="search-field"><span className="field-label">{label}</span><span className="field-input"><Icon aria-hidden="true" /><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} min={min} max={max} required /></span></label>;
}

function Hero({ health, job, onSearch }) {
  const [draft, setDraft] = useState(INITIAL_QUERY);
  const running = job && !terminalStatuses.has(job.status);
  const update = (key) => (value) => setDraft((current) => ({ ...current, [key]: key === 'adults' ? Number(value) : value }));
  const result = job?.result;
  const offerCount = result ? result.offers.transports.length + result.offers.hotels.length : null;
  return <section className="hero" id="top"><div className="hero-grid" aria-hidden="true" /><div className="hero-topline"><span><i className={health?.brightData ? 'live-dot' : 'live-dot offline'} />{health?.brightData ? 'Bright Data connected / live requests enabled' : 'Checking collector connection'}</span><span>{running ? `${job.progress}% / ${job.stage}` : result ? `Collected ${new Date(result.collectedAt).toLocaleTimeString()}` : 'No cached result shown'}</span></div><div className="hero-content"><p className="eyebrow hero-eyebrow">Door-to-door travel intelligence</p><h1 className="hero-title"><span>The whole</span><span className="outline-word">trip.</span><span>One real search.</span></h1><div className="hero-bottom"><div className="hero-copy"><p className="hero-thesis">Flights, buses, cabs and hotels—collected for your route when you ask.</p><p className="hero-problem">TripWeave triggers real Bright Data collectors, normalizes mixed currencies, and exposes missing legs instead of filling gaps with made-up prices.</p></div><div className="hero-actions"><a className="primary-button hero-cta" href="#planner">Plan a real trip <ArrowDown /></a><a className="text-link" href="#how">How totals are built <ArrowDown /></a></div></div></div><div className="route-ribbon" aria-label="Trip route"><div className="route-node"><span>FROM</span><strong>{draft.from || 'Choose origin'}</strong></div><div className="route-line"><span /><span /><span /><span /><span /></div><div className="route-node route-node-right"><span>TO</span><strong>{draft.to || 'Choose destination'}</strong></div><div className="route-modes"><Plane /><TrainFront /><CarFront /><Hotel /></div></div><form className="search-card" id="planner" onSubmit={(event) => { event.preventDefault(); onSearch(draft); }} aria-label="Plan a live trip"><div className="search-card-head"><span><Compass /> Plan with live public prices</span><span className="search-live"><i className={health?.brightData ? 'live-dot' : 'live-dot offline'} /> {Object.keys(health?.collectors || {}).length || 8} collectors configured</span></div><div className="search-grid live-search-grid"><SearchField icon={MapPin} label="From" value={draft.from} onChange={update('from')} placeholder="City or airport" /><SearchField icon={MapPin} label="To" value={draft.to} onChange={update('to')} placeholder="City or airport" /><SearchField icon={CalendarDays} label="Depart" type="date" value={draft.departDate} onChange={update('departDate')} min={day(1)} /><SearchField icon={CalendarDays} label="Return" type="date" value={draft.returnDate} onChange={update('returnDate')} min={draft.departDate || day(2)} /><SearchField icon={Users} label="Travellers" type="number" value={draft.adults} onChange={update('adults')} min="1" max="8" /><button className="search-submit" type="submit" disabled={running || !health?.brightData}>{running ? <><LoaderCircle className="spin" /> Collecting {job.progress}%</> : <><Search /> Search live trip</>}</button></div><div className="search-foot"><span>KAYAK · Skyscanner · Omio · 12Go · redBus · Booking · Expedia · TripAdvisor</span><span>Nothing is displayed until a collector returns it</span></div></form><div className="hero-status live-hero-status">{result ? <><div><span>Lowest composed total</span><strong>{result.observedRange?.minText || 'Incomplete'}</strong></div><div><span>Real offers returned</span><strong>{offerCount}</strong></div><div><span>Sources completed</span><strong>{result.sources.filter((source) => source.status === 'complete').length} / {result.sources.length}</strong></div></> : <><div><span>Collector API</span><strong>{health?.brightData ? 'Connected' : 'Unavailable'}</strong></div><div><span>Gemini guide</span><strong>{health?.gemini ? (health.geminiModel || 'Connected') : 'Key needed'}</strong></div><div><span>Current result</span><strong>Search to begin</strong></div></>}</div><div className="scroll-cue"><span>Live planner below</span><ArrowDown /></div></section>;
}

function ValueSection() {
  return <section className="value-section section-shell" id="how"><div className="section-index"><span>01</span><span>What counts</span></div><div className="value-main"><h2 className="reveal-title">A ticket price is not a trip price.</h2><p>TripWeave only composes a journey from rows returned by the collectors. Transport and hotel prices retain their source URLs; unavailable transfers remain a visible coverage gap.</p><div className="coverage-contrast"><div><Plane /><strong>Long-distance leg</strong><span>Flight, train, coach or car offer</span></div><ArrowRight /><div><CarFront /><strong>Door transfer</strong><span>Included only when a source prices it</span></div><ArrowRight /><div><BedDouble /><strong>The stay</strong><span>Dates, taxes and policy when returned</span></div></div></div><div className="value-metrics"><div><strong>LIVE</strong><span>Collector requests</span></div><div><strong>REAL</strong><span>Source-linked rows</span></div><div><strong>OPEN</strong><span>Missing-data gaps</span></div></div><div className="process-rail" aria-label="How TripWeave works">{['Resolve route', 'Run collectors', 'Normalize currencies', 'Compose verified legs'].map((item, index) => <div className="process-step" key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p>{index < 3 && <ArrowRight />}</div>)}</div></section>;
}

function ModePills({ modes = [] }) { return <div className="mode-pills">{modes.map((mode) => { const Icon = modeIcons[mode] || Route; return <span className="mode-pill" key={mode}><Icon />{mode}</span>; })}</div>; }

function CollectorProgress({ job }) {
  const collectors = Object.values(job?.collectors || {});
  const offerCount = (job?.result?.offers?.transports?.length || 0) + (job?.result?.offers?.hotels?.length || 0);
  if (offerCount) return <LiveUpdateBar job={job} />;
  return <div className="live-progress"><div className="progress-copy"><span className="eyebrow">LIVE COLLECTION / {job.progress}%</span><h3>{job.stage}</h3><p>Each source runs independently. Completed rows appear only after their schemas are normalized.</p></div><div className="progress-track"><span style={{ width: `${job.progress}%` }} /></div><div className="collector-progress-grid">{collectors.length ? collectors.map((collector) => <div className="collector-progress-card" key={collector.key}><span className={`collector-lamp ${collectorState(collector.status)}`} /><strong>{collector.label}</strong><small>{collector.status}</small></div>) : <div className="collector-progress-card"><LoaderCircle className="spin" /><strong>Preparing collectors</strong><small>resolving route</small></div>}</div></div>;
}

function LiveUpdateBar({ job }) {
  const collectors = Object.values(job?.collectors || {});
  const settled = collectors.filter((collector) => ['complete', 'failed', 'skipped'].includes(collector.status)).length;
  const offerCount = (job?.result?.offers?.transports?.length || 0) + (job?.result?.offers?.hotels?.length || 0);
  return <div className="live-update-bar" role="status"><span className="live-update-signal"><LoaderCircle className="spin" /> Live preview</span><strong>{offerCount} real offers available now</strong><span>{settled} / {collectors.length} sources settled · adding the rest automatically</span><i><b style={{ width: `${job?.progress || 0}%` }} /></i></div>;
}

function OfferFallback({ result }) {
  const transports = result?.offers?.transports || [];
  const hotels = result?.offers?.hotels || [];
  return <div className="offer-fallback"><div className="fallback-head"><AlertTriangle /><div><h3>{result.streaming ? 'Real offers are arriving now.' : 'No complete journey can be composed yet.'}</h3><p>{result.streaming ? 'You can inspect these returned prices immediately. Remaining sources will appear here automatically.' : 'These are the real rows that did return. TripWeave will not invent the missing side of the trip.'}</p></div></div><div className="raw-offer-columns"><div><span className="detail-label">Transport offers / {transports.length}</span>{transports.slice(0, 8).map((offer) => <a className="raw-offer" href={offer.sourceUrl || '#'} target="_blank" rel="noreferrer" key={offer.id}><ModePills modes={[offer.mode]} /><strong>{offer.operator}</strong><span>{offer.priceText || 'Price unavailable'}</span><small>{offer.tripLeg === 'return' ? 'RETURN' : offer.tripLeg === 'roundtrip' ? 'ROUND TRIP' : 'OUTBOUND'} · {offer.departure || 'Time unavailable'} · {offer.source}</small></a>)}</div><div><span className="detail-label">Hotel offers / {hotels.length}</span>{hotels.slice(0, 8).map((hotel) => <a className="raw-offer" href={hotel.sourceUrl || '#'} target="_blank" rel="noreferrer" key={hotel.id}><ModePills modes={['Hotel']} /><strong>{hotel.name}</strong><span>{hotel.priceText || 'Price unavailable'}</span><small>{hotel.location || 'Location unavailable'} · {hotel.source}</small></a>)}</div></div></div>;
}

function TripConsole({ job, error, onOpenTour, loadingSavedTrip = false }) {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const journeys = job?.result?.journeys || [];
  useEffect(() => { if (!selected || !journeys.some((journey) => journey.id === selected)) setSelected(journeys[0]?.id || null); }, [job?.id, journeys, selected]);
  const visible = useMemo(() => {
    if (filter === 'Lowest total') return [...journeys].sort((a, b) => a.totalInr - b.totalInr);
    if (filter === 'Fastest') return [...journeys].sort((a, b) => (a.durationMinutes || Infinity) - (b.durationMinutes || Infinity));
    if (filter === 'Complete only') return journeys.filter((item) => item.coverage.complete);
    return journeys;
  }, [filter, journeys]);
  const current = journeys.find((item) => item.id === selected) || visible[0];
  const filters = ['All', 'Lowest total', 'Fastest', 'Complete only'];
  const collecting = Boolean(job && !terminalStatuses.has(job.status));
  const offerCount = (job?.result?.offers?.transports?.length || 0) + (job?.result?.offers?.hotels?.length || 0);
  const sourceFailures = job?.result?.sources?.filter((source) => source.status === 'failed').length || 0;
  const snapshotMessage = collecting ? `Live preview — ${offerCount} real offers available; new rows add automatically` : job?.status === 'partial' ? 'Partial live route — inspect coverage gaps' : sourceFailures ? `Complete trip found — ${sourceFailures} source${sourceFailures === 1 ? '' : 's'} unavailable` : 'All configured collectors completed';
  return <section className="compare-section" id="compare"><div className="compare-header section-shell"><div className="section-index light-index"><span>TRIP</span><span>Live result page</span></div><div><p className="eyebrow">{job?.query ? `${job.query.from} → ${job.query.to} / ${formatDate(job.query.departDate)}` : loadingSavedTrip ? 'Restoring trip job' : 'Waiting for a route'}</p><h2>See what the sources<br />actually returned.</h2></div><p className="compare-intro">Every visible price comes from the current collector job. Source failures and unpriced legs remain visible.</p></div><div className="console-shell">{loadingSavedTrip && <div className="console-loading"><LoaderCircle className="spin" /><span className="eyebrow">LOADING SAVED TRIP</span><h3>Restoring the real collector result…</h3><p>The route, source rows and coverage gaps are being read from the backend.</p></div>}{!job && !error && !loadingSavedTrip && <div className="console-empty"><Compass /><h3>Your live comparison starts with a route.</h3><p>Enter two cities and dates on the home page. Collection can take one to three minutes because every source is queried for this trip.</p><a className="primary-button" href="/">Choose a route <ArrowUpRight /></a></div>}{error && <div className="console-error"><AlertTriangle /><h3>Trip request stopped</h3><p>{error}</p><a href="/" className="primary-button">Start a new search <RefreshCw /></a></div>}{job && !terminalStatuses.has(job.status) && <CollectorProgress job={job} />}{job?.status === 'error' && <div className="console-error"><AlertTriangle /><h3>Live collection failed</h3><p>{job.error}</p><a href="/" className="primary-button">Try another search <RefreshCw /></a></div>}{job?.result && !journeys.length && <OfferFallback result={job.result} />}{job?.result && journeys.length > 0 && <><div className="console-toolbar"><div className="console-brand"><Route /><span>{journeys.length} composed journeys / {job.result.offers.transports.length + job.result.offers.hotels.length} source rows</span></div><div className="filter-tabs" role="group" aria-label="Sort real trip combinations">{filters.map((item) => <button className={filter === item ? 'filter-tab active' : 'filter-tab'} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className={`console-snapshot ${job.status === 'partial' ? 'partial' : ''}`}>{job.status === 'partial' ? <AlertTriangle /> : <ShieldCheck />} {snapshotMessage} <span>•</span> {new Date(job.result.collectedAt).toLocaleString()}</div><div className="console-grid"><div className="trip-list" role="list" aria-label="Composed journeys"><div className="list-heading"><span>{visible.length} options / normalized to INR</span><span>Coverage</span></div>{visible.map((option) => <button className={current?.id === option.id ? 'trip-row selected' : 'trip-row'} type="button" key={option.id} onClick={() => setSelected(option.id)}><span className="row-eyebrow">{option.eyebrow}</span><span className="row-title">{option.label}</span><ModePills modes={option.modes} /><span className="row-total">{option.totalText}<small>{option.sources.join(' · ')}</small></span><span className="row-meta"><Clock3 /> {option.durationText} · {option.coverage.complete ? 'all priced legs' : `missing ${option.coverage.missing.join(', ')}`}</span><ArrowRight className="row-arrow" /></button>)}</div>{current && <aside className="trip-detail" aria-live="polite"><div className="detail-topline"><span>TRIP / {current.id.slice(0, 8).toUpperCase()}</span><span className="verified"><ShieldCheck /> {current.confidence}% field coverage</span></div><div className="detail-heading"><p className="eyebrow">{current.eyebrow}</p><h3>{current.label}</h3><p>{current.note}</p></div><div className="detail-total"><span>Observed composed total</span><strong>{current.totalText}</strong><small>{current.sources.join(' · ')}</small></div><div className="detail-breakdown"><div className="detail-label">Returned price rows</div>{current.breakdown.map((row) => <a className="breakdown-row" href={row.url || '#'} target="_blank" rel="noreferrer" key={`${row.label}-${row.source}`}><span>{row.label}<small>{row.source}</small></span><strong>{formatInr(row.amountInr)}</strong></a>)}{job.result.observedRange && <div className="breakdown-total"><span>Observed range</span><strong>{job.result.observedRange.minText}–{job.result.observedRange.maxText}</strong></div>}</div><div className="timeline"><div className="detail-label">Source-backed timeline</div>{current.timeline.map((stop, index) => <div className="timeline-row" key={`${stop.label}-${index}`}><span className="timeline-time">{stop.time || '—'}</span><span className="timeline-dot"><i /></span><div><strong>{stop.label}</strong><p>{stop.detail}</p></div>{index < current.timeline.length - 1 && <span className="timeline-stem" />}</div>)}</div><div className="coverage-note"><AlertTriangle /><span>{current.coverage.complete ? 'All currently priced legs are included.' : `Not priced yet: ${current.coverage.missing.join(', ')}.`}</span></div><div className="detail-actions"><button className="primary-button detail-button" type="button" onClick={() => onOpenTour(current)}><Compass /> Open guided route</button><a className="source-button" href={current.sourceUrl || '#'} target="_blank" rel="noreferrer"><ShieldCheck /> Open primary source <ArrowUpRight /></a></div></aside>}</div></>}</div></section>;
}

function InteractiveRouteGlobe({ origin, destination, stops, activeStop }) {
  const globeRef = useRef();
  const containerRef = useRef();
  const [size, setSize] = useState({ width: 540, height: 540 });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const resize = () => { const width = Math.max(280, Math.min(container.clientWidth, 570)); setSize({ width, height: width }); };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(container); return () => observer.disconnect();
  }, []);
  const configure = () => {
    const globe = globeRef.current; const controls = globe?.controls?.(); if (!globe || !controls) return;
    controls.autoRotate = false; controls.enableZoom = true; controls.enablePan = false;
    globe.pointOfView({ lat: origin.lat, lng: origin.lng, altitude: 1.8 }, 0);
  };
  useEffect(() => { if (activeStop && globeRef.current) globeRef.current.pointOfView({ lat: activeStop.lat, lng: activeStop.lng, altitude: activeStop.kind === 'attraction' ? 0.55 : 0.9 }, 1200); }, [activeStop]);
  const arcs = [{ startLat: origin.lat, startLng: origin.lng, endLat: destination.lat, endLng: destination.lng, color: ['#ff8268', '#b7efd7'], type: 'journey' }];
  stops.slice(2).forEach((stop, index) => { const previous = index ? stops[index + 1] : destination; arcs.push({ startLat: previous.lat, startLng: previous.lng, endLat: stop.lat, endLng: stop.lng, color: ['#b7efd7', '#ffd37a'], type: 'tour' }); });
  return <div className="interactive-globe" ref={containerRef}><Suspense fallback={<div className="globe-loading"><i className="live-dot" /> Loading WebGL route…</div>}><Globe ref={globeRef} onGlobeReady={configure} width={size.width} height={size.height} backgroundColor="rgba(0,0,0,0)" rendererConfig={{ antialias: true, alpha: true }} globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg" bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png" atmosphereColor="#65d9c0" atmosphereAltitude={0.16} pointsData={stops} pointLat="lat" pointLng="lng" pointColor={(point) => point.id === activeStop?.id ? '#ffd37a' : point.color} pointLabel="name" pointRadius={(point) => point.id === activeStop?.id ? 0.75 : 0.42} pointAltitude={0.035} labelsData={stops} labelLat="lat" labelLng="lng" labelText="shortName" labelColor={(point) => point.id === activeStop?.id ? '#ffd37a' : '#f8fbf5'} labelSize={0.7} labelDotRadius={0.18} labelAltitude={0.045} arcsData={arcs} arcColor="color" arcAltitude={(arc) => arc.type === 'journey' ? 0.28 : 0.08} arcStroke={(arc) => arc.type === 'journey' ? 0.65 : 0.35} arcDashLength={0.4} arcDashGap={0.22} arcDashAnimateTime={1700} animateIn /></Suspense></div>;
}

function RouteTour({ open, onClose, trip, journey }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const origin = trip?.origin; const destination = trip?.destination; const places = trip?.places || [];
  const stops = useMemo(() => !origin || !destination || !journey ? [] : [
    { id: 'origin', name: `${origin.name} departure`, shortName: origin.iata, lat: origin.lat, lng: origin.lng, kind: 'origin', color: '#ff8268', detail: journey.transport?.departure || 'Departure time unavailable' },
    { id: 'arrival', name: `${destination.name} arrival`, shortName: destination.iata, lat: destination.lat, lng: destination.lng, kind: 'arrival', color: '#b7efd7', detail: journey.transport?.arrival || 'Arrival time unavailable' },
    { id: 'hotel', name: journey.hotel.name, shortName: 'STAY', lat: destination.lat + 0.025, lng: destination.lng + 0.025, kind: 'hotel', color: '#ffd37a', detail: journey.hotel.location || destination.name, url: journey.hotel.sourceUrl },
    ...places.map((place, index) => ({ ...place, id: `place-${index}`, shortName: String(index + 1).padStart(2, '0'), kind: 'attraction', color: '#8ddac5', detail: place.category })),
  ], [origin, destination, journey, places]);
  useEffect(() => { if (open) { setActiveIndex(0); setPlaying(false); } }, [open, journey?.id]);
  useEffect(() => { if (!playing || !stops.length) return undefined; const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % stops.length), 4200); return () => window.clearInterval(timer); }, [playing, stops.length]);
  useEffect(() => { if (!open) return undefined; const escape = (event) => event.key === 'Escape' && onClose(); document.addEventListener('keydown', escape); document.body.classList.add('modal-open'); return () => { document.removeEventListener('keydown', escape); document.body.classList.remove('modal-open'); }; }, [open, onClose]);
  if (!open || !journey || !trip || !stops.length) return null;
  const active = stops[activeIndex]; const move = (delta) => setActiveIndex((index) => (index + delta + stops.length) % stops.length);
  return <div className="route-globe-modal" role="dialog" aria-modal="true" aria-labelledby="route-tour-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="route-globe-shell guided-tour-shell"><div className="route-globe-head"><div><span className="eyebrow">GUIDED ROUTE / {origin.iata} → {destination.iata}</span><h2 id="route-tour-title">Follow the trip, stop by stop.</h2></div><button className="globe-close" type="button" onClick={onClose} aria-label="Close guided route"><X /></button></div><div className="route-globe-grid"><div className="route-globe-visual"><InteractiveRouteGlobe origin={origin} destination={destination} stops={stops} activeStop={active} /><div className="tour-controls"><button type="button" onClick={() => move(-1)} aria-label="Previous stop"><ChevronLeft /></button><button className="tour-play" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? <><Pause /> Pause tour</> : <><Play /> Play tour</>}</button><button type="button" onClick={() => move(1)} aria-label="Next stop"><ChevronRight /></button></div><div className="globe-caption"><span><i className="live-dot" /> Drag and zoom at any time</span><span>{activeIndex + 1} / {stops.length}</span></div></div><div className="route-globe-info"><div className="tour-active-card"><span className="eyebrow">{active.kind} / stop {String(activeIndex + 1).padStart(2, '0')}</span><h3>{active.name}</h3><p>{active.detail}</p>{active.url && <a href={active.url} target="_blank" rel="noreferrer">Open source <ArrowUpRight /></a>}</div>{trip.ai?.enabled ? <div className="ai-route-note"><Sparkles /><div><span>Gemini route note / {trip.ai.model}</span><p>{trip.ai.summary}</p><small>{trip.ai.recommendation_reason}</small></div></div> : <div className="ai-route-note offline"><WifiOff /><div><span>Gemini enrichment is off</span><p>{trip.ai?.message || 'The route still uses real collector and OpenStreetMap data.'}</p></div></div>}<div className="tour-stop-list" aria-label="Tour stops">{stops.map((stop, index) => <button type="button" className={activeIndex === index ? 'active' : ''} onClick={() => setActiveIndex(index)} key={stop.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{stop.name}</strong><small>{stop.detail}</small></div><ArrowRight /></button>)}</div><div className="tour-price-summary"><span>Composed from returned rows</span><strong>{journey.totalText}</strong>{journey.breakdown.map((row) => <a href={row.url || '#'} target="_blank" rel="noreferrer" key={row.label}><span>{row.label}</span><b>{formatInr(row.amountInr)}</b></a>)}</div></div></div></div></div>;
}

function PipelineSection({ job, health }) {
  const sources = job?.result?.sources || Object.entries(health?.collectors || {}).map(([key, source]) => ({ key, ...source, status: health?.brightData ? 'standby' : 'failed', rows: null }));
  return <section className="network-section" id="network"><div className="network-shade" /><div className="network-grid" aria-hidden="true" /><div className="network-inner section-shell"><div className="network-topline"><span><Route /> Live backend / source health</span><span>{health?.brightData ? <><Wifi /> API connected</> : <><WifiOff /> API unavailable</>}</span></div><div className="network-copy" id="pipeline"><p className="eyebrow">No hidden fallback dataset</p><h2>Every source<br />shows its work.</h2><p>Collector status, returned row counts and failures come from the backend job. Gemini can explain a route, but it cannot add facts that are absent from those rows.</p></div><div className="source-table"><div className="source-table-head"><span>Mode</span><span>Source</span><span>Rows</span><span>Status</span></div>{sources.map((source) => <div className="source-line" key={source.key}><strong>{String(source.kind || 'source').toUpperCase()}</strong><span>{source.label}</span><span>{source.rows ?? '—'}</span><span className={`state ${collectorState(source.status)}`}><i />{collectorState(source.status)}</span></div>)}<div className="source-line ai-source-line"><strong>AI GUIDE</strong><span>{health?.geminiModel || 'Gemini'}</span><span>evidence only</span><span className={`state ${health?.gemini ? 'healthy' : 'standby'}`}><i />{health?.gemini ? 'ready' : 'key needed'}</span></div></div></div></section>;
}

function HackathonBand() {
  return <section className="hackathon-band"><div className="hackathon-art"><div className="art-route"><span /><span /><span /><span /></div><p>TRIPWEAVE / LIVE</p><strong>Every leg<br />counts.</strong></div><div className="hackathon-copy"><p className="eyebrow">Built for Into the Scrape-Verse</p><h2>Scrape the open web. Compose something people can use.</h2><p>WeMakeDevs × Bright Data / Scraper Studio collectors / Gemini route narration</p><InlineLink href="https://www.wemakedevs.org/hackathons/scrape-verse">View hackathon brief</InlineLink></div></section>;
}

function Footer() {
  return <footer className="site-footer"><div className="footer-signal"><Route /><span>Live trip composer</span></div><div className="footer-title">TRIP<span>WEAVE</span></div><div className="footer-grid"><p>Complete journey intelligence built from collector rows, real places and explicit coverage gaps.</p><div><span>Prototype</span><strong>Scrape-Verse / 2026</strong></div><a href="#top">Back to top <ArrowUpRight /></a></div></footer>;
}

function TripPage({ job, error, health, onOpenTour }) {
  return <main className="trip-page"><div className="trip-page-bar"><a href="/"><ChevronLeft /> New search</a><span>{job?.id ? `JOB / ${job.id.slice(0, 8).toUpperCase()}` : 'LOADING TRIP JOB'}</span><span className={job?.status === 'ready' ? 'trip-job-ready' : ''}>{job?.status || 'loading'}</span></div><TripConsole job={job} error={error} loadingSavedTrip={!job && !error} onOpenTour={onOpenTour} /><PipelineSection job={job} health={health} /></main>;
}

export default function App() {
  const [health, setHealth] = useState(null);
  const [job, setJob] = useState(null);
  const [requestError, setRequestError] = useState(null);
  const [tourJourney, setTourJourney] = useState(null);
  const [pathname, setPathname] = useState(window.location.pathname);
  const tripId = pathname.match(/^\/trip\/([^/]+)/)?.[1];
  const activeTripJob = tripId && job?.id === tripId ? job : null;
  useEffect(() => { fetch('/api/health').then((response) => response.json()).then(setHealth).catch(() => setHealth({ brightData: false, gemini: false, collectors: {} })); }, []);
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [pathname]);
  useEffect(() => {
    if (!tripId || job?.id === tripId) return;
    setRequestError(null);
    fetch(`/api/trips/${tripId}`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Trip job not found.'); setJob(data); }).catch((error) => setRequestError(error.message));
  }, [tripId, job?.id]);
  useEffect(() => {
    if (!job?.id || terminalStatuses.has(job.status)) return undefined;
    const timer = window.setInterval(async () => { try { const response = await fetch(`/api/trips/${job.id}`); const next = await response.json(); if (!response.ok) throw new Error(next.error || 'Could not read trip status.'); setJob(next); } catch (error) { setRequestError(error.message); window.clearInterval(timer); } }, 1200);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);
  const searchTrip = async (query) => {
    setRequestError(null); setTourJourney(null);
    try { const response = await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) }); const next = await response.json(); if (!response.ok && response.status !== 202) throw new Error(next.error || 'The trip could not be started.'); window.location.assign(`/trip/${next.id}`); } catch (error) { setRequestError(error.message); }
  };
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = new Lenis({ duration: reduced ? 0 : 1.05, smoothWheel: !reduced }); let rafId;
    const raf = (time) => { lenis.raf(time); rafId = requestAnimationFrame(raf); }; rafId = requestAnimationFrame(raf); lenis.on('scroll', ScrollTrigger.update);
    const context = reduced ? null : gsap.context(() => {
      const heroLines = document.querySelectorAll('.hero-title > span');
      const heroDetails = document.querySelectorAll('.hero-thesis, .hero-actions, .search-card');
      if (heroLines.length) gsap.from(heroLines, { yPercent: 112, opacity: 0, duration: 1.05, stagger: 0.09, ease: 'power4.out', delay: 0.1 });
      if (heroDetails.length) gsap.from(heroDetails, { y: 24, opacity: 0, duration: 0.82, stagger: 0.1, ease: 'power3.out', delay: 0.5 });
      gsap.utils.toArray('.reveal-title, .compare-header h2, .network-copy h2').forEach((element) => gsap.from(element, { y: 50, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 88%', once: true } }));
    });
    return () => { context?.revert(); cancelAnimationFrame(rafId); lenis.destroy(); };
  }, []);
  const isTripPage = /^\/trip\//.test(pathname);
  return <><Navigation job={activeTripJob || job} />{isTripPage ? <TripPage job={activeTripJob} error={requestError} health={health} onOpenTour={setTourJourney} /> : <main><Hero health={health} job={null} onSearch={searchTrip} /><ValueSection /><PipelineSection job={null} health={health} /><HackathonBand /></main>}<Footer /><RouteTour open={Boolean(tourJourney)} onClose={() => setTourJourney(null)} trip={activeTripJob?.result} journey={tourJourney} /></>;
}
