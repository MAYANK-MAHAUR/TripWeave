import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight, BedDouble, BusFront, CarFront, ChevronLeft, ChevronRight, CircleAlert,
  Clock3, Compass, Hotel, LoaderCircle, MapPin, Pause, Plane, Play, RotateCcw,
  ShieldCheck, TrainFront, Volume2, VolumeX, X,
} from 'lucide-react';
import { interpolateGreatCircle, midpoint } from './tourGeometry.js';

const Globe = lazy(() => import('react-globe.gl'));
const OPEN_FREE_MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const modeIcon = { Flight: Plane, Train: TrainFront, Bus: BusFront, Cab: CarFront, Van: BusFront };
const modeGlyph = { Flight: '✈', Train: '◆', Bus: '▰', Cab: '●', Van: '▰' };
const fallbackImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"%3E%3Crect width="900" height="600" fill="%230b2632"/%3E%3Cpath d="M0 455L220 260l132 114 132-102 416 328H0z" fill="%23154853"/%3E%3Ccircle cx="690" cy="150" r="72" fill="%238be4c6" opacity=".72"/%3E%3Ctext x="55" y="85" fill="%23f8fbf5" font-family="Arial" font-size="28"%3ESTAY PREVIEW%3C/text%3E%3C/svg%3E';

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
};

function fallbackTour(tripId, trip, journey) {
  const origin = trip.origin;
  const destination = trip.destination;
  const hotel = { ...journey.hotel, lat: destination.lat, lng: destination.lng, locationAccuracy: 'city_fallback', geocodedDisplayName: destination.name };
  const places = (trip.places || []).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)).slice(0, 4);
  const mode = journey.transport?.mode || journey.modes?.find((item) => item !== 'Hotel') || 'Flight';
  const stages = [
    { id: 'overview', scene: 'globe', kind: 'overview', title: `${origin.name} to ${destination.name}`, detail: 'Your complete route, from departure to check-in.', durationMs: 2500, target: origin },
    { id: 'origin', scene: 'globe', kind: 'origin', title: `Starting in ${origin.name}`, detail: origin.airport || origin.iata, durationMs: 3000, target: origin },
    { id: 'route', scene: 'globe', kind: 'route', title: `${mode} to ${destination.name}`, detail: mode === 'Flight' ? 'Following the great-circle flight path.' : 'Following an approximate geographic route.', durationMs: 6000, target: destination },
    { id: 'arrival', scene: 'globe', kind: 'arrival', title: `Arriving in ${destination.name}`, detail: destination.airport || destination.iata, durationMs: 3000, target: destination },
    { id: 'city', scene: 'local', kind: 'city', title: `${destination.name}, up close`, detail: 'Switching from the world view to the streets around your stay.', durationMs: 2600, target: destination },
    { id: 'hotel', scene: 'local', kind: 'hotel', title: hotel.name, detail: hotel.location || destination.name, durationMs: 6000, target: hotel },
    ...places.slice(0, 2).map((place, index) => ({ id: `place-${index + 1}`, scene: 'local', kind: 'attraction', title: place.name, detail: place.category || 'Nearby place', durationMs: 3000, target: place })),
    { id: 'finish', scene: 'local', kind: 'finish', title: 'Your trip, woven together', detail: `${mode}, stay and nearby places in one plan.`, durationMs: 2500, target: hotel },
  ];
  return { tripId, journeyId: journey.id, origin, destination, transport: journey.transport, hotel, places, mode, stages, totalText: journey.totalText, breakdown: journey.breakdown, coverage: journey.coverage, pathAccuracy: mode === 'Flight' ? 'great_circle' : 'approximate' };
}

class VisualErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function GlobeScene({ tour, stage, routeProgress, reducedMotion, onInteract, onError }) {
  const globeRef = useRef();
  const containerRef = useRef();
  const controlsCleanup = useRef();
  const lastFollow = useRef(0);
  const [size, setSize] = useState({ width: 1100, height: 780 });
  const { origin, destination, mode } = tour;
  const vehicle = useMemo(() => {
    const point = interpolateGreatCircle(origin, destination, routeProgress);
    return { ...point, altitude: mode === 'Flight' ? 0.055 + Math.sin(Math.PI * routeProgress) * 0.24 : 0.035, glyph: modeGlyph[mode] || '●' };
  }, [origin, destination, routeProgress, mode]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const resize = () => setSize({ width: Math.max(320, container.clientWidth), height: Math.max(420, container.clientHeight) });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const configure = () => {
    const globe = globeRef.current;
    const controls = globe?.controls?.();
    if (!globe || !controls) return;
    controls.autoRotate = false;
    controls.enableZoom = true;
    controls.enablePan = false;
    const pause = () => onInteract?.();
    controls.addEventListener('start', pause);
    controlsCleanup.current = () => controls.removeEventListener('start', pause);
    const center = midpoint(origin, destination);
    globe.pointOfView({ ...center, altitude: 2.05 }, 0);
  };
  useEffect(() => () => controlsCleanup.current?.(), []);
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !stage) return;
    const instant = reducedMotion ? 0 : 1350;
    if (stage.kind === 'overview') globe.pointOfView({ ...midpoint(origin, destination), altitude: 2.05 }, instant);
    else if (stage.kind === 'origin') globe.pointOfView({ lat: origin.lat, lng: origin.lng, altitude: 0.62 }, instant);
    else if (stage.kind === 'route') globe.pointOfView({ ...midpoint(origin, destination), altitude: 1.32 }, instant);
    else if (stage.kind === 'arrival') globe.pointOfView({ lat: destination.lat, lng: destination.lng, altitude: 0.62 }, instant);
  }, [stage?.id, origin, destination, reducedMotion]);
  useEffect(() => {
    if (stage?.kind !== 'route' || reducedMotion || !globeRef.current) return;
    const now = performance.now();
    if (now - lastFollow.current < 320) return;
    lastFollow.current = now;
    globeRef.current.pointOfView({ lat: vehicle.lat, lng: vehicle.lng, altitude: 0.86 }, 420);
  }, [vehicle.lat, vehicle.lng, stage?.kind, reducedMotion]);
  const activePoint = stage?.kind === 'origin' ? 'origin' : stage?.kind === 'arrival' ? 'destination' : null;
  const points = [
    { id: 'origin', ...origin, label: origin.iata || origin.name, color: '#ff8268' },
    { id: 'destination', ...destination, label: destination.iata || destination.name, color: '#8be4c6' },
  ];
  const arcs = [{ ...origin, startLat: origin.lat, startLng: origin.lng, endLat: destination.lat, endLng: destination.lng, color: ['#ff8268', '#8be4c6'] }];
  const rings = activePoint ? points.filter((point) => point.id === activePoint) : [];
  return <div className="tour-globe-scene" ref={containerRef} aria-label={`Animated ${mode.toLowerCase()} route from ${origin.name} to ${destination.name}`}>
    <VisualErrorBoundary onError={onError} fallback={<VisualFallback tour={tour} />}>
      <Suspense fallback={<div className="tour-visual-loading"><LoaderCircle className="spin" /><span>Preparing the world view</span></div>}>
        <Globe ref={globeRef} width={size.width} height={size.height} onGlobeReady={configure} backgroundColor="#061720" rendererConfig={{ antialias: true, alpha: false }} globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg" bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png" atmosphereColor="#8be4c6" atmosphereAltitude={0.13}
          pointsData={points} pointLat="lat" pointLng="lng" pointColor="color" pointLabel="name" pointRadius={(point) => point.id === activePoint ? 0.68 : 0.42} pointAltitude={0.025}
          labelsData={points} labelLat="lat" labelLng="lng" labelText="label" labelColor={() => '#f8fbf5'} labelSize={0.58} labelDotRadius={0.14} labelAltitude={0.035}
          arcsData={arcs} arcColor="color" arcAltitude={mode === 'Flight' ? 0.27 : 0.07} arcStroke={0.65} arcDashLength={0.42} arcDashGap={0.16} arcDashAnimateTime={mode === 'Flight' ? 1300 : 2400}
          ringsData={rings} ringLat="lat" ringLng="lng" ringColor={() => (t) => `rgba(255,211,122,${1 - t})`} ringMaxRadius={3.2} ringPropagationSpeed={1.8} ringRepeatPeriod={900}
          htmlElementsData={stage?.kind === 'route' ? [vehicle] : []} htmlLat="lat" htmlLng="lng" htmlAltitude="altitude" htmlElement={(item) => { const element = document.createElement('div'); element.className = `tour-vehicle tour-vehicle-${mode.toLowerCase()}`; element.textContent = item.glyph; element.setAttribute('aria-hidden', 'true'); return element; }} animateIn={!reducedMotion} />
      </Suspense>
    </VisualErrorBoundary>
  </div>;
}

