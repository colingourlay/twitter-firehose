const assert = require('assert');
const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const range = require('just-range');
const loadJsonFile = require('load-json-file');
const makeDir = require('make-dir');
const ProgressBar = require('progress');

const tokenDealer = require('token-dealer');
const Twit = require('twit');
const { generateId, getComponents } = require('./snowflake');

const SEQUENCE_IDS = [0, 1, 2, 6, 5, 3, 7, 4, 8, 10];
const WORKER_IDS = [375, 382, 361, 372, 364, 381, 376, 365, 363, 362, 350, 325, 335, 333, 342, 326, 327, 336, 347, 332];

const wait = time => new Promise(resolve => setTimeout(resolve, time));

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

const _generateAndFeedIDs = (from, to, onGroup) =>
  new Promise(async resolve => {
    if (typeof from !== 'number') {
      throw new Error(`'from' must be a Number`);
    }

    let group = [];
    let groupCount = 0;

    for (let creationTime = from; creationTime <= to; creationTime++) {
      for (workerId of WORKER_IDS) {
        for (sequenceId of SEQUENCE_IDS) {
          group.push(generateId(String(creationTime), String(workerId), String(sequenceId)));

          if (group.length === 100) {
            onGroup(group);
            group = [];
            ++groupCount;

            // Every 100 groups, take a breather
            if (groupCount % 100 === 0) {
              await wait(1000);
            }
          }
        }
      }
    }

    resolve();
  });

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
  const numTweetsToGenerate = (to - from) * WORKER_IDS.length * SEQUENCE_IDS.length;

  const outputFilename = `${new Date(from).toISOString()}_${new Date(to).toISOString()}.csv`;
  const outputPath = await makeDir(path.join(__dirname, 'output'));
  const csvStream = csv.createWriteStream({ headers: true });

  console.log(`Checking ${numTweetsToGenerate} potential IDs to fetch ${config.time.recentMS}ms of tweets...`);

  const bar = new ProgressBar('[:bar] :percent (ETA: :etas)', {
    complete: '=',
    incomplete: ' ',
    width: 40,
    total: Math.ceil(numTweetsToGenerate / 100)
  });

  csvStream.pipe(fs.createWriteStream(path.join(outputPath, outputFilename), { flags: 'a' }));

  const tasks = [];

  await _generateAndFeedIDs(from, to, group =>
    tasks.push(
      tokenDealer(tokens, (token, exhaust) => _getTweets(group, csvStream, bar, token, exhaust), {
        wait: true
      })
    )
  );

  await Promise.all(tasks).catch(err => {
    /* SWALLOW */
  });

  csvStream.end();
})();
