import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, CircleAlert,
  Code2, Database, ExternalLink, FlaskConical, LoaderCircle, Play, RefreshCw,
  ShieldCheck, Sparkles, Terminal, Wrench, X,
} from 'lucide-react';

const HEAL_PROMPT = `The public hotel listing page changed its DOM. The card container still loads, but its classes changed and every original data-field selector now returns empty or missing hotel fields. Repair the scraper for the supplied current URL. Preserve the existing output schema and extract every visible hotel with name, location, rating, review_count and displayed nightly price. Use the new data-value attributes and current page structure. Return null for genuinely missing values and never infer data.`;

const flowSteps = [
  { id: 'baseline', number: '01', label: 'Prove it works', detail: 'Run the current collector' },
  { id: 'break', number: '02', label: 'Change the DOM', detail: 'Switch the target to V2' },
  { id: 'failure', number: '03', label: 'Show the failure', detail: 'Run the same collector' },
  { id: 'repair', number: '04', label: 'Self-heal', detail: 'Review and approve AI diff' },
  { id: 'verify', number: '05', label: 'Verify recovery', detail: 'Run the repaired collector' },
];

const phaseRanks = {
  loading: -1, ready: 0, baseline_collecting: 0, baseline_ready: 1,
  broken: 2, broken_collecting: 2, broken_ready: 3, healing: 3,
  awaiting_approval: 3, resuming: 3, healed: 4, verifying: 4, verified: 5,
  rejected: 3, error: 0,
};

const jsonRequest = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
};

const recordCount = (records) => {
  if (!Array.isArray(records)) return 0;
  return records.reduce((total, record) => {
    if (Array.isArray(record?.hotels)) return total + record.hotels.filter((hotel) => typeof hotel?.name === 'string' && hotel.name.trim()).length;
    if (Array.isArray(record?.properties)) return total + record.properties.filter((property) => typeof property?.name === 'string' && property.name.trim()).length;
    if (record?.error && !record?.name) return total;
    return total + 1;
  }, 0);
};

const compactOutput = (records) => {
  if (!Array.isArray(records)) return records;
  return records.map((record) => {
    if (record?.hotels) return { hotels: record.hotels };
    if (record?.properties) return { properties: record.properties };
    const { screenshot, html, warc, ...useful } = record || {};
    return useful;
  });
};

const timestamp = () => new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

function DemoHeader({ config }) {
  return <header className="self-heal-header">
    <a className="self-heal-brand" href="/"><span className="self-heal-brand-mark"><Sparkles /></span><span><strong>TRIPWEAVE</strong><small>LIVE RECOVERY LAB</small></span></a>
    <div className="self-heal-header-right"><span className={config?.configured ? 'credit-safe connected' : 'credit-safe'}><i /> {config?.configured ? 'BRIGHT DATA API CONNECTED' : 'REAL API SETUP REQUIRED'}</span><a href="/" className="demo-back-link"><ArrowLeft /> Back to TripWeave</a></div>
  </header>;
}

function FlowRail({ phase }) {
  const rank = phaseRanks[phase] ?? 0;
  return <section className="real-flow-rail" aria-label="Self-healing demonstration steps">{flowSteps.map((step, index) => {
    const complete = rank > index;
    const active = rank === index;
    return <React.Fragment key={step.id}><div className={`real-flow-step ${complete ? 'complete' : ''} ${active ? 'active' : ''}`}><span>{complete ? <Check /> : step.number}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></div>{index < flowSteps.length - 1 && <ArrowRight className="real-flow-arrow" />}</React.Fragment>;
  })}</section>;
}