function LocalMapScene({ tour, stage, reducedMotion, onInteract, onError }) {
  const containerRef = useRef();
  const mapRef = useRef();
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    let map;
    const markers = [];
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([module]) => {
      if (cancelled || !containerRef.current) return;
      const maplibregl = module.default || module;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: OPEN_FREE_MAP_STYLE,
        center: [tour.destination.lng, tour.destination.lat],
        zoom: 9.5,
        pitch: 42,
        bearing: -12,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      const pause = () => onInteract?.();
      map.on('dragstart', pause);
      map.on('zoomstart', (event) => event.originalEvent && pause());
      map.on('styleimagemissing', (event) => {
        if (!map.hasImage(event.id)) map.addImage(event.id, new ImageData(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1));
      });
      map.once('style.load', () => {
        if (cancelled) return;
        setStatus('ready');
        const routeCoordinates = [[tour.destination.lng, tour.destination.lat], [tour.hotel.lng, tour.hotel.lat], ...tour.places.map((place) => [place.lng, place.lat])];
        map.addSource('trip-local-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoordinates } } });
        map.addLayer({ id: 'trip-local-route-glow', type: 'line', source: 'trip-local-route', paint: { 'line-color': '#8be4c6', 'line-width': 7, 'line-opacity': 0.12 } });
        map.addLayer({ id: 'trip-local-route-line', type: 'line', source: 'trip-local-route', paint: { 'line-color': '#8be4c6', 'line-width': 2.3, 'line-opacity': 0.78, 'line-dasharray': [1.5, 1.3] } });
        const markerData = [
          { ...tour.hotel, markerKind: 'hotel', markerLabel: 'Stay' },
          ...tour.places.map((place, index) => ({ ...place, markerKind: 'place', markerLabel: String(index + 1).padStart(2, '0') })),
        ];
        markerData.forEach((item) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = `tour-map-marker tour-map-marker-${item.markerKind}`;
          const label = document.createElement('span');
          label.textContent = item.markerLabel;
          element.append(label);
          element.setAttribute('aria-label', item.name);
          element.title = item.name;
          const marker = new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([item.lng, item.lat]).addTo(map);
          markers.push(marker);
        });
      });
      map.on('error', (event) => {
        if (!map.loaded() && event?.error) setStatus('slow');
      });
    }).catch(() => { setStatus('failed'); onError?.(); });
    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      map?.remove();
      mapRef.current = null;
    };
  }, [tour.journeyId]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready' || !stage?.target) return;
    const target = stage.target;
    const zoom = stage.kind === 'city' ? 10.4 : stage.kind === 'finish' ? 14.2 : stage.kind === 'hotel' ? 15.8 : 15.1;
    map.flyTo({ center: [target.lng, target.lat], zoom, pitch: stage.kind === 'city' ? 38 : 56, bearing: stage.kind === 'attraction' ? 24 : -12, duration: reducedMotion ? 0 : Math.min(1900, stage.durationMs * 0.55), essential: false });
  }, [stage?.id, status, reducedMotion]);
  if (status === 'failed') return <VisualFallback tour={tour} />;
  return <div className="tour-local-map" aria-label={`Street map around ${tour.hotel.name}`}><div ref={containerRef} className="tour-map-canvas" />{status !== 'ready' && <div className="tour-visual-loading"><LoaderCircle className="spin" /><span>{status === 'slow' ? 'Map tiles are taking longer than usual' : 'Loading the destination map'}</span></div>}<div className="tour-map-key"><span><i className="hotel-key" /> Selected stay</span><span><i /> Nearby places</span></div></div>;
}

