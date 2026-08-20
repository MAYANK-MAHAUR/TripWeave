const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.7-flash';
const FALLBACK_MODELS = () => (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash,gemini-3.5-flash').split(',').map((model) => model.trim()).filter(Boolean);
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    recommendation_reason: { type: 'STRING' },
    selected_journey_id: { type: 'STRING' },
    tour_stop_names: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['summary', 'recommendation_reason', 'selected_journey_id', 'tour_stop_names'],
};

const cleanJson = (text) => {
  const value = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(value);
};

async function callModel(model, apiKey, prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_SCHEMA,
        temperature: 0.15,
        maxOutputTokens: 1600,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gemini ${model} request failed.`);
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('');
  return cleanJson(text);
}

export async function enrichWithGemini({ query, origin, destination, journeys, places }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { enabled: false, model: MODEL(), message: 'Add GEMINI_API_KEY on the server to enable AI trip narration.' };
  if (!journeys.length) return { enabled: false, model: MODEL(), message: 'No composed journey is available for AI narration.' };
  const evidence = {
    query,
    origin,
    destination,
    journeys: journeys.slice(0, 4).map(({ id, label, totalInr, durationMinutes, modes, sources, coverage }) => ({ id, label, totalInr, durationMinutes, modes, sources, coverage })),
    places: places.slice(0, 10),
  };
  const prompt = `You are TripWeave's route editor. Use ONLY the supplied scraped journey facts and OpenStreetMap places. Never invent a price, hotel, flight, time, route, or attraction. Return JSON with: summary (max 45 words), recommendation_reason (max 28 words), selected_journey_id, and tour_stop_names (up to 4 exact names copied from places). Prefer a complete journey; if coverage is partial, say so plainly. Evidence: ${JSON.stringify(evidence)}`;
  const models = [...new Set([MODEL(), ...FALLBACK_MODELS()])];
  const errors = [];
  for (const model of models) {
    try {
      const generated = await callModel(model, apiKey, prompt);
      const journeyIds = new Set(evidence.journeys.map((journey) => journey.id));
      const placeNames = new Set(evidence.places.map((place) => place.name));
      return {
        enabled: true,
        model,
        requestedModel: MODEL(),
        summary: String(generated.summary || '').trim(),
        recommendation_reason: String(generated.recommendation_reason || '').trim(),
        selected_journey_id: journeyIds.has(generated.selected_journey_id) ? generated.selected_journey_id : evidence.journeys[0]?.id || null,
        tour_stop_names: Array.isArray(generated.tour_stop_names) ? generated.tour_stop_names.filter((name) => placeNames.has(name)).slice(0, 4) : [],
      };
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
    }
  }
  return { enabled: false, model: MODEL(), attemptedModels: models, message: 'Gemini route narration is temporarily unavailable.', errors };
}