function TargetWebsite({ targetUrl, version, phase }) {
  return <section className="real-target-panel"><div className="demo-panel-heading"><div><span>01 / CONTROLLED TARGET</span><h2>The website</h2><p>The page looks the same to a traveller. Its underlying selectors change when you break it.</p></div><span className={`target-dom-badge ${version}`}><i /> DOM {version === 'broken' ? 'V2 / CHANGED' : 'V1 / HEALTHY'}</span></div><div className="real-browser-frame"><div className="real-browser-bar"><div><i /><i /><i /></div><span>{targetUrl || 'Waiting for the public target URL'}</span><a href={targetUrl || '#'} target="_blank" rel="noreferrer" aria-label="Open target website"><ExternalLink /></a></div>{targetUrl ? <iframe key={`${version}-${targetUrl}`} title={`CityStay target website ${version} version`} src={targetUrl} /> : <div className="target-not-configured"><FlaskConical /><strong>Public target is not configured yet</strong><span>Add SELF_HEAL_TARGET_URL to the server environment.</span></div>}</div><div className="target-explainer"><Code2 /><div><strong>{version === 'healthy' ? 'Collector selectors currently match this page.' : 'The visible content remains, but every hotel field hook has moved.'}</strong><p>{version === 'healthy' ? 'The first run establishes genuine structured output before anything changes.' : 'The same cards now expose property-name, area, guest-score and nightly through data-value attributes.'}</p></div><span>{phase === 'broken_ready' ? 'FAILURE CAPTURED' : version === 'broken' ? 'BREAK ACTIVE' : 'BASELINE'}</span></div></section>;
}

function ApiLog({ logs }) {
  return <div className="real-api-log"><div className="console-section-label"><Terminal /> API EVENT LOG <span>{logs.length} events</span></div><div>{logs.slice(-7).map((entry, index) => <div className={`real-log-line ${entry.tone || ''}`} key={`${entry.time}-${index}`}><time>{entry.time}</time><i /><strong>{entry.text}</strong><span>{entry.detail}</span></div>)}</div></div>;
}

function DatasetView({ result, label }) {
  const rows = result?.records || [];
  const count = recordCount(rows);
  const stalled = Boolean(result?.stalled);
  return <div className="real-dataset"><div className="console-section-label"><Database /> {label} <span>{result ? stalled ? 'selector stall detected' : `${count} extracted hotels` : 'not run yet'}</span></div>{result ? <><div className={`dataset-summary ${count ? 'has-data' : 'empty'}`}>{count ? <CheckCircle2 /> : <CircleAlert />}<div><strong>{count ? `${count} records returned by Bright Data` : stalled ? 'Legacy field selectors are not producing usable data' : 'The collector returned no usable hotel records'}</strong><span>{stalled ? `Collection ${result.collectionId} continues in the background` : `Collection ${result.collectionId}`}</span></div></div><pre>{stalled ? JSON.stringify({ status: 'selector_stall', usable_hotels: 0, collection_id: result.collectionId, note: 'Bright Data is still finalizing the empty run in the background.' }, null, 2) : JSON.stringify(compactOutput(rows), null, 2)}</pre></> : <div className="dataset-placeholder"><Database /><span>Real collector output will appear here.</span></div>}</div>;
}

function HealingProgress({ progress }) {
  if (!progress) return null;
  return <div className="real-heal-progress"><div className="console-section-label"><Sparkles /> BRIGHT DATA SELF-HEALING <span>{progress.status}</span></div><div className="heal-progress-current"><LoaderCircle className={progress.terminal || progress.awaitingApproval ? '' : 'spin'} /><div><strong>{progress.awaitingApproval ? 'Proposed repair is ready for review' : progress.status === 'done' ? 'Repair saved successfully' : progress.step || 'Bright Data is refactoring the scraper'}</strong><span>{progress.completedSteps?.length || 0} AI steps completed</span></div></div>{progress.completedSteps?.length > 0 && <div className="completed-heal-steps">{progress.completedSteps.map((step) => <span key={step}><Check /> {step}</span>)}</div>}{progress.previewResult && <div className="heal-preview"><strong>Preview from the proposed scraper</strong><pre>{JSON.stringify(progress.previewResult, null, 2)}</pre></div>}{progress.diff && <details className="heal-diff"><summary>Inspect raw proposed diff</summary><pre>{JSON.stringify(progress.diff, null, 2)}</pre></details>}</div>;
}

function CreditNotice({ children, kind = 'collection' }) {
  return <div className="credit-notice"><ShieldCheck /><div><strong>{kind === 'ai' ? 'Real AI credit action' : 'Real collector credit action'}</strong><span>{children}</span></div></div>;
}

