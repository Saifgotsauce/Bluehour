// POST /api/crew
// A Founding Crew application. Saves the applicant in Klaviyo so you can review them:
// - their profile gets crew_status "applied" plus their handles, city, how often they go out, how many people go
//   with them, their biggest following and their code idea
// - an "Applied to Founding Crew" event lands on their profile (use it to trigger an email to yourself)
// - if they ticked the box, they join the email list with marketing consent
// - if KLAVIYO_CREW_LIST_ID is set, they're also added to that list (make a list called "Founding Crew applicants")
// Needs in Vercel: KLAVIYO_PRIVATE_KEY, KLAVIYO_LIST_ID. Optional: KLAVIYO_CREW_LIST_ID.

import { cleanEmail } from './subscribe.js';
import { cleanCrewCode } from '../src/data/crew.js';

const KLAVIYO_REVISION = '2024-10-15';
const OFTEN = { weekly: 'Every weekend', monthly: 'A few times a month', festivals: 'Mostly festivals' };
const CREW = { '1-3': '1 to 3', '4-8': '4 to 8', '9-15': '9 to 15', '15+': 'More than 15' };
const REACH = { u500: 'Under 500', '500-2k': '500 to 2k', '2k-10k': '2k to 10k', '10k+': '10k+' };
const PLATFORMS = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X', twitch: 'Twitch', other: 'Other' };
const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
export const cleanHandle = (h) => {
  const s = clip(h, 60).replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\//i, '').replace(/^@+/, '').replace(/[/?#].*$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : '';
};

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

const klaviyo = (path, key, body) =>
  fetch('https://a.klaviyo.com/api/' + path, {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${key}`,
      accept: 'application/json',
      'content-type': 'application/json',
      revision: KLAVIYO_REVISION,
    },
    body: JSON.stringify(body),
  });

// Checks an application. Returns { app } or { error } naming the first field to fix.
export function readApplication(body) {
  if (clip(body.website, 200)) return { error: 'spam' }; // hidden field only bots fill in
  const name = clip(body.name, 60);
  if (!name) return { error: 'name' };
  const email = cleanEmail(body.email);
  if (!email) return { error: 'email' };
  const instagram = cleanHandle(body.instagram);
  if (!instagram) return { error: 'instagram' };
  const tiktok = body.tiktok ? cleanHandle(body.tiktok) : '';
  if (body.tiktok && !tiktok) return { error: 'tiktok' };
  const city = clip(body.city, 80);
  if (!city) return { error: 'city' };
  if (!has(OFTEN, body.often)) return { error: 'often' };
  if (!has(CREW, body.crew)) return { error: 'crew' };
  if (!has(REACH, body.reach)) return { error: 'reach' };
  if (!has(PLATFORMS, body.rplat)) return { error: 'rplat' };
  const rhandle = clip(body.rhandle, 60).replace(/^@+/, '');
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(rhandle)) return { error: 'rhandle' };
  const code = cleanCrewCode(body.code);
  if (!code) return { error: 'code' };
  if (body.adult !== true) return { error: 'adult' };
  return {
    app: { name, email, instagram, tiktok, city, often: OFTEN[body.often], crew: CREW[body.crew], reach: REACH[body.reach], rplat: PLATFORMS[body.rplat], rhandle, code, why: clip(body.why, 400), news: body.news === true },
  };
}

export function crewProfile(a) {
  return {
    data: {
      type: 'profile',
      attributes: {
        email: a.email,
        first_name: a.name,
        properties: {
          crew_status: 'applied',
          crew_applied_at: new Date().toISOString(),
          crew_instagram: '@' + a.instagram,
          crew_tiktok: a.tiktok ? '@' + a.tiktok : '',
          crew_city: a.city,
          crew_goes_out: a.often,
          crew_group_size: a.crew,
          crew_following: a.reach,
          crew_following_on: a.rplat,
          crew_following_handle: '@' + a.rhandle,
          crew_code_request: a.code,
          crew_why: a.why,
        },
      },
    },
  };
}

export function crewEvent(a) {
  return {
    data: {
      type: 'event',
      attributes: {
        properties: {
          instagram: 'https://instagram.com/' + a.instagram,
          tiktok: a.tiktok ? 'https://tiktok.com/@' + a.tiktok : '',
          city: a.city,
          goes_out: a.often,
          group_size: a.crew,
          following: a.reach,
          following_on: a.rplat,
          following_handle: '@' + a.rhandle,
          code_request: a.code,
          why: a.why,
        },
        metric: { data: { type: 'metric', attributes: { name: 'Applied to Founding Crew' } } },
        profile: { data: { type: 'profile', attributes: { email: a.email } } },
      },
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const key = process.env.KLAVIYO_PRIVATE_KEY;
  const list = process.env.KLAVIYO_LIST_ID;
  if (!key) return res.status(503).json({ error: 'not_configured' });

  const { app, error } = readApplication(readBody(req));
  if (error === 'spam') return res.status(200).json({ ok: true }); // look done, save nothing
  if (error) return res.status(400).json({ error });

  try {
    const r = await klaviyo('profile-import/', key, crewProfile(app));
    if (!r.ok) {
      console.error('Klaviyo crew profile failed:', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ error: 'save_failed' });
    }
    const profileId = (await r.json().catch(() => null))?.data?.id;
    // The rest is nice to have: the application is already saved on the profile.
    await klaviyo('events/', key, crewEvent(app)).catch(() => null);
    const crewList = process.env.KLAVIYO_CREW_LIST_ID;
    if (crewList && profileId) {
      await klaviyo(`lists/${crewList}/relationships/profiles/`, key, { data: [{ type: 'profile', id: profileId }] }).catch(() => null);
    }
    if (app.news && list) {
      await klaviyo('profile-subscription-bulk-create-jobs/', key, {
        data: {
          type: 'profile-subscription-bulk-create-job',
          attributes: {
            custom_source: 'Blue Hour Founding Crew form',
            profiles: { data: [{ type: 'profile', attributes: { email: app.email, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } }] },
          },
          relationships: { list: { data: { type: 'list', id: list } } },
        },
      }).catch(() => null);
    }
  } catch (e) {
    console.error('Klaviyo request failed:', e);
    return res.status(502).json({ error: 'save_failed' });
  }
  return res.status(200).json({ ok: true });
}
