// Founding Crew applications, read back out of Klaviyo for the admin page.
// Every application sends an "Applied to Founding Crew" event (see api/crew.js), so this lists those events with the
// applicant's profile. Approving or declining someone sets crew_status on their Klaviyo profile, which is how the
// admin page knows to stop showing them.
// Needs KLAVIYO_PRIVATE_KEY with read access to Events, Metrics and Profiles, and write access to Profiles.

const REV = '2024-10-15';
const METRIC = 'Applied to Founding Crew';
const base = 'https://a.klaviyo.com/api/';

async function kl(key, url, opts = {}) {
  const r = await fetch(url.startsWith('http') ? url : base + url, {
    ...opts,
    headers: { Authorization: `Klaviyo-API-Key ${key}`, accept: 'application/json', 'content-type': 'application/json', revision: REV },
  });
  const d = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (d.errors && d.errors[0] && (d.errors[0].detail || d.errors[0].title)) || 'HTTP ' + r.status;
    const e = new Error(msg); e.status = r.status; throw e;
  }
  return d;
}

async function metricId(key) {
  let url = 'metrics/?fields[metric]=name';
  for (let i = 0; url && i < 10; i++) {
    const d = await kl(key, url);
    const hit = (d.data || []).find((m) => m.attributes && m.attributes.name === METRIC);
    if (hit) return hit.id;
    url = d.links && d.links.next;
  }
  return null; // nobody has applied yet, so Klaviyo hasn't made the metric
}

// Newest first, one entry per email (their latest application).
export async function listApplications(key) {
  const id = await metricId(key);
  if (!id) return [];
  let url = `events/?filter=${encodeURIComponent(`equals(metric_id,"${id}")`)}&sort=-datetime&include=profile&fields[profile]=email,first_name,last_name,properties`;
  const out = [];
  const seen = new Set();
  for (let i = 0; url && i < 10; i++) {
    const d = await kl(key, url);
    const people = new Map((d.included || []).filter((x) => x.type === 'profile').map((p) => [p.id, p]));
    for (const ev of d.data || []) {
      const pid = ev.relationships && ev.relationships.profile && ev.relationships.profile.data && ev.relationships.profile.data.id;
      const p = people.get(pid);
      const email = p && p.attributes.email ? String(p.attributes.email).toLowerCase() : '';
      if (!email || seen.has(email)) continue;
      seen.add(email);
      const pp = (p.attributes.properties) || {};
      out.push({
        profileId: pid,
        email,
        name: [p.attributes.first_name, p.attributes.last_name].filter(Boolean).join(' '),
        status: pp.crew_status || 'applied',
        at: ev.attributes.datetime,
        ...(ev.attributes.event_properties || {}),
      });
    }
    url = d.links && d.links.next;
  }
  return out;
}

export async function setCrewStatus(key, profileId, status) {
  if (!/^[A-Za-z0-9]+$/.test(String(profileId || ''))) return false;
  await kl(key, 'profiles/' + profileId + '/', {
    method: 'PATCH',
    body: JSON.stringify({ data: { type: 'profile', id: profileId, attributes: { properties: { crew_status: status, crew_status_at: new Date().toISOString() } } } }),
  });
  return true;
}
