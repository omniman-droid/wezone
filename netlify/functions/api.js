const { joinPlayer, updatePlayer, addChat, getState } = require('../../world');

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

exports.handler = async (event) => {
  const path = event.path.replace(/^.*\/api\//, '');
  const body = event.body ? JSON.parse(event.body) : {};

  if (event.httpMethod === 'POST' && path === 'join') {
    return { statusCode: 200, headers, body: JSON.stringify(joinPlayer(body)) };
  }

  if (event.httpMethod === 'POST' && path === 'update') {
    const { id, ...payload } = body;
    const player = updatePlayer(id, payload);
    if (!player) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'unknown player' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, player }) };
  }

  if (event.httpMethod === 'POST' && path === 'chat') {
    const chat = addChat(body.id, body.text);
    if (!chat) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'chat rejected' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, chat }) };
  }

  if (event.httpMethod === 'GET' && path === 'state') {
    return { statusCode: 200, headers, body: JSON.stringify(getState()) };
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
};
