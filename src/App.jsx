import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  AlertTriangle, ArrowDown, ArrowRight, ArrowUpRight, BedDouble, BusFront, CalendarDays,
  CarFront, ChevronLeft, ChevronRight, Clock3, Compass, Hotel, LoaderCircle, MapPin,
  Menu, Plane, RefreshCw, Route, Search, ShieldCheck,
  TrainFront, Users, Wifi, WifiOff, X,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);
const RouteTour = lazy(() => import('./RouteTour.jsx'));
const terminalStatuses = new Set(['ready', 'partial', 'error']);
const modeIcons = { Flight: Plane, Train: TrainFront, Bus: BusFront, Cab: CarFront, Van: BusFront, Hotel };
const day = (offset) => { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); };
const INITIAL_QUERY = { from: '', to: '', departDate: day(21), returnDate: day(23), adults: 2, currency: 'INR' };
const formatInr = (value) => Number.isFinite(value) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value) : 'Price unavailable';
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : 'Flexible';
const formatTripTime = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? formatDate(value) : value || 'Flexible';
const collectorState = (status) => status === 'complete' ? 'healthy' : status === 'failed' ? 'failed' : status === 'skipped' ? 'standby' : status || 'standby';

function InlineLink({ children, href = '#', onClick, className = '' }) {
  return <a className={`inline-link ${className}`} href={href} onClick={onClick}><span>{children}</span><ArrowUpRight aria-hidden="true" /></a>;
}

function Navigation({ job }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <header className="site-header"><a className="brand" href="/" onClick={close} aria-label="TripWeave home"><span className="brand-mark"><Route /></span><span>TRIPWEAVE</span></a><nav className={open ? 'nav-links nav-open' : 'nav-links'} aria-label="Primary navigation"><a href="/#how" onClick={close}>Why TripWeave</a><a href={job?.id ? `/trip/${job.id}` : '/#planner'} onClick={close}>Live comparison</a><a href="/#pipeline" onClick={close}>How it works</a><InlineLink href="/#network" onClick={close}>Live sources</InlineLink></nav><button className="menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X /> : <Menu />}</button></header>;
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
  return <section className="hero" id="top"><div className="hero-grid" aria-hidden="true" /><div className="hero-topline"><span><i className={health?.brightData ? 'live-dot' : 'live-dot offline'} />{health?.brightData ? 'Bright Data connected / live requests enabled' : 'Checking collector connection'}</span><span>{running ? `${job.progress}% / ${job.stage}` : result ? `Collected ${new Date(result.collectedAt).toLocaleTimeString()}` : 'No cached result shown'}</span></div><div className="hero-content"><p className="eyebrow hero-eyebrow">Plan the full trip before you spend</p><h1 className="hero-title"><span>The whole</span><span className="outline-word">trip.</span><span>One real search.</span></h1><div className="hero-bottom"><div className="hero-copy"><p className="hero-thesis">Travel and stays, from budget picks to premium plans, in one search.</p><p className="hero-problem">Most trips start with too many tabs and end with a budget surprise. Tell TripWeave where you want to go and see the likely whole-trip cost before you book.</p></div><div className="hero-actions"><a className="primary-button hero-cta" href="#planner">Plan a real trip <ArrowDown /></a></div></div></div><div className="route-ribbon" aria-label="Trip route"><div className="route-node"><span>FROM</span><strong>{draft.from || 'Choose origin'}</strong></div><div className="route-line"><span /><span /><span /><span /><span /></div><div className="route-node route-node-right"><span>TO</span><strong>{draft.to || 'Choose destination'}</strong></div><div className="route-modes"><Plane /><TrainFront /><CarFront /><Hotel /></div></div><form className="search-card" id="planner" onSubmit={(event) => { event.preventDefault(); onSearch(draft); }} aria-label="Plan a live trip"><div className="search-card-head"><span><Compass /> Compare your whole trip</span><span className="search-live"><i className={health?.brightData ? 'live-dot' : 'live-dot offline'} /> {Object.keys(health?.collectors || {}).length || 8} live sources</span></div><div className="search-grid live-search-grid"><SearchField icon={MapPin} label="From" value={draft.from} onChange={update('from')} placeholder="City or airport" /><SearchField icon={MapPin} label="To" value={draft.to} onChange={update('to')} placeholder="City or airport" /><SearchField icon={CalendarDays} label="Depart" type="date" value={draft.departDate} onChange={update('departDate')} min={day(1)} /><SearchField icon={CalendarDays} label="Return" type="date" value={draft.returnDate} onChange={update('returnDate')} min={draft.departDate || day(2)} /><SearchField icon={Users} label="Travellers" type="number" value={draft.adults} onChange={update('adults')} min="1" max="4" /><button className="search-submit" type="submit" disabled={running || !health?.brightData}>{running ? <><LoaderCircle className="spin" /> Collecting {job.progress}%</> : <><Search /> Search live trip</>}</button></div><div className="search-foot"><span>KAYAK · Skyscanner · Omio · 12Go · redBus · Booking · Expedia · TripAdvisor</span><span>New options appear as soon as they are found</span></div></form><div className="hero-status live-hero-status">{result ? <><div><span>Lowest composed total</span><strong>{result.observedRange?.minText || 'Incomplete'}</strong></div><div><span>Real offers returned</span><strong>{offerCount}</strong></div><div><span>Sources completed</span><strong>{result.sources.filter((source) => source.status === 'complete').length} / {result.sources.length}</strong></div></> : <><div><span>Collector API</span><strong>{health?.brightData ? 'Connected' : 'Unavailable'}</strong></div><div><span>Gemini guide</span><strong>{health?.gemini ? (health.geminiModel || 'Connected') : 'Key needed'}</strong></div><div><span>Current result</span><strong>Search to begin</strong></div></>}</div><div className="scroll-cue"><span>Live planner below</span><ArrowDown /></div></section>;
}

