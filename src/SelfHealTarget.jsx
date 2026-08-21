import React from 'react';
import { CalendarDays, MapPin, Search, ShieldCheck, Star } from 'lucide-react';

const stays = [
  { name: 'Rambagh Palace', location: 'Bhawani Singh Road, Jaipur', rating: '4.9', reviews: '1,842 reviews', price: '₹18,500', code: 'RP', tone: 'coral' },
  { name: 'The Johri', location: 'Gopalji ka Rasta, Jaipur', rating: '4.8', reviews: '624 reviews', price: '₹9,200', code: 'TJ', tone: 'ochre' },
  { name: '28 Kothi', location: 'Civil Lines, Jaipur', rating: '4.7', reviews: '391 reviews', price: '₹6,800', code: '28', tone: 'leaf' },
];

function HealthyStay({ stay }) {
  return <article className="target-hotel-card" data-qa="property-card">
    <div className={`target-hotel-image ${stay.tone}`}><span>{stay.code}</span></div>
    <div className="target-hotel-copy"><h2 className="target-hotel-name" data-field="name">{stay.name}</h2><p className="target-hotel-location" data-field="location"><MapPin /> {stay.location}</p><div className="target-hotel-rating"><strong data-field="rating">{stay.rating}</strong><Star /><span>{stay.reviews}</span></div></div>
    <div className="target-hotel-price"><small>Price per night</small><strong data-field="price">{stay.price}</strong><button type="button">See rooms</button></div>
  </article>;
}

function BrokenStay({ stay }) {
  return <section className="target-stay-result" data-qa="listing-tile-v2">
    <div className={`target-hotel-image ${stay.tone}`}><span>{stay.code}</span></div>
    <div className="target-hotel-copy"><p className="target-stay-title" data-value="property-name">{stay.name}</p><div className="target-neighbourhood" data-value="area"><MapPin /> {stay.location}</div><div className="target-hotel-rating"><em data-value="guest-score">{stay.rating}</em><Star /><span>{stay.reviews}</span></div></div>
    <aside className="target-hotel-price"><small>Price per night</small><span className="target-nightly-cost" data-value="nightly">{stay.price}</span><button type="button">See rooms</button></aside>
  </section>;
}

export default function SelfHealTarget() {
  const version = new URLSearchParams(window.location.search).get('version') === 'broken' ? 'broken' : 'healthy';
  const Stay = version === 'broken' ? BrokenStay : HealthyStay;
  return <main className={`self-heal-target ${version}`}>
    <header className="target-site-header"><a href="/self-heal" className="target-site-brand"><span>CS</span><strong>CITYSTAY</strong></a><nav><a href="#results">Stays</a><a href="#results">Trips</a><a href="#results">Saved</a></nav><span className="target-version"><i /> DEMO TARGET / DOM {version === 'broken' ? 'V2' : 'V1'}</span></header>
    <section className="target-search"><div><p>Stay somewhere memorable</p><h1>Jaipur stays,<br />clearly compared.</h1></div><form><label><span>Destination</span><strong><MapPin /> Jaipur</strong></label><label><span>Check in</span><strong><CalendarDays /> 12 Oct 2026</strong></label><label><span>Check out</span><strong><CalendarDays /> 14 Oct 2026</strong></label><button type="button"><Search /> Search stays</button></form></section>
    <section className="target-results" id="results"><div className="target-results-head"><div><p><ShieldCheck /> Public hotel prices</p><h2>3 stays found</h2></div><span>Recommended first</span></div><div className="target-stay-list">{stays.map((stay) => <Stay stay={stay} key={stay.name} />)}</div></section>
    <footer className="target-site-footer"><strong>CITYSTAY</strong><span>This controlled target exists only to demonstrate real scraper recovery.</span><span>Jaipur / public fixture</span></footer>
  </main>;
}
