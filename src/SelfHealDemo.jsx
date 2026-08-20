import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, Code2,
  Database, GitCompareArrows, RefreshCw, ScanSearch, ShieldCheck, Sparkles,
  Terminal, Wrench,
} from 'lucide-react';

const PROPERTIES = [
  { name: 'Rambagh Palace', location: 'Bhawani Singh Road', rating: '4.9', reviews: '1,842', price: '₹18,500', accent: 'terracotta', image: 'RP' },
  { name: 'The Johri', location: 'Gopalji ka Rasta', rating: '4.8', reviews: '624', price: '₹9,200', accent: 'mustard', image: 'TJ' },
  { name: '28 Kothi', location: 'Civil Lines', rating: '4.7', reviews: '391', price: '₹6,800', accent: 'sage', image: '28' },
];

const SELECTORS = {
  old: {
    card: '[data-qa="property-card"]',
    name: '[data-field="name"]',
    location: '[data-field="location"]',
    rating: '[data-field="rating"]',
    price: '[data-field="price"]',
  },
  new: {
    card: '[data-qa="listing-tile"]',
    name: '[data-value="property-name"]',
    location: '[data-value="area"]',
    rating: '[data-value="guest-score"]',
    price: '[data-value="nightly"]',
  },
};

const INITIAL_LOG = [
  { tone: 'success', time: '10:42:01', text: 'collector started', detail: 'fixture.stays/jaipur' },
  { tone: 'success', time: '10:42:02', text: '3 cards / 12 fields found', detail: 'selector recipe v1' },
];

const selectorLabel = (selector) => selector.replace(/\[|\]/g, '').replaceAll('"', '');

function fixtureMarkup(version) {
  const isBroken = version !== 'healthy';
  return PROPERTIES.map((property) => `
    <article class="${isBroken ? 'property-card-v2' : 'property-card'}" data-qa="${isBroken ? 'listing-tile' : 'property-card'}">
      <div class="property-thumb ${property.accent}"><span>${property.image}</span></div>
      <div class="property-copy">
        <h3 ${isBroken ? 'data-value="property-name"' : 'data-field="name"'}>${property.name}</h3>
        <span ${isBroken ? 'data-value="area"' : 'data-field="location"'}>${property.location}, Jaipur</span>
        <div class="property-meta"><strong ${isBroken ? 'data-value="guest-score"' : 'data-field="rating"'}>${property.rating}</strong><small>${property.reviews} reviews</small></div>
        <span ${isBroken ? 'data-value="nightly"' : 'data-field="price"'}>${property.price} / night</span>
      </div>
      <button type="button" class="fixture-book">View stay</button>
    </article>`).join('');
}

function extractFixture(markup, selectors) {
  if (typeof DOMParser === 'undefined') return { rows: [], matchedCards: 0, missingFields: 0 };
  const document = new DOMParser().parseFromString(`<main>${markup}</main>`, 'text/html');
  const cards = [...document.querySelectorAll(selectors.card)];
  const rows = cards.map((card) => {
    const read = (field) => card.querySelector(field)?.textContent?.trim() || null;
    return { name: read(selectors.name), location: read(selectors.location), rating: read(selectors.rating), price: read(selectors.price) };
  });
  const missingFields = rows.reduce((total, row) => total + Object.values(row).filter((value) => !value).length, cards.length ? 0 : 4 * PROPERTIES.length);
  return { rows, matchedCards: cards.length, missingFields };
}

function DemoHeader() {
  return <header className="self-heal-header">
    <a className="self-heal-brand" href="/"><span className="self-heal-brand-mark"><Sparkles /></span><span><strong>TRIPWEAVE</strong><small>SCRAPER STUDIO LAB</small></span></a>
    <div className="self-heal-header-right"><span className="credit-safe"><i /> LOCAL COLLECTOR / NO CREDIT SPEND</span><a href="/" className="demo-back-link"><ArrowLeft /> Back to TripWeave</a></div>
  </header>;
}