function ValueSection() {
  return <section className="value-section section-shell" id="how"><div className="section-index"><span>01</span><span>What counts</span></div><div className="value-main"><h2 className="reveal-title">Stop finding out too late that the trip costs too much.</h2><p>People spend hours comparing flights, trains, buses and hotels, only to discover the full trip is over budget. Choose a destination and TripWeave brings travel and stays together for up to four people, from the cheapest options to premium plans.</p><div className="coverage-contrast"><div><Plane /><strong>Get there</strong><span>Flights, trains, buses and cabs</span></div><ArrowRight /><div><CarFront /><strong>Stay there</strong><span>Hotels for your exact dates</span></div><ArrowRight /><div><BedDouble /><strong>Choose what fits</strong><span>Budget to premium, side by side</span></div></div></div><div className="value-metrics"><div><strong>ONE</strong><span>Place to compare</span></div><div><strong>1 to 4</strong><span>Travellers</span></div><div><strong>LIVE</strong><span>Prices as they arrive</span></div></div><div className="process-rail" aria-label="How TripWeave works">{['Choose cities', 'Compare travel', 'Compare stays', 'See the full trip'].map((item, index) => <div className="process-step" key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p>{index < 3 && <ArrowRight />}</div>)}</div></section>;
}

function ModePills({ modes = [] }) { return <div className="mode-pills">{modes.map((mode) => { const Icon = modeIcons[mode] || Route; return <span className="mode-pill" key={mode}><Icon />{mode}</span>; })}</div>; }