function VisualFallback({ tour }) {
  return <div className="tour-visual-fallback" role="status"><CircleAlert /><h3>The interactive map is unavailable.</h3><p>The trip details are still here. Follow the route with the accessible stop list below.</p><ol><li>{tour.origin.name}</li><li>{tour.destination.name}</li><li>{tour.hotel.name}</li>{tour.places.slice(0, 2).map((place) => <li key={place.name}>{place.name}</li>)}</ol></div>;
}

function HotelReveal({ tour, final = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hotel = tour.hotel;
  return <article className={`tour-hotel-card ${final ? 'tour-hotel-final' : ''}`}>
    <div className="tour-hotel-image"><img src={!imageFailed && hotel.imageUrl ? hotel.imageUrl : fallbackImage} onError={() => setImageFailed(true)} alt={hotel.imageUrl && !imageFailed ? `${hotel.name} hotel` : ''} /><span><Hotel /> Your selected stay</span></div>
    <div className="tour-hotel-copy"><div className="tour-hotel-heading"><div><p>{hotel.locationAccuracy === 'matched' ? 'Matched hotel location' : 'Approximate hotel area'}</p><h2>{hotel.name}</h2></div>{hotel.rating && <strong>{hotel.rating}<small>/ {hotel.ratingScale || (Number(hotel.rating) > 5 ? 10 : 5)}</small></strong>}</div><p className="tour-hotel-location"><MapPin /> {hotel.location || hotel.geocodedDisplayName}</p><div className="tour-hotel-facts">{hotel.roomType && <span><BedDouble /> {hotel.roomType}</span>}{hotel.reviewCount && <span><ShieldCheck /> {Number(hotel.reviewCount).toLocaleString()} reviews</span>}<span><Clock3 /> {hotel.priceText || tour.totalText}</span></div><div className="tour-hotel-actions"><a href={hotel.sourceUrl || '#'} target="_blank" rel="noreferrer">View this stay <ArrowUpRight /></a>{final && <a className="tour-plan-link" href={tour.transport?.sourceUrl || '#'} target="_blank" rel="noreferrer">View travel option <ArrowUpRight /></a>}</div></div>
  </article>;
}

function StageCard({ tour, stage }) {
  const Icon = stage.kind === 'hotel' || stage.kind === 'finish' ? Hotel : stage.kind === 'attraction' ? MapPin : modeIcon[tour.mode] || Compass;
  if (stage.kind === 'hotel' || stage.kind === 'finish') return <HotelReveal tour={tour} final={stage.kind === 'finish'} />;
  return <article className="tour-stage-card" aria-live="polite"><span className="tour-stage-icon"><Icon /></span><div><p>{stage.kind === 'attraction' ? 'Nearby highlight' : `${tour.origin.iata} to ${tour.destination.iata}`}</p><h2>{stage.title}</h2><span>{stage.detail}</span>{stage.kind === 'route' && <small>{tour.transport?.operator || tour.mode} · {tour.transport?.outbound?.duration || tour.transport?.durationText || 'Live route'}{tour.pathAccuracy === 'approximate' ? ' · approximate path' : ''}</small>}</div></article>;
}

function playStageChime(audioContextRef) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = audioContextRef.current || new AudioContext();
  audioContextRef.current = context;
  context.resume?.();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(420, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(640, context.currentTime + 0.18);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.25);
}

