const assert = require('assert');
const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const loadJsonFile = require('load-json-file');
const makeDir = require('make-dir');
const ProgressBar = require('progress');
const tokenDealer = require('token-dealer');
const Twit = require('twit');
const { generateIdRange, getComponents } = require('./snowflake');

const chunks = (arr, size) =>
  Array(Math.ceil(arr.length / size))
    .fill()
    .map((_, index) => index * size)
    .map(begin => arr.slice(begin, begin + size));

const agents = [];

const _registerAgent = agent => {
  agents.push(agent);

  return agents.length - 1;
};

const _tweetTransform = ({
  id_str,
  text,
  truncated,
  user,
  retweet_count,
  favorite_count,
  retweeted_status,
  quoted_status_id,
  in_reply_to_status_id_str
}) => ({
  id: id_str,
  snowflake: (() => {
    const { creationTime, dataCenterId, machineId, sequenceId } = getComponents(id_str);
    return [creationTime, dataCenterId, machineId, sequenceId].join('|');
  })(),
  userId: user.id_str,
  retweets: retweet_count,
  likes: favorite_count,
  quotedId: quoted_status_id || null,
  retweetedId: retweeted_status ? retweeted_status.id_str : null,
  repliedId: in_reply_to_status_id_str || null,
  text: truncated ? truncated : text
});

let total = 0;

const _getTweets = (ids, csvStream, bar, token, exhaust) => {
  const agent = agents[token];
  const T = new Twit(agent);

  return T.get('statuses/lookup', { id: ids.join(','), include_entities: false, trim_user: true })
    .then(async ({ data, resp }) => {
      if (+resp.headers['x-rate-limit-remaining'] === 0) {
        exhaust(+resp.headers['x-rate-limit-reset'], false);
      }

      total += data.length;

      data
        .map(_tweetTransform)
        .filter(x => !x.quotedId) // No quotes
        .filter(x => !x.retweetedId) // No retweets (native)
        // .filter(x => !x.repliedId) // No replies
        .map(tweet => csvStream.write(tweet));

      bar.tick({ tweets: total });
    })
    .catch(err => {
      if (+err.statusCode === 429) {
        exhaust(15 * 60 * 1000, true);
      }
    });
};

const checkConfigStructure = config => {
  assert(typeof config.time === 'object');
  assert(typeof config.time.recentMS === 'number');
  assert(Array.isArray(config.apps));
  config.apps.forEach(app => {
    assert(typeof app === 'object');
    assert(typeof app.consumer_key === 'string');
    assert(typeof app.consumer_secret === 'string');
    if (Array.isArray(app.users)) {
      app.users.forEach(user => {
        assert(typeof user === 'object');
        assert(typeof user.access_token === 'string');
        assert(typeof user.access_token_secret === 'string');
      });
    }
  });
};

const _registerAgents = apps =>
  apps
    .reduce((memo, app) => {
      const { consumer_key, consumer_secret, users } = app;

      memo.push({ consumer_key, consumer_secret, app_only_auth: true });

      if (users) {
        users.forEach(user => {
          memo.push(Object.assign({ consumer_key, consumer_secret }, user));
        });
      }

      return memo;
    }, [])
    .map(_registerAgent);

(async () => {
  let config;

  try {
    config = await loadJsonFile(path.join(__dirname, 'config.json'));
    checkConfigStructure(config);
  } catch (err) {
    console.error(`🚨  Couldn't load config`);
    console.error(err);
    process.exit();
  }

  const tokens = _registerAgents(config.apps);
  const to = Date.now();
  const from = to - config.time.recentMS + 1;
  const ids = generateIdRange(from, to);
  const groups = chunks(ids, 100);

  const outputFilename = `${new Date(from).toISOString()}_${new Date(to).toISOString()}.csv`;
  const outputPath = await makeDir(path.join(__dirname, 'output'));
  const csvStream = csv.createWriteStream({ headers: true });

  csvStream.pipe(fs.createWriteStream(path.join(outputPath, outputFilename), { flags: 'a' }));

  console.log(`There are potentially ${ids.length} tweets in this time period`);

  const bar = new ProgressBar('[:bar] :percent (:tweets tweets found)', {
    complete: '=',
    incomplete: ' ',
    width: 40,
    total: groups.length
  });

  const batches = chunks(groups, 1000);

  for (batch of batches) {
    await Promise.all(
      batch.map(ids =>
        tokenDealer(tokens, (token, exhaust) => _getTweets(ids, csvStream, bar, token, exhaust), {
          wait: true
        })
      )
    ).catch(err => {
      /* SWALLOW */
    });
  }

  csvStream.end();
})();