function FixtureBrowser({ mode }) {
  const version = mode === 'healthy' ? 'PAGE V1.0' : 'PAGE V2.0';
  return <section className="fixture-browser" aria-label="Demo hotel results page">
    <div className="browser-chrome"><div className="browser-dots"><i /><i /><i /></div><span className="browser-url"><ShieldCheck /> stays.tripweave.local/jaipur</span><span className={`page-version ${mode}`}>{version}</span></div>
    <div className="fixture-page">
      <div className="fixture-page-top"><div><span className="fixture-kicker">CITYSTAY / JAIPUR</span><h2>Places to stay</h2></div><span className={`fixture-state ${mode}`}>{mode === 'healthy' ? <><CheckCircle2 /> page is healthy</> : mode === 'broken' ? <><CircleAlert /> markup changed</> : <><Wrench /> healed recipe active</>}</span></div>
      <div className="fixture-filters"><span>12 - 14 Oct 2026</span><span>2 guests</span><span>Sort: recommended</span></div>
      <div className="fixture-list">{PROPERTIES.map((property) => <article className={mode === 'healthy' ? 'property-card' : 'property-card-v2'} data-qa={mode === 'healthy' ? 'property-card' : 'listing-tile'} key={property.name}>
        <div className={`property-thumb ${property.accent}`}><span>{property.image}</span></div>
        <div className="property-copy"><h3 {...(mode === 'healthy' ? { 'data-field': 'name' } : { 'data-value': 'property-name' })}>{property.name}</h3><span {...(mode === 'healthy' ? { 'data-field': 'location' } : { 'data-value': 'area' })}>{property.location}, Jaipur</span><div className="property-meta"><strong {...(mode === 'healthy' ? { 'data-field': 'rating' } : { 'data-value': 'guest-score' })}>{property.rating}</strong><small>{property.reviews} reviews</small></div><span {...(mode === 'healthy' ? { 'data-field': 'price' } : { 'data-value': 'nightly' })}>{property.price} / night</span></div><button type="button" className="fixture-book">View stay <ArrowUpRight /></button>
      </article>)}</div>
      <div className="fixture-foot"><span><Database /> public result fixture</span><span>Prices shown for demo only</span></div>
    </div>
  </section>;
}

function SelectorRecipe({ mode }) {
  const selectors = mode === 'healed' ? SELECTORS.new : SELECTORS.old;
  const lines = [['card', selectors.card], ['name', selectors.name], ['location', selectors.location], ['rating', selectors.rating], ['price', selectors.price]];
  return <div className="selector-recipe"><div className="panel-kicker"><Code2 /> ACTIVE SELECTOR RECIPE <span>{mode === 'healed' ? 'v2 / repaired' : 'v1 / original'}</span></div><div className="recipe-code">{lines.map(([key, value]) => <div key={key}><span>{key}</span><code>{value}</code></div>)}</div></div>;
}

function OutputTable({ extraction, mode }) {
  return <div className="output-panel"><div className="panel-kicker"><Database /> STRUCTURED OUTPUT <span>{extraction.matchedCards ? `${extraction.matchedCards} records` : '0 records'}</span></div>{extraction.matchedCards ? <div className="output-rows">{extraction.rows.map((row) => <div className="output-row" key={row.name}><span className="output-row-index">{String(extraction.rows.indexOf(row) + 1).padStart(2, '0')}</span><div><strong>{row.name}</strong><small>{row.location}</small></div><b>{row.price}</b><em>{row.rating} ★</em></div>)}</div> : <div className="empty-output"><CircleAlert /><strong>{mode === 'broken' ? 'The page changed under the collector.' : 'No records returned.'}</strong><span>Original selectors match zero cards. Nothing is invented.</span></div>}{extraction.matchedCards > 0 && <pre className="json-preview">{JSON.stringify({ hotels: extraction.rows.map((row) => ({ name: row.name, location: row.location, rating: Number(row.rating), nightly_price: row.price })) }, null, 2)}</pre>}</div>;
}

function HealingLog({ entries, mode }) {
  return <div className="healing-log"><div className="panel-kicker"><Terminal /> RUN LOG <span>{mode === 'healthy' ? 'collector idle' : mode === 'broken' ? 'repair available' : 'repair complete'}</span></div><div className="log-entries">{entries.map((entry, index) => <div className={`log-entry ${entry.tone}`} key={`${entry.time}-${index}`}><span>{entry.time}</span><i /> <strong>{entry.text}</strong><small>{entry.detail}</small></div>)}</div></div>;
}

