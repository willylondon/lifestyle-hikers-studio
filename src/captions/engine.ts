// Caption engine, hashtags, SEO keywords, and alt text.

import type { Caption, Concept, Slide } from '../lib/types';

export function generateCaption(concept: Concept, slides: Slide[], location: string): Caption {
  const hook = concept.hook;
  const story = buildStoryParagraphs(concept, slides);
  const value = buildValue(concept);
  const question = buildQuestion(concept);
  const cta = buildCta(concept);
  const hashtags = buildHashtags(concept, location);
  const seoKeywords = buildSeo(concept, location);

  return { hook, story, value, question, cta, hashtags, seoKeywords };
}

function buildStoryParagraphs(concept: Concept, slides: Slide[]): string[] {
  const setup = slides.find((s) => s.role === 'setup');
  const payoff = slides.find((s) => s.role === 'payoff');
  const takeaway = slides.find((s) => s.role === 'takeaway');

  return [
    setup?.body || 'Every hike begins with one step.',
    payoff?.headline ? `${payoff.headline} ${payoff.body}` : 'The trail had its own plan.',
    takeaway?.body || 'One foot in front the other.',
  ];
}

function buildValue(concept: Concept): string {
  const pillar = concept.pillar;
  if (pillar === 'Community') return 'A good hike makes room for different ages, paces and reasons for showing up.';
  if (pillar === 'Practical Guides') return 'Save this for your next hike — footwear, water, and weather make all the difference.';
  if (pillar === 'Education') return 'These benefits are associated with regular movement and time outdoors, not guarantees. Always listen to your body.';
  if (pillar === 'Jamaica Discovery') return 'There are trails across every parish waiting to be walked. This is only one of them.';
  return 'Whether you\'re a beginner or a regular, there\'s a trail — and a community — for you.';
}

function buildQuestion(concept: Concept): string {
  const t = concept.title.toLowerCase();
  if (concept.pillar === 'Community' || /together|people/.test(t)) return 'What makes a hiking group feel like community to you?';
  if (/type|trust|group/.test(t)) return 'Which type of hiker are you — or did we miss one?';
  if (/river|water/.test(t)) return 'What\'s the coldest river crossing you\'ve done?';
  if (/jamaica too/.test(t)) return 'Which part of Jamaica surprised you the most?';
  return 'What\'s a trail that changed how you see Jamaica?';
}

function buildCta(concept: Concept): string {
  if (concept.pillar === 'Practical Guides') return 'Save this for your next hike, and follow @LifestyleHikers for more.';
  if (concept.pillar === 'Community') return 'Tag your hiking crew and walk with us. Follow @LifestyleHikers.';
  return 'Follow @LifestyleHikers and walk with us. 🇯🇲';
}

function buildHashtags(concept: Concept, location: string): string[] {
  const tags = new Set<string>(['#LifestyleHikers']);
  const loc = location.toLowerCase();

  if (/st thomas/.test(loc)) tags.add('#HikingStThomasJamaica');
  if (/portland/.test(loc)) tags.add('#HikingPortlandJamaica');
  if (/kingston/.test(loc)) tags.add('#HikingKingston');
  if (/st andrew/.test(loc)) tags.add('#HikingStAndrewJamaica');
  if (/st catherine/.test(loc)) tags.add('#HikingStCatherineJamaica');
  if (/st mary/.test(loc)) tags.add('#HikingStMaryJamaica');
  if (/trelawny/.test(loc)) tags.add('#HikingTrelawnyJamaica');

  tags.add('#HikingJamaica');
  tags.add('#JamaicaHikingTrails');
  tags.add('#JamaicanOutdoors');

  const t = concept.title.toLowerCase();
  if (/river|water/.test(t)) tags.add('#JamaicaRivers');
  if (/waterfall/.test(t)) tags.add('#JamaicaWaterfalls');
  if (/mountain|trail/.test(t)) tags.add('#JamaicaNature');
  if (/body|health/.test(t)) tags.add('#HikeForHealth');
  if (concept.pillar === 'Community') {
    tags.add('#HikingCommunity');
    tags.add('#JamaicaCommunity');
  }
  if (/jamaica too|discover/.test(t)) tags.add('#JamaicaAdventure');
  tags.add('#ThingsToDoInJamaica');

  // Keep 5–10 total.
  const arr = [...tags];
  return arr.slice(0, 10);
}

function buildSeo(concept: Concept, location: string): string[] {
  const seo = new Set<string>(['hiking Jamaica', 'Jamaica hiking trails', 'Jamaican outdoors']);
  if (location) seo.add(`hiking ${location}`);
  if (location) seo.add(`things to do in ${location}`);
  const t = concept.title.toLowerCase();
  if (/river|water/.test(t)) seo.add('Jamaica rivers');
  if (concept.pillar === 'Community') seo.add('Jamaica hiking community');
  if (/waterfall/.test(t)) seo.add('Jamaica waterfalls');
  seo.add('Jamaica adventure');
  seo.add('Jamaica nature');
  return [...seo].slice(0, 8);
}

export function generateAltText(slide: Slide, concept: Concept): string {
  const role = slide.role;
  const base = `Slide ${slide.order} of a Lifestyle Hikers carousel about ${concept.title}.`;
  switch (role) {
    case 'hook':
      return `${base} Bold text reads: "${slide.headline}".`;
    case 'cta':
      return `${base} Closing slide with the message "${slide.headline}" and the @LifestyleHikers handle.`;
    case 'takeaway':
      return `${base} Summary text: "${slide.headline}". ${slide.body}`;
    default:
      return `${base} Text reads: "${slide.headline}". ${slide.body}`.trim();
  }
}