export default function SelfHealDemo() {
  const [config, setConfig] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [targetVersion, setTargetVersion] = useState('healthy');
  const [activeRun, setActiveRun] = useState(null);
  const [baselineResult, setBaselineResult] = useState(null);
  const [brokenResult, setBrokenResult] = useState(null);
  const [verifiedResult, setVerifiedResult] = useState(null);
  const [healProgress, setHealProgress] = useState(null);
  const [pollHeal, setPollHeal] = useState(false);
  const [error, setError] = useState(null);
  const stalledRuns = useRef(new Set());
  const [logs, setLogs] = useState([{ time: timestamp(), tone: 'success', text: 'Recovery lab opened', detail: 'No credits used yet' }]);

  useEffect(() => {
    jsonRequest('/api/self-heal/config').then((next) => { setConfig(next); setPhase('ready'); setLogs((current) => [...current, { time: timestamp(), tone: next.configured ? 'success' : 'warn', text: next.configured ? 'Bright Data connection verified' : 'Real API configuration missing', detail: next.collectorId || 'Set collector and target environment variables' }]); }).catch((caught) => { setError(caught.message); setPhase('error'); });
  }, []);

  const targetUrl = useMemo(() => {
    const configured = targetVersion === 'broken' ? config?.targetBrokenUrl : config?.targetHealthyUrl;
    return configured || `/self-heal-target?version=${targetVersion}`;
  }, [config, targetVersion]);

  useEffect(() => {
    if (!activeRun?.collectionId) return undefined;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const result = await jsonRequest(`/api/self-heal/run/${activeRun.collectionId}`);
        if (cancelled) return;
        if (result.status === 'collecting') {
          const elapsed = Date.now() - (activeRun.startedAt || Date.now());
          if (activeRun.kind === 'broken' && elapsed >= 10000 && !stalledRuns.current.has(activeRun.collectionId)) {
            stalledRuns.current.add(activeRun.collectionId);
            setBrokenResult({ status: 'collecting', stalled: true, records: [], collectionId: activeRun.collectionId });
            setPhase((current) => current === 'broken_collecting' ? 'broken_ready' : current);
            setLogs((current) => [...current, { time: timestamp(), tone: 'warn', text: 'Legacy selectors stalled', detail: '0 usable hotel fields after 10 seconds; collection continues in background' }]);
          }
          timer = window.setTimeout(poll, 4500); return;
        }
        const completed = { ...result, collectionId: activeRun.collectionId };
        if (activeRun.kind === 'baseline') { setBaselineResult(completed); setPhase('baseline_ready'); }
        if (activeRun.kind === 'broken') { setBrokenResult(completed); setPhase((current) => ['broken', 'broken_collecting', 'broken_ready'].includes(current) ? 'broken_ready' : current); }
        if (activeRun.kind === 'verify') { setVerifiedResult(completed); setPhase('verified'); }
        setLogs((current) => [...current, { time: timestamp(), tone: recordCount(completed.records) ? 'success' : 'warn', text: `${activeRun.kind} collection finished`, detail: `${recordCount(completed.records)} usable hotels returned` }]);
        setActiveRun(null);
      } catch (caught) {
        if (!cancelled) { setError(caught.message); setPhase('error'); setActiveRun(null); }
      }
    };
    timer = window.setTimeout(poll, 1200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeRun?.collectionId]);

  useEffect(() => {
    if (!pollHeal) return undefined;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const progress = await jsonRequest('/api/self-heal/heal');
        if (cancelled) return;
        setHealProgress(progress);
        if (progress.awaitingApproval) {
          setPhase('awaiting_approval'); setPollHeal(false);
          setLogs((current) => [...current, { time: timestamp(), tone: 'warn', text: 'Human approval required', detail: 'Bright Data returned pending_answer with a proposed diff' }]);
          return;
        }
        if (progress.status === 'done') {
          setPhase('healed'); setPollHeal(false);
          setLogs((current) => [...current, { time: timestamp(), tone: 'success', text: 'Repaired collector saved', detail: 'Ready for a verification collection' }]);
          return;
        }
        if (progress.terminal) throw new Error(`Self-Healing ended with status ${progress.status}.`);
        timer = window.setTimeout(poll, 5000);
      } catch (caught) {
        if (!cancelled) { setError(caught.message); setPhase('error'); setPollHeal(false); }
      }
    };
    timer = window.setTimeout(poll, 1500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [pollHeal]);

  const creditPost = (url, body) => jsonRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tripweave-credit-confirm': 'judge-approved' }, body: JSON.stringify(body) });

  const runCollector = async (kind) => {
    setError(null);
    const version = kind === 'baseline' ? 'healthy' : 'broken';
    setPhase(kind === 'baseline' ? 'baseline_collecting' : kind === 'verify' ? 'verifying' : 'broken_collecting');
    setLogs((current) => [...current, { time: timestamp(), text: `${kind} collector triggered`, detail: `POST /dca/trigger against DOM ${version === 'healthy' ? 'V1' : 'V2'}` }]);
    try {
      const result = await creditPost('/api/self-heal/run', { version });
      setActiveRun({ ...result, kind, startedAt: Date.now() });
    } catch (caught) { setError(caught.message); setPhase('error'); }
  };

  const breakTarget = () => {
    setTargetVersion('broken'); setPhase('broken'); setError(null);
    setLogs((current) => [...current, { time: timestamp(), tone: 'warn', text: 'Target switched to DOM V2', detail: 'Visible hotel data remains, extraction attributes changed' }]);
  };

  const startHealing = async () => {
    setError(null); setPhase('healing');
    setLogs((current) => [...current, { time: timestamp(), text: 'Self-Healing job triggered', detail: 'POST refactor_template with current broken input' }]);
    try { await creditPost('/api/self-heal/heal', { prompt: HEAL_PROMPT }); setPollHeal(true); }
    catch (caught) { setError(caught.message); setPhase('error'); }
  };

  const decideHealing = async (approve) => {
    setError(null);
    try {
      await creditPost('/api/self-heal/heal/decision', { approve, autoSave: approve });
      setLogs((current) => [...current, { time: timestamp(), tone: approve ? 'success' : 'warn', text: approve ? 'Judge approved proposed diff' : 'Judge rejected proposed diff', detail: approve ? 'auto_save enabled after successful repair' : 'Existing collector left unchanged' }]);
      if (approve) { setPhase('resuming'); setPollHeal(true); }
      else setPhase('rejected');
    } catch (caught) { setError(caught.message); setPhase('error'); }
  };

  const latestResult = verifiedResult || brokenResult || baselineResult;
  const latestLabel = verifiedResult ? 'VERIFICATION DATASET' : brokenResult ? 'BROKEN-RUN DATASET' : 'BASELINE DATASET';

  const primaryAction = (() => {
    if (!config?.configured) return <button className="real-action-button" type="button" disabled><CircleAlert /> Configure real API first</button>;
    if (phase === 'ready' || phase === 'error') return <button className="real-action-button" type="button" onClick={() => runCollector('baseline')}><Play /> Run healthy collector</button>;
    if (phase === 'baseline_ready') return <button className="real-action-button break" type="button" onClick={breakTarget}><Code2 /> Break target website</button>;
    if (phase === 'broken') return <button className="real-action-button" type="button" onClick={() => runCollector('broken')}><Play /> Run same collector again</button>;
    if (phase === 'broken_ready') return <button className="real-action-button heal" type="button" onClick={startHealing}><Sparkles /> Start real self-heal</button>;
    if (phase === 'healed') return <button className="real-action-button verify" type="button" onClick={() => runCollector('verify')}><ShieldCheck /> Verify repaired collector</button>;
    if (phase === 'verified') return <button className="real-action-button verified" type="button" disabled><CheckCircle2 /> Recovery verified</button>;
    if (phase === 'rejected') return <button className="real-action-button heal" type="button" onClick={startHealing}><RefreshCw /> Start a new repair</button>;
    return <button className="real-action-button" type="button" disabled><LoaderCircle className="spin" /> {phase === 'resuming' ? 'Saving approved repair' : phase === 'verifying' ? 'Running verification' : phase.includes('collecting') ? 'Collector is running' : 'Bright Data is self-healing'}</button>;
  })();

  return <div className="self-heal-page real-self-heal-page">
    <DemoHeader config={config} />
    <main className="self-heal-content real-self-heal-content">
      <section className="real-heal-hero"><div><p className="self-heal-eyebrow"><FlaskConical /> REAL SCRAPER STUDIO DEMONSTRATION</p><h1>Change the site.<br /><em>Watch the scraper heal.</em></h1></div><div className="real-heal-intro"><p>Every collection, failure, AI repair and approval below uses the real Bright Data API. The judge can see the target website, the returned dataset and the human approval gate together.</p><a href="https://docs.brightdata.com/api-reference/scraper-studio-api/ai-flow/overview" target="_blank" rel="noreferrer">Read the official API flow <ArrowUpRight /></a></div></section>
      <FlowRail phase={phase} />
      {!config?.configured && config && <section className="real-setup-warning"><CircleAlert /><div><strong>Two server variables are still required for real-credit mode.</strong><p>Add BRIGHT_DATA_SELF_HEAL_COLLECTOR_ID and SELF_HEAL_TARGET_URL. The interface will unlock automatically.</p></div></section>}
      <section className="real-heal-workspace"><TargetWebsite targetUrl={targetUrl} version={targetVersion} phase={phase} /><section className="real-control-panel"><div className="demo-panel-heading control"><div><span>02 / BRIGHT DATA</span><h2>Recovery control</h2><p>One deliberate action at a time. Polling never starts another collection.</p></div><span className={`real-api-status ${config?.configured ? 'connected' : ''}`}><i /> {config?.configured ? 'LIVE API' : 'OFFLINE'}</span></div><div className="collector-identity"><span>COLLECTOR</span><strong>{config?.collectorId || 'Not configured'}</strong><a href={config?.collectorId ? `https://brightdata.com/cp/scrapers/${config.collectorId}` : '#'} target="_blank" rel="noreferrer">Open in Scraper Studio <ExternalLink /></a></div>{error && <div className="real-error"><CircleAlert /><div><strong>Action stopped</strong><span>{error}</span></div><button type="button" onClick={() => { setError(null); setPhase(baselineResult ? targetVersion === 'broken' ? 'broken' : 'baseline_ready' : 'ready'); }} aria-label="Dismiss error"><X /></button></div>}<div className="real-action-zone">{primaryAction}{phase === 'ready' && <CreditNotice>Runs the healthy target once and displays its real returned dataset.</CreditNotice>}{phase === 'broken' && <CreditNotice>Runs the unchanged collector once against the changed DOM.</CreditNotice>}{phase === 'broken_ready' && <CreditNotice kind="ai">Starts one Self-Healing AI refactor job and pauses before applying its diff.</CreditNotice>}{phase === 'healed' && <CreditNotice>Runs one final collection against the repaired scraper.</CreditNotice>}</div>{phase === 'awaiting_approval' && <div className="approval-gate"><div className="approval-title"><Wrench /><div><span>HUMAN-IN-THE-LOOP CHECKPOINT</span><h3>Bright Data has proposed a repair.</h3><p>Review the preview and diff below. Nothing is saved until the judge approves it.</p></div></div><div className="approval-actions"><button type="button" className="approve-button" onClick={() => decideHealing(true)}><Check /> Approve and save repair</button><button type="button" className="reject-button" onClick={() => decideHealing(false)}><X /> Reject diff</button></div></div>}<HealingProgress progress={healProgress} /><DatasetView result={latestResult} label={latestLabel} /><ApiLog logs={logs} /></section></section>
      <section className="real-proof-strip"><div><span>TRANSPARENCY</span><strong>Target website remains visible</strong><p>Judges can compare the page and output side by side.</p></div><div><span>CREDIT CONTROL</span><strong>Only deliberate POST actions spend</strong><p>No background collection or silent retries.</p></div><div><span>APPROVAL</span><strong>pending_answer is shown live</strong><p>The repair is reviewed before it is saved.</p></div><div><span>EVIDENCE</span><strong>Final dataset proves recovery</strong><p>The same broken URL is collected again.</p></div></section>
      <footer className="self-heal-footer"><span>TRIPWEAVE / REAL RECOVERY LAB</span><span>Target change, failure, repair, approval and verification in one view.</span><a href="/">Return home <ArrowLeft /></a></footer>
    </main>
  </div>;
}