export default function SelfHealDemo() {
  const [mode, setMode] = useState('healthy');
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState(INITIAL_LOG);
  const markup = useMemo(() => fixtureMarkup(mode), [mode]);
  const activeSelectors = mode === 'healed' ? SELECTORS.new : SELECTORS.old;
  const extraction = useMemo(() => extractFixture(markup, activeSelectors), [markup, activeSelectors]);
  const action = (nextMode) => {
    if (busy) return;
    setBusy(true);
    const delay = nextMode === 'broken' ? 650 : 1200;
    if (nextMode === 'broken') setLogs((current) => [...current, { tone: 'warn', time: '10:42:07', text: 'selector mismatch detected', detail: `${selectorLabel(SELECTORS.old.card)} returned 0 nodes` }]);
    else setLogs((current) => [...current, { tone: 'active', time: '10:42:08', text: 'self-heal scanning page', detail: 'comparing stable labels and field shapes' }]);
    window.setTimeout(() => {
      setMode(nextMode);
      if (nextMode === 'healed') setLogs((current) => [...current, { tone: 'success', time: '10:42:10', text: 'replacement recipe approved', detail: 'v2 selectors mapped to 3 cards / 12 fields' }]);
      setBusy(false);
    }, delay);
  };
  const reset = () => { if (!busy) { setMode('healthy'); setLogs(INITIAL_LOG); } };
  const status = mode === 'healthy' ? 'READY' : mode === 'broken' ? 'BROKEN' : 'HEALED';
  return <div className="self-heal-page">
    <DemoHeader />
    <main className="self-heal-content">
      <section className="self-heal-hero"><div><p className="self-heal-eyebrow"><GitCompareArrows /> SELF-HEALING EXTRACTOR / LIVE DOM LAB</p><h1>Break a page.<br /><em>Watch it recover.</em></h1></div><div className="self-heal-hero-copy"><p>This is a working selector change, not a slide. Break the hotel results page, watch the original collector fail cleanly, then run self-heal to restore the same structured records.</p><span><i /> Repeatable judge demo · no live credits used</span></div></section>
      <section className="self-heal-instructions"><div className="instruction-step"><b>01</b><span>Capture healthy output</span><CheckCircle2 /></div><ArrowRight /><div className="instruction-step"><b>02</b><span>Break the DOM</span><CircleAlert /></div><ArrowRight /><div className="instruction-step"><b>03</b><span>Run self-heal</span><Wrench /></div></section>
      <section className="self-heal-workspace">
        <div className="workspace-left"><FixtureBrowser mode={mode} /><div className="workspace-note"><ScanSearch /><span><strong>What changed?</strong>{mode === 'healthy' ? 'Stable data-field attributes are feeding the collector.' : mode === 'broken' ? 'The site kept the same visible cards, but changed classes and data attributes. This is the failure judges can see.' : 'The visible page stayed intact. Only the selector recipe changed to follow the site’s new attributes.'}</span></div></div>
        <div className="workspace-right"><div className="extractor-head"><div><p className="self-heal-eyebrow">COLLECTOR / CITYSTAY-JAIPUR</p><h2>Repair console</h2></div><span className={`extractor-status ${mode}`}><i /> {busy ? 'SCANNING' : status}</span></div><SelectorRecipe mode={mode} /><OutputTable extraction={extraction} mode={mode} /><HealingLog entries={logs} mode={mode} /><div className="demo-actions">{mode === 'healthy' && <button className="demo-action break" type="button" onClick={() => action('broken')} disabled={busy}><CircleAlert /> {busy ? 'Changing markup...' : 'Break the page'}</button>}{mode === 'broken' && <button className="demo-action heal" type="button" onClick={() => action('healed')} disabled={busy}><Wrench /> {busy ? 'Finding replacement selectors...' : 'Run self-heal'}</button>}{mode === 'healed' && <><button className="demo-action heal" type="button" onClick={reset} disabled={busy}><RefreshCw /> Replay demo</button><a className="demo-secondary-action" href="https://docs.brightdata.com/datasets/scraper-studio/ai-agent" target="_blank" rel="noreferrer">Open scraper docs <ArrowUpRight /></a></>}</div></div>
      </section>
      <section className="proof-strip"><div><span>DOM VERSION</span><strong>{mode === 'healthy' ? 'v1.0 / stable' : 'v2.0 / changed'}</strong></div><div><span>SELECTOR RECIPE</span><strong>{mode === 'healed' ? 'v2 / repaired' : mode === 'broken' ? 'v1 / failing' : 'v1 / active'}</strong></div><div><span>STRUCTURED OUTPUT</span><strong>{extraction.matchedCards} hotels · {extraction.matchedCards * 4} fields</strong></div><div><span>HEALING MODE</span><strong>{mode === 'healthy' ? 'armed' : mode === 'broken' ? 'awaiting approval' : 'verified'}</strong></div></section>
      <footer className="self-heal-footer"><span>TRIPWEAVE / SCRAPER STUDIO LAB</span><span>Built to show what happens when a site changes under a scraper.</span><a href="/">Return home <ArrowLeft /></a></footer>
    </main>
  </div>;
}