function CollectorProgress({ job }) {
  const collectors = Object.values(job?.collectors || {});
  const offerCount = (job?.result?.offers?.transports?.length || 0) + (job?.result?.offers?.hotels?.length || 0);
  if (offerCount) return <LiveUpdateBar job={job} />;
  return <div className="live-progress"><div className="progress-copy"><span className="eyebrow">FINDING OPTIONS / {job.progress}%</span><h3>{job.stage}</h3><p>Options appear as soon as each travel site responds. You can start comparing while the rest keep loading.</p></div><div className="progress-track"><span style={{ width: `${job.progress}%` }} /></div><div className="collector-progress-grid">{collectors.length ? collectors.map((collector) => <div className="collector-progress-card" key={collector.key}><span className={`collector-lamp ${collectorState(collector.status)}`} /><strong>{collector.label}</strong><small>{collector.status}</small></div>) : <div className="collector-progress-card"><LoaderCircle className="spin" /><strong>Preparing collectors</strong><small>resolving route</small></div>}</div></div>;
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
  return <div className="offer-fallback"><div className="fallback-head"><AlertTriangle /><div><h3>{result.streaming ? 'Real offers are arriving now.' : 'No full trip plan is ready yet.'}</h3><p>{result.streaming ? 'You can inspect these returned prices immediately. Remaining sources will appear here automatically.' : 'These are the real rows that did return. TripWeave will not invent the missing side of the trip.'}</p></div></div><div className="raw-offer-columns"><div><span className="detail-label">Transport offers / {transports.length}</span>{transports.slice(0, 8).map((offer) => <a className="raw-offer" href={offer.sourceUrl || '#'} target="_blank" rel="noreferrer" key={offer.id}><ModePills modes={[offer.mode]} /><strong>{offer.operator}</strong><span>{offer.priceText || 'Price unavailable'}</span><small>{offer.tripLeg === 'return' ? 'RETURN' : offer.tripLeg === 'roundtrip' ? 'ROUND TRIP' : 'OUTBOUND'} · {offer.departure || 'Time unavailable'} · {offer.source}</small></a>)}</div><div><span className="detail-label">Hotel offers / {hotels.length}</span>{hotels.slice(0, 8).map((hotel) => <a className="raw-offer" href={hotel.sourceUrl || '#'} target="_blank" rel="noreferrer" key={hotel.id}><ModePills modes={['Hotel']} /><strong>{hotel.name}</strong><span>{hotel.priceText || 'Price unavailable'}</span><small>{hotel.location || 'Location unavailable'} · {hotel.source}</small></a>)}</div></div></div>;
}