export default function RouteTour({ tripId, trip, journey, onClose }) {
  const reducedMotion = useReducedMotion();
  const closeRef = useRef();
  const previousFocus = useRef(document.activeElement);
  const progressRef = useRef(0);
  const audioContextRef = useRef();
  const [tour, setTour] = useState(null);
  const [loadNote, setLoadNote] = useState('Matching your hotel to the destination map');
  const [activeIndex, setActiveIndex] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [playing, setPlaying] = useState(!reducedMotion);
  const [muted, setMuted] = useState(true);
  const [visualFailed, setVisualFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const fallback = fallbackTour(tripId, trip, journey);
    fetch(`/api/trips/${tripId}/tour/${encodeURIComponent(journey.id)}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Tour preparation failed.');
      return payload;
    }).then((payload) => { if (!cancelled) setTour(payload); }).catch(() => {
      if (!cancelled) { setLoadNote('Using the destination area while the exact hotel location is unavailable'); setTour(fallback); }
    });
    return () => { cancelled = true; };
  }, [tripId, journey.id]);
  useEffect(() => {
    if (!tour) return;
    setActiveIndex(0);
    progressRef.current = 0;
    setStageProgress(0);
    setPlaying(!reducedMotion);
  }, [tour?.journeyId, reducedMotion]);
  const stages = tour?.stages || [];
  const activeStage = stages[activeIndex];
  const setProgress = (value) => { progressRef.current = value; setStageProgress(value); };
  const goToStage = (index, { pause = false } = {}) => {
    if (!stages.length) return;
    setActiveIndex(Math.max(0, Math.min(stages.length - 1, index)));
    setProgress(0);
    if (pause) setPlaying(false);
  };
  const changeStage = (delta) => goToStage(activeIndex + delta);
  useEffect(() => {
    document.body.classList.add('modal-open');
    const escape = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', escape);
    window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', escape);
      document.body.classList.remove('modal-open');
      previousFocus.current?.focus?.();
      audioContextRef.current?.close?.();
    };
  }, [onClose]);
  useEffect(() => {
    const navigate = (event) => {
      if (event.key === 'ArrowLeft') changeStage(-1);
      if (event.key === 'ArrowRight') changeStage(1);
      if (event.key === ' ' && !['INPUT', 'BUTTON', 'A'].includes(event.target?.tagName)) { event.preventDefault(); setPlaying((value) => !value); }
    };
    document.addEventListener('keydown', navigate);
    return () => document.removeEventListener('keydown', navigate);
  }, [activeIndex, stages.length]);
  useEffect(() => {
    if (!tour || !playing || !activeStage || reducedMotion) return undefined;
    const startingProgress = progressRef.current;
    const startedAt = performance.now();
    let frame;
    let lastPaint = 0;
    const tick = (now) => {
      const value = Math.min(1, startingProgress + (now - startedAt) / activeStage.durationMs);
      if (now - lastPaint > 32 || value === 1) { setProgress(value); lastPaint = now; }
      if (value >= 1) {
        if (activeIndex < stages.length - 1) goToStage(activeIndex + 1);
        else setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tour, playing, activeIndex, activeStage?.id, reducedMotion]);
  useEffect(() => { if (tour && !muted) playStageChime(audioContextRef); }, [activeIndex, muted, tour]);
  if (!tour) return <div className="route-tour-overlay" role="dialog" aria-modal="true" aria-label="Preparing guided trip"><div className="tour-loading-screen"><div className="tour-loader-orbit"><Plane /><i /><i /></div><p>Building your guided trip</p><h1>{trip.origin.name} <span>to</span> {trip.destination.name}</h1><small>{loadNote}</small></div><button ref={closeRef} type="button" className="tour-close" onClick={onClose} aria-label="Close guided route"><X /></button></div>;
  const routeIndex = stages.findIndex((stage) => stage.kind === 'route');
  const routeProgress = activeIndex > routeIndex ? 1 : activeIndex === routeIndex ? stageProgress : 0;
  const totalProgress = ((activeIndex + stageProgress) / stages.length) * 100;
  const onVisualInteraction = () => setPlaying(false);
  return <div className="route-tour-overlay" role="dialog" aria-modal="true" aria-labelledby="route-tour-title">
    <header className="tour-topbar"><div className="tour-brand"><Compass /><span>TRIPWEAVE</span><i />Guided trip</div><div className="tour-route-name"><span>{tour.origin.iata}</span><i /><strong>{tour.mode}</strong><i /><span>{tour.destination.iata}</span></div><button ref={closeRef} type="button" className="tour-close" onClick={onClose} aria-label="Close guided route"><X /></button></header>
    <div className="tour-progress" aria-label={`Tour progress ${Math.round(totalProgress)} percent`}><i style={{ width: `${totalProgress}%` }} /></div>
    <main className="tour-canvas">
      <section className={`tour-scene tour-scene-globe ${activeStage.scene === 'globe' ? 'active' : ''}`} aria-hidden={activeStage.scene !== 'globe'} inert={activeStage.scene !== 'globe'}><GlobeScene tour={tour} stage={activeStage} routeProgress={routeProgress} reducedMotion={reducedMotion} onInteract={onVisualInteraction} onError={() => setVisualFailed(true)} /></section>
      <section className={`tour-scene tour-scene-map ${activeStage.scene === 'local' ? 'active' : ''}`} aria-hidden={activeStage.scene !== 'local'} inert={activeStage.scene !== 'local'}><LocalMapScene tour={tour} stage={activeStage} reducedMotion={reducedMotion} onInteract={onVisualInteraction} onError={() => setVisualFailed(true)} /></section>
      <div className="tour-vignette" aria-hidden="true" />
      <div className="tour-story"><p className="tour-step-label">{String(activeIndex + 1).padStart(2, '0')} / {String(stages.length).padStart(2, '0')} · {activeStage.kind}</p><StageCard tour={tour} stage={activeStage} />{visualFailed && <p className="tour-fallback-note"><CircleAlert /> Interactive graphics are limited, but every stop remains available.</p>}</div>
    </main>
    <footer className="tour-control-deck">
      <nav className="tour-stage-dots" aria-label="Guided trip stages">{stages.map((stage, index) => <button key={stage.id} type="button" className={index === activeIndex ? 'active' : index < activeIndex ? 'complete' : ''} onClick={() => goToStage(index, { pause: true })} aria-label={`Go to ${stage.title}`} aria-current={index === activeIndex ? 'step' : undefined}><i /><span>{stage.kind}</span></button>)}</nav>
      <div className="tour-playback"><button type="button" onClick={() => changeStage(-1)} disabled={activeIndex === 0} aria-label="Previous stop"><ChevronLeft /></button><button type="button" className="tour-play-toggle" onClick={() => { if (activeIndex === stages.length - 1 && stageProgress >= 1) { goToStage(0); if (!reducedMotion) setPlaying(true); } else if (reducedMotion) changeStage(1); else setPlaying((value) => !value); }}>{reducedMotion ? activeIndex === stages.length - 1 ? <><RotateCcw /> Replay tour</> : <><ChevronRight /> Next stop</> : playing ? <><Pause /> Pause tour</> : activeIndex === stages.length - 1 && stageProgress >= 1 ? <><RotateCcw /> Replay tour</> : <><Play /> Resume tour</>}</button><button type="button" onClick={() => activeIndex === stages.length - 1 ? goToStage(0) : changeStage(1)} aria-label={activeIndex === stages.length - 1 ? 'Replay tour' : 'Next stop'}>{activeIndex === stages.length - 1 ? <RotateCcw /> : <ChevronRight />}</button></div>
      <button type="button" className="tour-sound" onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Turn tour sound on' : 'Mute tour sound'}>{muted ? <VolumeX /> : <Volume2 />}<span>{muted ? 'Sound off' : 'Sound on'}</span></button>
    </footer>
  </div>;
}
