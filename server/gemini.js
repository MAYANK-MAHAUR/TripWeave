const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const cleanJson = (text) => {
  const value = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(value);
};

export async function enrichWithGemini({ query, origin, destination, journeys, places }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { enabled: false, model: MODEL(), message: 'Add GEMINI_API_KEY on the server to enable AI trip narration.' };
  const evidence = {
    query,
    origin,
    destination,
    journeys: journeys.slice(0, 4).map(({ id, label, totalInr, durationMinutes, modes, sources, coverage }) => ({ id, label, totalInr, durationMinutes, modes, sources, coverage })),
    places: places.slice(0, 10),
  };
  const prompt = `You are TripWeave's route editor. Use ONLY the supplied scraped journey facts and OpenStreetMap places. Never invent a price, hotel, flight, time, route, or attraction. Return JSON with: summary (max 45 words), recommendation_reason (max 28 words), selected_journey_id, and tour_stop_names (up to 4 exact names copied from places). Prefer a complete journey; if coverage is partial, say so plainly. Evidence: ${JSON.stringify(evidence)}`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL())}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.25, maxOutputTokens: 500 } }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini request failed.');
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('');
    return { enabled: true, model: MODEL(), ...cleanJson(text) };
  } catch (error) {
    return { enabled: false, model: MODEL(), message: error.message };
  }
}