function LegacyTripConsole({ job, error, onOpenTour, loadingSavedTrip = false }) {
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
  const snapshotMessage = collecting ? `Live preview. ${offerCount} real offers available; new rows add automatically` : job?.status === 'partial' ? 'Partial live route. Check what is still missing.' : sourceFailures ? `Complete trip found. ${sourceFailures} source${sourceFailures === 1 ? '' : 's'} unavailable` : 'All travel sites have responded';
  return <section className="compare-section" id="compare"><div className="compare-header section-shell"><div className="section-index light-index"><span>TRIP</span><span>Live result page</span></div><div><p className="eyebrow">{job?.query ? `${job.query.from} → ${job.query.to} / ${formatDate(job.query.departDate)}` : loadingSavedTrip ? 'Restoring trip job' : 'Waiting for a route'}</p><h2>See your trip options<br />as they arrive.</h2></div><p className="compare-intro">Compare the whole trip in one place. Every price links back to where it was found, and anything still missing is clearly marked.</p></div><div className="console-shell">{loadingSavedTrip && <div className="console-loading"><LoaderCircle className="spin" /><span className="eyebrow">LOADING SAVED TRIP</span><h3>Restoring your trip...</h3><p>Your saved travel and stay options are being restored.</p></div>}{!job && !error && !loadingSavedTrip && <div className="console-empty"><Compass /><h3>Your live comparison starts with a route.</h3><p>Enter two cities and dates on the home page. Real options start appearing within seconds, and the page keeps adding more as travel sites respond.</p><a className="primary-button" href="/">Choose a route <ArrowUpRight /></a></div>}{error && <div className="console-error"><AlertTriangle /><h3>Trip request stopped</h3><p>{error}</p><a href="/" className="primary-button">Start a new search <RefreshCw /></a></div>}{job && !terminalStatuses.has(job.status) && <CollectorProgress job={job} />}{job?.status === 'error' && <div className="console-error"><AlertTriangle /><h3>Live collection failed</h3><p>{job.error}</p><a href="/" className="primary-button">Try another search <RefreshCw /></a></div>}{job?.result && !journeys.length && <OfferFallback result={job.result} />}{job?.result && journeys.length > 0 && <><div className="console-toolbar"><div className="console-brand"><Route /><span>{journeys.length} trip plans / {job.result.offers.transports.length + job.result.offers.hotels.length} live options</span></div><div className="filter-tabs" role="group" aria-label="Sort real trip combinations">{filters.map((item) => <button className={filter === item ? 'filter-tab active' : 'filter-tab'} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className={`console-snapshot ${job.status === 'partial' ? 'partial' : ''}`}>{job.status === 'partial' ? <AlertTriangle /> : <ShieldCheck />} {snapshotMessage} <span>•</span> {new Date(job.result.collectedAt).toLocaleString()}</div><div className="console-grid"><div className="trip-list" role="list" aria-label="Composed journeys"><div className="list-heading"><span>{visible.length} options / prices shown in INR</span><span>Included</span></div>{visible.map((option) => <button className={current?.id === option.id ? 'trip-row selected' : 'trip-row'} type="button" key={option.id} onClick={() => setSelected(option.id)}><span className="row-eyebrow">{option.eyebrow}</span><span className="row-title">{option.label}</span><ModePills modes={option.modes} /><span className="row-total">{option.totalText}<small>{option.sources.join(' · ')}</small></span><span className="row-meta"><Clock3 /> {option.durationText} · {option.coverage.complete ? 'all priced legs' : `missing ${option.coverage.missing.join(', ')}`}</span><ArrowRight className="row-arrow" /></button>)}</div>{current && <aside className="trip-detail" aria-live="polite"><div className="detail-topline"><span>TRIP / {current.id.slice(0, 8).toUpperCase()}</span><span className="verified"><ShieldCheck /> {current.confidence}% details found</span></div><div className="detail-heading"><p className="eyebrow">{current.eyebrow}</p><h3>{current.label}</h3><p>{current.note}</p></div><div className="detail-total"><span>Current trip total</span><strong>{current.totalText}</strong><small>{current.sources.join(' · ')}</small></div><div className="detail-breakdown"><div className="detail-label">Price breakdown</div>{current.breakdown.map((row) => <a className="breakdown-row" href={row.url || '#'} target="_blank" rel="noreferrer" key={`${row.label}-${row.source}`}><span>{row.label}<small>{row.source}</small></span><strong>{formatInr(row.amountInr)}</strong></a>)}{job.result.observedRange && <div className="breakdown-total"><span>Current price range</span><strong>{job.result.observedRange.minText} to {job.result.observedRange.maxText}</strong></div>}</div><div className="timeline"><div className="detail-label">Your trip, step by step</div>{current.timeline.map((stop, index) => <div className="timeline-row" key={`${stop.label}-${index}`}><span className="timeline-time">{stop.time || 'Not set'}</span><span className="timeline-dot"><i /></span><div><strong>{stop.label}</strong><p>{stop.detail}</p></div>{index < current.timeline.length - 1 && <span className="timeline-stem" />}</div>)}</div><div className="coverage-note"><AlertTriangle /><span>{current.coverage.complete ? 'All currently priced legs are included.' : `Not priced yet: ${current.coverage.missing.join(', ')}.`}</span></div><div className="detail-actions"><button className="primary-button detail-button" type="button" onClick={() => onOpenTour(current)}><Compass /> Open guided route</button><a className="source-button" href={current.sourceUrl || '#'} target="_blank" rel="noreferrer"><ShieldCheck /> Open travel site <ArrowUpRight /></a></div></aside>}</div></>}</div></section>;
}

function PlanDetailModal({ plan, result, travellers, tag, sourceUrlFor, onClose, onOpenTour }) {
  const closeRef = useRef();
  useEffect(() => {
    if (!plan?.hotel?.imageUrl) return undefined;
    const image = new Image();
    image.src = plan.hotel.imageUrl;
    return () => { image.src = ''; };
  }, [plan?.hotel?.imageUrl]);
  useEffect(() => {
    if (!plan) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [plan?.id]);
  if (!plan) return null;
  return <div className="plan-detail-modal" role="dialog" aria-modal="true" aria-labelledby="plan-detail-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="plan-detail-shell">
      <header className="plan-modal-head"><div><p className="eyebrow">{tag(plan)}</p><h2 id="plan-detail-title">{plan.label}</h2><p>{plan.note}</p></div><button ref={closeRef} className="plan-modal-close" type="button" onClick={onClose} aria-label="Close plan details"><X /></button></header>
      <div className="plan-modal-summary">
        <div className="plan-modal-total"><span>Total for {travellers} traveller{travellers === 1 ? '' : 's'}</span><strong>{plan.totalText}</strong><small>{plan.sources.join(' · ')}</small></div>
        <div className="plan-modal-facts"><ModePills modes={plan.modes} /><span><Clock3 /> {plan.durationText}</span><span className={plan.coverage.complete ? 'verified' : 'verified partial'}>{plan.coverage.complete ? <ShieldCheck /> : <AlertTriangle />}{plan.coverage.complete ? 'Complete price' : `${plan.coverage.missing.length} cost${plan.coverage.missing.length === 1 ? '' : 's'} missing`}</span></div>
        <div className="plan-modal-actions"><button className="primary-button" type="button" onClick={() => { onClose(); onOpenTour({ ...plan, sourceUrl: sourceUrlFor(plan.sourceUrl, plan.sources.join(' ')), breakdown: plan.breakdown.map((row) => ({ ...row, url: sourceUrlFor(row.url, row.source) })) }); }}><Compass /> Start guided trip</button><a className="source-button" href={sourceUrlFor(plan.sourceUrl, plan.sources.join(' '))} target="_blank" rel="noreferrer"><ShieldCheck /> Open search result <ArrowUpRight /></a></div>
      </div>
      <div className="plan-modal-grid">
        <section className="plan-modal-panel"><div className="detail-label">What the total includes</div><div className="plan-modal-breakdown">{plan.breakdown.map((row) => <a className="breakdown-row" href={sourceUrlFor(row.url, row.source)} target="_blank" rel="noreferrer" key={`${row.label}-${row.source}`}><span>{row.label}<small>{row.source}</small></span><strong>{formatInr(row.amountInr)}</strong></a>)}</div>{result?.observedRange && <div className="breakdown-total"><span>All plan prices</span><strong>{result.observedRange.minText} to {result.observedRange.maxText}</strong></div>}</section>
        <section className="plan-modal-panel"><div className="detail-label">Full route</div><div className="plan-modal-timeline">{plan.timeline.map((stop, index) => <div className="timeline-row" key={`${stop.label}-${index}`}><span className="timeline-time">{formatTripTime(stop.time)}</span><span className="timeline-dot"><i /></span><div><strong>{stop.label}</strong><p>{stop.detail}</p></div>{index < plan.timeline.length - 1 && <span className="timeline-stem" />}</div>)}</div></section>
      </div>
      <div className={`coverage-note plan-modal-coverage ${plan.coverage.complete ? 'complete' : ''}`}>{plan.coverage.complete ? <ShieldCheck /> : <AlertTriangle />}<span>{plan.coverage.complete ? 'This total includes every currently priced part of the plan.' : `Still not priced: ${plan.coverage.missing.join(', ')}.`}</span></div>
    </div>
  </div>;
}

function TripConsole({ job, error, onOpenTour, loadingSavedTrip = false }) {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const result = job?.result;
  const query = job?.query || result?.query;
  const journeys = result?.journeys || [];
  const filters = [
    { value: 'All', label: 'Recommended' },
    { value: 'Lowest total', label: 'Lowest price' },
    { value: 'Fastest', label: 'Fastest' },
    { value: 'Complete only', label: 'Complete trips' },
  ];
  useEffect(() => {
    if (!selected || !journeys.some((journey) => journey.id === selected)) setSelected(journeys[0]?.id || null);
  }, [job?.id, journeys, selected]);
  const visible = useMemo(() => {
    if (filter === 'Lowest total') return [...journeys].sort((a, b) => a.totalInr - b.totalInr);
    if (filter === 'Fastest') return [...journeys].sort((a, b) => (a.durationMinutes || Infinity) - (b.durationMinutes || Infinity));
    if (filter === 'Complete only') return journeys.filter((item) => item.coverage.complete);
    return journeys;
  }, [filter, journeys]);
  const current = visible.find((item) => item.id === selected) || visible[0] || journeys[0];
  const collecting = Boolean(job && !terminalStatuses.has(job.status));
  const offerCount = (result?.offers?.transports?.length || 0) + (result?.offers?.hotels?.length || 0);
  const sourceCount = result?.sources?.filter((source) => source.status === 'complete').length || 0;
  const totalSources = result?.sources?.length || Object.keys(job?.collectors || {}).length || 0;
  const sourceFailures = result?.sources?.filter((source) => source.status === 'failed').length || 0;
  const fromName = query?.from || result?.origin?.name || 'Origin';
  const toName = query?.to || result?.destination?.name || 'Destination';
  const fromCode = result?.origin?.iata || fromName.slice(0, 3).toUpperCase();
  const toCode = result?.destination?.iata || toName.slice(0, 3).toUpperCase();
  const travellers = query?.adults || 1;
  const planTag = (plan) => plan.eyebrow === 'RECOMMENDED' ? 'Recommended' : plan.coverage.complete ? 'Complete trip' : 'Some costs still missing';
  const kayakSearchUrl = job?.collectors?.kayak?.url || result?.sources?.find((source) => source.collectorKey === 'kayak')?.url;
  const sourceUrlFor = (url, source) => /kayak/i.test(source || '') && kayakSearchUrl ? kayakSearchUrl : url || '#';
  const snapshotMessage = collecting
    ? `${offerCount} options ready now. More are being added automatically.`
    : job?.status === 'partial'
      ? 'Some websites did not return data. Missing costs are clearly marked.'
      : sourceFailures
        ? `${sourceFailures} website${sourceFailures === 1 ? '' : 's'} unavailable. The plans below use returned prices only.`
        : 'All travel websites have responded. Prices below are ready to compare.';

  return (
    <section className="compare-section trip-results" id="compare">
      <div className="trip-summary section-shell">
        <div className="trip-summary-copy">
          <p className="eyebrow">Your live trip comparison</p>
          <h1>{fromName}<span>to</span>{toName}</h1>
          <p>See travel and stay combinations together, then choose the plan that fits your time and budget.</p>
          {query && <div className="trip-summary-meta"><span><CalendarDays /> {formatDate(query.departDate)} to {formatDate(query.returnDate)}</span><span><Users /> {travellers} traveller{travellers === 1 ? '' : 's'}</span></div>}
        </div>
        <div className="trip-route-ticket" aria-label={`${fromName} to ${toName}`}>
          <div className="trip-airport"><span>From</span><strong>{fromCode}</strong><small>{fromName}</small></div>
          <div className="ticket-route"><Plane /><i /><span>{collecting ? `${job.progress}% found` : 'Round trip'}</span></div>
          <div className="trip-airport trip-airport-destination"><span>To</span><strong>{toCode}</strong><small>{toName}</small></div>
        </div>
        {result && <div className="trip-overview" aria-label="Trip summary">
          <article className="trip-stat trip-stat-range"><span>Prices found</span><strong>{result.observedRange?.minText || 'Waiting'} <small>to</small> {result.observedRange?.maxText || 'Waiting'}</strong><p>Whole-trip totals currently available</p></article>
          <article className="trip-stat"><span>Plans ready</span><strong>{journeys.length}</strong><p>Travel and stay combinations</p></article>
          <article className="trip-stat"><span>Options checked</span><strong>{offerCount}</strong><p>Across transport and hotels</p></article>
          <article className="trip-stat"><span>Websites checked</span><strong>{sourceCount}<small> / {totalSources}</small></strong><p>Live source responses</p></article>
        </div>}
      </div>

      <div className="console-shell">
        {loadingSavedTrip && <div className="console-loading"><LoaderCircle className="spin" /><span className="eyebrow">Loading your trip</span><h3>Bringing back your comparison</h3><p>Your travel and stay options will appear here in a moment.</p></div>}
        {!job && !error && !loadingSavedTrip && <div className="console-empty"><Compass /><h3>Start with a destination.</h3><p>Choose your cities and dates to compare real travel and stay prices in one place.</p><a className="primary-button" href="/">Plan a trip <ArrowUpRight /></a></div>}
        {error && <div className="console-error"><AlertTriangle /><h3>This trip could not be loaded</h3><p>{error}</p><a href="/" className="primary-button">Start a new search <RefreshCw /></a></div>}
        {collecting && <CollectorProgress job={job} />}
        {job?.status === 'error' && <div className="console-error"><AlertTriangle /><h3>The live search stopped</h3><p>{job.error}</p><a href="/" className="primary-button">Try another search <RefreshCw /></a></div>}
        {result && !journeys.length && <OfferFallback result={result} />}
        {result && journeys.length > 0 && <>
          <div className="console-toolbar">
            <div className="console-brand"><Route /><div><span>Choose a trip plan</span><strong>{journeys.length} plans built from {offerCount} live options</strong></div></div>
            <div className="filter-tabs" role="group" aria-label="Sort trip plans">{filters.map((item) => <button className={filter === item.value ? 'filter-tab active' : 'filter-tab'} type="button" key={item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
          </div>
          <div className={`console-snapshot ${job.status === 'partial' ? 'partial' : ''}`}>{job.status === 'partial' ? <AlertTriangle /> : <ShieldCheck />}<span>{snapshotMessage}</span><time>{new Date(result.collectedAt).toLocaleString()}</time></div>
          <div className="console-grid">
            <div className="trip-list" role="list" aria-label="Trip plans">
              <div className="list-heading"><span>{visible.length} plans</span><span>Total for {travellers}</span></div>
              {visible.map((option) => <button className={current?.id === option.id ? 'trip-row selected' : 'trip-row'} type="button" key={option.id} onClick={() => { setSelected(option.id); setDetailOpen(true); }} aria-pressed={current?.id === option.id}>
                <span className="row-eyebrow">{planTag(option)}</span>
                <span className="row-title">{option.label}</span>
                <ModePills modes={option.modes} />
                <span className="row-total">{option.totalText}<small>{option.sources.join(' · ')}</small></span>
                <span className="row-meta"><Clock3 /> {option.durationText}<i />{option.coverage.complete ? 'Complete price' : `${option.coverage.missing.length} cost${option.coverage.missing.length === 1 ? '' : 's'} missing`}</span>
                <ArrowRight className="row-arrow" />
              </button>)}
            </div>
          </div>
        </>}
      </div>
      <PlanDetailModal plan={detailOpen ? current : null} result={result} travellers={travellers} tag={planTag} sourceUrlFor={sourceUrlFor} onClose={() => setDetailOpen(false)} onOpenTour={onOpenTour} />
    </section>
  );
}

function PipelineSection({ job, health }) {
  const sources = job?.result?.sources || Object.entries(health?.collectors || {}).map(([key, source]) => ({ key, ...source, status: health?.brightData ? 'standby' : 'failed', rows: null }));
  return <section className="network-section" id="network"><div className="network-shade" /><div className="network-grid" aria-hidden="true" /><div className="network-inner section-shell"><div className="network-topline"><span><Route /> Live price sources</span><span>{health?.brightData ? <><Wifi /> Connected</> : <><WifiOff /> Unavailable</>}</span></div><div className="network-copy" id="pipeline"><p className="eyebrow">Prices you can verify</p><h2>Real options,<br />clearly compared.</h2><p>Every price keeps a link to the travel site where it was found. If a site has not replied yet, TripWeave keeps updating the page instead of making up an answer.</p></div><div className="source-table"><div className="source-table-head"><span>Mode</span><span>Website</span><span>Options</span><span>Status</span></div>{sources.map((source) => <div className="source-line" key={source.key}><strong>{String(source.kind || 'source').toUpperCase()}</strong><span>{source.label}</span><span>{source.rows ?? 'Waiting'}</span><span className={`state ${collectorState(source.status)}`}><i />{collectorState(source.status)}</span></div>)}<div className="source-line ai-source-line"><strong>TRIP GUIDE</strong><span>{health?.geminiModel || 'Gemini'}</span><span>uses found options</span><span className={`state ${health?.gemini ? 'healthy' : 'standby'}`}><i />{health?.gemini ? 'ready' : 'key needed'}</span></div></div></div></section>;
}

function HackathonBand() {
  return <section className="hackathon-band"><div className="hackathon-art"><div className="art-route"><span /><span /><span /><span /></div><p>TRIPWEAVE / LIVE</p><strong>Every leg<br />counts.</strong></div><div className="hackathon-copy"><p className="eyebrow">Built for Into the Scrape-Verse</p><h2>One destination. Every way to get there and stay there.</h2><p>Built with Bright Data and Gemini for Into the Scrape-Verse</p><InlineLink href="https://www.wemakedevs.org/hackathons/scrape-verse">View hackathon brief</InlineLink></div></section>;
}

function Footer() {
  return <footer className="site-footer"><div className="footer-signal"><Route /><span>Travel and stay planner</span></div><div className="footer-title">TRIP<span>WEAVE</span></div><div className="footer-grid"><p>Plan travel and stays together, compare the total, and choose what fits your budget.</p><div><span>Prototype</span><strong>Scrape-Verse / 2026</strong></div><a href="#top">Back to top <ArrowUpRight /></a></div></footer>;
}

function TripPage({ job, error, onOpenTour }) {
  return <main className="trip-page"><div className="trip-page-bar"><a href="/"><ChevronLeft /> Back to search</a><span>Live trip comparison</span><span className={job?.status === 'ready' ? 'trip-job-ready' : ''}>{job?.status === 'ready' ? 'Prices ready' : job?.status || 'Loading'}</span></div><TripConsole job={job} error={error} loadingSavedTrip={!job && !error} onOpenTour={onOpenTour} /></main>;
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
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const anchor = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
      if (anchor) anchor.scrollIntoView({ block: 'start', behavior: 'auto' });
      else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);
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
  return <><Navigation job={activeTripJob || job} />{isTripPage ? <TripPage job={activeTripJob} error={requestError} onOpenTour={setTourJourney} /> : <main><Hero health={health} job={null} onSearch={searchTrip} /><ValueSection /><PipelineSection job={null} health={health} /><HackathonBand /></main>}<Footer />{tourJourney && activeTripJob?.result && <Suspense fallback={null}><RouteTour tripId={activeTripJob.id} onClose={() => setTourJourney(null)} trip={activeTripJob.result} journey={tourJourney} /></Suspense>}</>;
}
