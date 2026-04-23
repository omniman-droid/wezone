const { joinPlayer, updatePlayer, addChat, spawnProp, resizeProp, hitPlayer, getState } = require('../../world');

const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

exports.handler = async (event) => {
  const path = event.path.replace(/^.*\/api\//, '');
  const body = event.body ? JSON.parse(event.body) : {};

  if (event.httpMethod === 'POST' && path === 'join') return { statusCode: 200, headers, body: JSON.stringify(joinPlayer(body)) };
  if (event.httpMethod === 'POST' && path === 'update') {
    const { id, ...payload } = body;
    const player = updatePlayer(id, payload);
    if (!player) return { statusCode: 404, headers, body: JSON.stringify({ error: 'unknown player' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, player }) };
  }
  if (event.httpMethod === 'POST' && path === 'chat') {
    const chat = addChat(body.id, body.text);
    if (!chat) return { statusCode: 400, headers, body: JSON.stringify({ error: 'chat rejected' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, chat }) };
  }
  if (event.httpMethod === 'POST' && path === 'props/spawn') {
    const { id, ...payload } = body;
    const prop = spawnProp(id, payload);
    if (!prop) return { statusCode: 400, headers, body: JSON.stringify({ error: 'spawn rejected' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, prop }) };
  }
  if (event.httpMethod === 'POST' && path === 'props/resize') {
    const { id, ...payload } = body;
    const prop = resizeProp(id, payload);
    if (!prop) return { statusCode: 400, headers, body: JSON.stringify({ error: 'resize rejected' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, prop }) };
  }
  if (event.httpMethod === 'POST' && path === 'hit') {
    const result = hitPlayer(body.id, body.victimId);
    if (!result) return { statusCode: 400, headers, body: JSON.stringify({ error: 'hit rejected' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...result }) };
  }
  if (event.httpMethod === 'GET' && path.startsWith('state')) return { statusCode: 200, headers, body: JSON.stringify(getState(event.queryStringParameters?.since)) };

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
};
